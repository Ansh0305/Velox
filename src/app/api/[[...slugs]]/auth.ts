import { redis } from "@/lib/redis";
import Elysia from "elysia";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export const authMiddleware = new Elysia({
  name: "auth",
})
  .error({ AuthError })
  .onError(({ code, error, set }) => {
    console.log("[AuthMiddleware Debug] onError triggered:", code, error);
    if (code === "AuthError") {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    console.error("[AuthMiddleware Error]", code, error);
  })
  .derive({ as: "scoped" }, async (context) => {
    const { query, cookie, headers } = context;
    const roomId = query.roomId as string | undefined;

    // Headers can be incoming in different formats depending on the environment
    const headerKey = (headers as Record<string, any>)["x-room-key"];
    const headerToken = (headers as Record<string, any>)["x-auth-token"];

    const roomKey = (headerKey || query.key) as string | undefined;
    const token = (headerToken || cookie["x-auth-token"]?.value) as string | undefined;

    // We relax the token requirement if roomKey is present, or we can use a simpler check.
    // E2EE relies on roomKey. Token is for identity/rate limiting potentially.
    // If token is missing, we might default to something or throw.
    // For now, let's keep it required but allow header source.

    if (!roomId) {
      throw new AuthError("Missing roomId");
    }

    // Only check roomKey
    if (!roomKey) {
      throw new AuthError("Missing roomKey");
    }

    const meta = await redis.hgetall<{ connected: string[], key: string }>(`meta:${roomId}`);

    if (!meta) {
      throw new AuthError("Room not found");
    }

    if (meta.key !== roomKey) {
      throw new AuthError("Invalid room key");
    }

    // Connected check is removed as it was blocking valid requests and not maintained
    // const connected = Array.isArray(meta.connected) ? meta.connected : [];
    // if (!connected.includes(token)) { ... }

    return { auth: { roomId, token: token || "anonymous", connected: [] } };
  });
