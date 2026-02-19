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

    // Safe header access helper
    const getHeader = (key: string): string | undefined => {
      if (!headers) return undefined;
      // Check if it's a Headers object (e.g. in some edge runtimes)
      if (typeof (headers as any).get === "function") {
        return (headers as any).get(key) || undefined;
      }
      // Otherwise treat as standard object
      return (headers as Record<string, any>)[key];
    };

    const headerKey = getHeader("x-room-key");
    const headerToken = getHeader("x-auth-token");

    const roomKey = (headerKey || query.key) as string | undefined;
    const token = (headerToken || cookie["x-auth-token"]?.value) as string | undefined;

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

    return { auth: { roomId, token: token || "anonymous", connected: [] } };
  });
