import { NextRequest, NextResponse } from "next/server";
import { redis } from "./lib/redis";
import { nanoid } from "nanoid";

export const proxy = async (req: NextRequest) => {
    const pathname = req.nextUrl.pathname;

    const roomMatch = pathname.match(/^\/room\/([^/]+)$/);
    if (!roomMatch) {
        // Check if it's the root or other allowed paths
        return NextResponse.next();
    }

    const roomId = roomMatch[1];
    const urlKey = req.nextUrl.searchParams.get("key");

    const meta = await redis.hgetall<{ connected: string[]; key: string }>(
        `meta:${roomId}`,
    );

    if (!meta) {
        console.error(`[Proxy] Room not found: ${roomId}`);
        return NextResponse.redirect(new URL("/?error=room-not-found", req.url));
    }

    // Validate Room Key
    if (meta.key !== urlKey) {
        return NextResponse.redirect(new URL("/?error=invalid-key", req.url));
    }

    // Existing user token
    const existingToken = req.cookies.get("x-auth-token")?.value;

    const currentConnected = Array.isArray(meta.connected) ? meta.connected : [];

    // If user has a valid token for this room, let them in
    if (existingToken && currentConnected.includes(existingToken)) {
        return NextResponse.next();
    }

    // Room Capacity Check (if not already connected)
    if (currentConnected.length >= 2) {
        return NextResponse.redirect(new URL("/?error=room-full", req.url));
    }

    // New User: Generate token and add to room
    const response = NextResponse.next();
    const token = nanoid();

    response.cookies.set("x-auth-token", token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });

    // Add new token to connected list
    await redis.hset(`meta:${roomId}`, {
        connected: [...currentConnected, token],
    });

    return response;
};

export const config = {
    matcher: "/room/:path*",
};
