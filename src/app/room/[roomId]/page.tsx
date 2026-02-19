"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns"
import { useRealtime } from "@/lib/realtime-client";
import { type RealtimeEvents } from "@/lib/realtime";
import { getDerivedKey, encryptMessage, decryptMessage } from "@/lib/crypto";

const Page = () => {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const searchParams = useSearchParams(); // Get search params
  const roomKey = searchParams.get("key") ?? ""; // Extract key

  // Crypto State
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [isKeyDerived, setIsKeyDerived] = useState(false);

  // Derive Key on Mount
  useEffect(() => {
    if (!roomId || !roomKey) return;

    const initCrypto = async () => {
      try {
        // 1. Fetch Salt
        const { data, error } = await client.room.meta.get({
          query: { roomId },
          headers: { "x-room-key": roomKey }
        });

        if (error || !data?.salt) {
          console.error("Failed to fetch salt:", error);
          return;
        }

        // 2. Derive Key
        const key = await getDerivedKey(roomKey, data.salt as string);
        setCryptoKey(key);
        setIsKeyDerived(true);
      } catch (err) {
        console.error("Crypto init failed:", err);
      }
    };

    initCrypto();
  }, [roomId, roomKey]);

  // Input message Tracking
  const [input, setinput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId, roomKey],
    queryFn: async () => {
      const res = await client.messages.get({
        query: { roomId },
        headers: { "x-room-key": roomKey }
      });
      return res.data;
    },
    enabled: isKeyDerived, // Only fetch when we have the key
  });

  // Decrypted Messages State
  // We prioritize keeping the 'messages' from react-query as the source of truth, 
  // but we need to decrypt them for display.
  // Memoizing decryption could be good, but for now we'll do it on render or effect.
  // Actually, let's use a derived state or separate list.
  const [displayMessages, setDisplayMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!messages?.messages || !cryptoKey) return;

    const decryptAll = async () => {
      const decrypted = await Promise.all(
        messages.messages.map(async (msg) => {
          try {
            // Try to decrypt. If it fails (e.g. old plaintext message), keep original text or show error.
            // We can check if it looks like "base64:base64" (colon exists)
            if (msg.text.includes(":")) {
              const plain = await decryptMessage(msg.text, cryptoKey);
              return { ...msg, text: plain };
            }
            return msg; // Assume plaintext for backward compatibility during dev
          } catch (e) {
            return { ...msg, text: "🔒 Decryption Failed" };
          }
        })
      );

      // Merge with system messages
      // We'll do the merging in the render loop or here. 
      // Let's just update the list of chat messages.
      // We need to handle the system messages separately or merge them now.
      // The original code merged them in render. Let's keep that pattern.
      // So we just need a way to pass decent decrypted messages to the render.
      setDisplayMessages(decrypted);
    };

    decryptAll();
  }, [messages, cryptoKey]);


  // Copy button
  const [copyStatus, setcopyStatus] = useState("COPY");
  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}?key=${roomKey}`;
    navigator.clipboard.writeText(url);
    setcopyStatus("COPIED!");
    setTimeout(() => {
      setcopyStatus("COPY");
    }, 2000);
  };

  // sending message
  const { username } = useUsername();
  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!cryptoKey) throw new Error("Encryption key not ready");

      const encryptedText = await encryptMessage(text, cryptoKey);

      await client.messages.post(
        { sender: username, text: encryptedText },
        {
          query: { roomId },
          headers: { "x-room-key": roomKey }
        },
      );
      setinput("");
    },
  });

  // Typing indicator state
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  // Emit typing event (throttled to once per 2s)
  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 2000) return;
    lastTypingEmitRef.current = now;
    client.typing.post(
      { sender: username },
      {
        query: { roomId },
        headers: { "x-room-key": roomKey }
      }
    );
  }, [username, roomId, roomKey]);

  // Join/Leave system messages
  const [systemMessages, setSystemMessages] = useState<{ id: string; text: string; timestamp: number }[]>([]);
  const hasJoinedRef = useRef(false);

  // Emit join event on mount
  useEffect(() => {
    if (!username || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    client.presence.join.post(
      { sender: username },
      {
        query: { roomId },
        headers: { "x-room-key": roomKey }
      }
    );

    // Emit leave event on page unload
    const handleBeforeUnload = () => {
      navigator.sendBeacon?.(
        `/api/presence/leave?roomId=${roomId}&key=${roomKey}`,
        new Blob([JSON.stringify({ sender: username })], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [username, roomId, roomKey]);

  // Realtime logic
  useRealtime({
    channels: [roomId],
    // @ts-ignore - onData is the correct callback
    onData: async (event: any) => {
      const type = event.event;
      const data = event.data;

      switch (type) {
        case "chat.message":
          // When we receive a message in realtime, it is Encrypted.
          // We can't just refetch() because that's slow. 
          // We should decrypt it and add it to our list, or refetch and let the effect decrypt it.
          // For consistency with the implementation plan "Receive (Realtime) -> decrypt -> Display",
          // The easiest way to ensure consistency is to refetch, which triggers the useQuery effect.
          // BUT, if we want instant feedback, we can optimistically decrypt.
          // Let's stick to refetch for simplicity and correctness first, as specified in the previous plan,
          // OR optimize if needed. The prompt says "Decrypt message.text - Update UI".
          refetch();
          break;

        case "chat.typing":
          if (data.sender !== username && data.isTyping) {
            setTypingUser(data.sender);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
          }
          break;

        case "chat.join":
          if (data.sender !== username) {
            setSystemMessages((prev) => [
              ...prev,
              { id: Date.now().toString(), text: `${data.sender} joined the room`, timestamp: Date.now() }
            ]);
          }
          break;

        case "chat.leave":
          setSystemMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), text: `${data.sender} left the room`, timestamp: Date.now() }
          ]);
          break;

        case "chat.destroy":
          router.push("/?destroyed=true");
          break;
      }
    },
  } as any);

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, {
        query: { roomId },
        headers: { "x-room-key": roomKey }
      })
    },
    onSuccess: () => {
      router.push("/?destroyed=true")
    }
  })

  // Remaininig Time
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({
        query: { roomId },
        headers: { "x-room-key": roomKey }
      })
      return res.data
    }
  })

  useEffect(() => {
    if (ttlData?.ttl !== undefined) {
      setTimeRemaining(ttlData.ttl)
    }
  }, [ttlData])


  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return
    if (timeRemaining === 0) {
      router.push("/?destroyed=true")
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1;
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeRemaining, router])

  function formatTimeRemaining(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 p-3 flex items-center justify-between gap-3 bg-zinc-900/50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">Room ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500 text-sm truncate max-w-[100px] sm:max-w-[150px] md:max-w-none">{roomId}</span>
              <button
                onClick={copyLink}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {copyStatus}
              </button>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">
              Self-Destruct
            </span>
            <span
              className={`text-sm font-bold flex items-center gap-2 ${timeRemaining !== null && timeRemaining < 60 ? "text-red-500" : "text-amber-500"}`}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          {/* Encryption indicator */}
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">Security</span>
            <span className="text-sm font-bold text-green-500 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 [animation-duration:2s]" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              🔒 E2E ENCRYPTED
            </span>
          </div>
        </div>

        {/* Leave and Destroy buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              client.presence.leave.post(
                { sender: username },
                {
                  query: { roomId },
                  headers: { "x-room-key": roomKey }
                }
              );
              router.push("/?left=true");
            }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all flex items-center gap-1"
          >
            <span className="hidden sm:inline">LEAVE</span>
            <span>🚪</span>
          </button>
          <button onClick={() => destroyRoom()} className="text-xs bg-zinc-800 hover:bg-red-600 px-2 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-1 disabled:opacity-50">
            <span className="hidden sm:inline">DESTROY</span>
            <span className="group-hover:animate-pulse">💥</span>
          </button>
        </div>
      </header>
      {/* Rendering Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {!isKeyDerived ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 animate-pulse text-sm font-mono">initializing secure channel...</p>
          </div>
        ) : displayMessages.length === 0 && systemMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm font-mono">
              No messages yet, start the conversation
            </p>
          </div>
        ) : (
          /* Messsage Render List */
          [
            ...displayMessages.map((msg) => ({ type: "chat" as const, ...msg })),
            ...systemMessages.map((sys) => ({ type: "system" as const, ...sys, sender: "" })),
          ]
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((item) => {
              // System message (join/leave)
              if (item.type === "system") {
                return (
                  <div key={item.id} className="flex justify-center">
                    <span className="text-[10px] text-zinc-600 bg-zinc-900/50 px-3 py-1 rounded-full">
                      {item.text}
                    </span>
                  </div>
                );
              }

              // Regular chat message
              return (
                <div key={item.id} className="flex flex-col items-start">
                  <div className="max-w-[80%] group">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span
                        className={`text-xs font-bold ${item.sender === username ? "text-green-500" : "text-blue-500"
                          }`}
                      >
                        {item.sender === username ? "YOU" : item.sender}
                      </span>

                      <span className="text-[10px] text-zinc-600">
                        {format(item.timestamp, "HH:mm")}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-300 leading-relaxed break-all">
                      {item.text}
                    </p>
                  </div>
                </div>
              );
            })
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        {/* Typing indicator */}
        {typingUser && (
          <div className="flex items-center gap-2 pb-2 text-xs text-zinc-500">
            <span className="flex gap-0.5">
              <span className="animate-typing-dot w-1 h-1 bg-green-500 rounded-full" />
              <span className="animate-typing-dot w-1 h-1 bg-green-500 rounded-full [animation-delay:0.2s]" />
              <span className="animate-typing-dot w-1 h-1 bg-green-500 rounded-full [animation-delay:0.4s]" />
            </span>
            <span>{typingUser} is typing...</span>
          </div>
        )}
        <div className="flex gap-2 sm:gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">
              {">"}
            </span>
            <input
              autoFocus
              type="text"
              value={input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  sendMessage({ text: input });
                  inputRef.current?.focus();
                }
              }}
              placeholder={isKeyDerived ? "Type message..." : "Initializing encryption..."}
              disabled={!isKeyDerived}
              onChange={(e) => {
                setinput(e.target.value);
                // Emit typing event on input change
                if (e.target.value.trim()) emitTyping();
              }}
              className="w-full bg-black border border-zinc-800 focus:border-zinc-700 focus:outline-none transition-colors text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-8 text-sm"
            />
          </div>

          <button
            onClick={() => {
              sendMessage({ text: input });
              inputRef.current?.focus();
            }}
            disabled={!input.trim() || isPending || !isKeyDerived}
            className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;
