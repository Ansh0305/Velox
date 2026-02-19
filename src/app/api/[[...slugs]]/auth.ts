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
    const token = cookie["x-auth-token"]?.value as string | undefined;

    // Headers can be incoming in different formats depending on the environment
    const headerKey = (headers as Record<string, any>)["x-room-key"];
    const roomKey = (headerKey || query.key) as string | undefined;

    if (!roomId || !token || !roomKey) {
      console.error("Missing auth params:", { roomId, hasToken: !!token, hasKey: !!roomKey });
      throw new AuthError("Missing roomId, token, or roomKey.");
    }

    const meta = await redis.hgetall<{ connected: string[], key: string }>(`meta:${roomId}`);

    if (!meta) {
      throw new AuthError("Room not found");
    }

    if (meta.key !== roomKey) {
      throw new AuthError("Invalid room key");
    }

    // Ensure connected is an array of strings
    const connected = Array.isArray(meta.connected) ? meta.connected : [];

    if (!connected.includes(token)) {
      throw new AuthError("Invalid token");
    }

    return { auth: { roomId, token, connected } };
  });
