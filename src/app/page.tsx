"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { parseInvite } from "@/lib/parse-invite";

const Page = () => {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  )
}

export default Page;

// Timer presets
const TIMER_OPTIONS = [
  { label: "2 MIN", value: 60 * 2 },
  { label: "5 MIN", value: 60 * 5 },
  { label: "10 MIN", value: 60 * 10 },
];

function Lobby() {
  const { username } = useUsername();
  const router = useRouter();

  const searchParams = useSearchParams();
  const wasDestroyed = searchParams.get("destroyed") === "true";
  const wasLeft = searchParams.get("left") === "true";
  const error = searchParams.get("error");

  // Auto-clear status banners from URL after 3s
  useEffect(() => {
    if (wasDestroyed || wasLeft || error) {
      const timeout = setTimeout(() => {
        router.replace("/");
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [wasDestroyed, wasLeft, error, router]);

  // Selected self-destruct timer
  const [selectedTTL, setSelectedTTL] = useState(60 * 10);

  // Join room by code
  const [roomCode, setRoomCode] = useState("");

  const { mutate: createRoom, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post({ ttl: selectedTTL });
      if (res.status === 200 && res.data) {
        router.push(`/room/${res.data.roomId}?key=${res.data.roomKey}`);
      }
    },
  });
  // Join room parsing
  const handleJoin = () => {
    const input = roomCode.trim();
    if (!input) return;

    const { roomId, roomKey } = parseInvite(input);

    if (roomId) {
      if (roomKey) {
        router.push(`/room/${roomId}?key=${roomKey}`);
      } else {
        router.push(`/room/${roomId}`);
      }
    } else {
      router.push(`/room/${input}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Message Destroyed */}
        {wasDestroyed && (
          <div className="bg-red-950/50 border border-red-900 p-4 text-center">
            <p className="text-red-500 text-sm font-bold">ROOM DESTROYED</p>
            <p className="text-zinc-500 text-xs mt-1">
              All messages were permanently deleted!
            </p>
          </div>
        )}
        {/* Left Room */}
        {wasLeft && (
          <div className="bg-zinc-900/50 border border-zinc-700 p-4 text-center">
            <p className="text-zinc-300 text-sm font-bold">LEFT ROOM</p>
            <p className="text-zinc-500 text-xs mt-1">
              You have left the room!
            </p>
          </div>
        )}
        {error === "room-not-found" && (
          <div className="bg-red-950/50 border border-red-900 p-4 text-center">
            <p className="text-red-500 text-sm font-bold">ROOM NOT FOUND!</p>
            <p className="text-zinc-500 text-xs mt-1">
              This room may have expired or never existed!
            </p>
          </div>
        )}
        {error === "invalid-key" && (
          <div className="bg-red-950/50 border border-red-900 p-4 text-center">
            <p className="text-red-500 text-sm font-bold">INVALID KEY</p>
            <p className="text-zinc-500 text-xs mt-1">
              The room key provided is invalid or missing!
            </p>
          </div>
        )}
        {error === "room-full" && (
          <div className="bg-red-950/50 border border-red-900 p-4 text-center">
            <p className="text-red-500 text-sm font-bold">ROOM FULL</p>
            <p className="text-zinc-500 text-xs mt-1">
              Room is occupied!
            </p>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">
            {">"}Velox_chat
          </h1>
          <p className="text-zinc-500 text-sm">
            A private, self-destructing chat room.
          </p>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Your Identity
              </label>

              <div className="flex items-center gap-3">
                <div
                  className="flex-1 bg-zinc-950 border border-zinc-800
                p-3 text-sm text-zinc-400 font-mono"
                >
                  {username}
                </div>
              </div>
            </div>

            {/* Self-destruct timer selection */}
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Self-Destruct Timer
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedTTL(opt.value)}
                    className={`p-2 text-xs font-bold transition-all cursor-pointer border ${selectedTTL === opt.value
                      ? "bg-zinc-100 text-black border-zinc-100"
                      : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => createRoom()}
              disabled={isCreating}
              className="w-full bg-zinc-100 text-black p-3 text-sm font-bold hover:bg-zinc-50 hover:text-black transition-colors mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  CREATING...
                </>
              ) : (
                "CREATE SECURE ROOM"
              )}
            </button>
          </div>
        </div>

        {/* Join room by code */}
        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-3">
            <label className="flex items-center text-zinc-500">
              Join Existing Room
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 animate-pulse text-sm">{">"}</span>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Paste room link or ID..."
                  className="w-full bg-zinc-950 border border-zinc-800 p-3 pl-7 text-sm text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={!roomCode.trim()}
                className="bg-zinc-100 text-black px-4 py-3 text-sm font-bold hover:bg-zinc-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                JOIN
              </button>
            </div>
            {/* Clickboard paste button */}
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) setRoomCode(text);
                } catch (e) {
                  console.error("Failed to read clipboard:", e);
                }
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Paste from clipboard
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs mt-4">
          Built by{" "}
          <a
            href="https://github.com/Ansh0305"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-green-600 hover:text-green-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Sirigiri Sai Ansh Raj
          </a>
        </p>
      </div>
    </main>
  );
}

