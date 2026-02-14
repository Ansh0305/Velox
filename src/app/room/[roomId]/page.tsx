"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns"
import { useRealtime } from "@/lib/realtime-client";

const Page = () => {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  // Input message Tracking
  const [input, setinput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      return res.data;
    },
  });

  // Copy button
  const [copyStatus, setcopyStatus] = useState("COPY");
  const copyLink = () => {
    const url = window.location.href;
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
      await client.messages.post(
        { sender: username, text },
        { query: { roomId } },
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
    client.typing.post({ sender: username }, { query: { roomId } });
  }, [username, roomId]);

  // Join/Leave system messages
  const [systemMessages, setSystemMessages] = useState<{ id: string; text: string; timestamp: number }[]>([]);
  const hasJoinedRef = useRef(false);

  // Emit join event on mount
  useEffect(() => {
    if (!username || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    client.presence.join.post({ sender: username }, { query: { roomId } });

    // Emit leave event on page unload
    const handleBeforeUnload = () => {
      navigator.sendBeacon?.(
        `/api/presence/leave?roomId=${roomId}`,
        new Blob([JSON.stringify({ sender: username })], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [username, roomId]);

  // Realtime listener for this room — refetch messages when a new message is broadcast
  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy", "chat.typing", "chat.join", "chat.leave"],
    onData: ({ event, data }) => {
      if (event === "chat.message") {
        refetch();
        setTypingUser(null);
      }
      if (event === 'chat.destroy') {
        router.push("/?destroyed=true")
      }
      // Typing indicator from another user
      if (event === "chat.typing") {
        const payload = data as { sender: string; isTyping: boolean };
        if (payload.sender !== username) {
          setTypingUser(payload.sender);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2000);
        }
      }
      // Join/Leave notifications
      if (event === "chat.join") {
        const payload = data as { sender: string };
        if (payload.sender !== username) {
          setSystemMessages((prev) => [...prev, {
            id: `join-${Date.now()}`,
            text: `${payload.sender} joined the room`,
            timestamp: Date.now(),
          }]);
        }
      }
      if (event === "chat.leave") {
        const payload = data as { sender: string };
        if (payload.sender !== username) {
          setSystemMessages((prev) => [...prev, {
            id: `leave-${Date.now()}`,
            text: `${payload.sender} left the room`,
            timestamp: Date.now(),
          }]);
        }
      }
    },
  });

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } })
    }
  })

  // Remaininig Time
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({
        query: { roomId }
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
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">Room ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500">{roomId}</span>
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
              🔒 ENCRYPTED
            </span>
          </div>
        </div>

        {/* Leave and Destroy buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              client.presence.leave.post({ sender: username }, { query: { roomId } });
              router.push("/?left=true");
            }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all flex items-center gap-2"
          >
            LEAVE
            <span>🚪</span>
          </button>
          <button onClick={() => destroyRoom()} className="text-xs bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50">
            DESTROY NOW
            <span className="group-hover:animate-pulse">💥</span>
          </button>
        </div>
      </header>
      {/* Rendering Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages?.messages?.length === 0 && systemMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm font-mono">
              No messages yet, start the conversation
            </p>
          </div>
        )}

        {/* Merge chat messages and system messages, sorted by timestamp */}
        {[
          ...(messages?.messages?.map((msg) => ({ type: "chat" as const, ...msg })) ?? []),
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
          })}
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
        <div className="flex gap-4">
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
              placeholder="Type message..."
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
            disabled={!input.trim() || isPending}
            className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};;

export default Page;
