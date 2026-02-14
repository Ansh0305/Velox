"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post({ ttl: selectedTTL });
      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`);
      }
    },
  });
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
              className="w-full bg-zinc-100 text-black p-3 text-sm font-bold hover:bg-zinc-50 hover:text-black transition-colors mt-2 cursor-pointer disabled:opacity-50"
            >
              CREATE SECURE ROOM
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
                  onKeyDown={(e) => e.key === "Enter" && roomCode.trim() && router.push(`/room/${roomCode.trim()}`)}
                  placeholder="Paste room code..."
                  className="w-full bg-zinc-950 border border-zinc-800 p-3 pl-7 text-sm text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <button
                onClick={() => roomCode.trim() && router.push(`/room/${roomCode.trim()}`)}
                disabled={!roomCode.trim()}
                className="bg-zinc-100 text-black px-4 py-3 text-sm font-bold hover:bg-zinc-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

