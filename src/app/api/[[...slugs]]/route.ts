import { redis } from "@/lib/redis";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { authMiddleware } from "./auth";
import { z } from "zod";
import { Message, realtime } from "@/lib/realtime";

const ROOM_TTL_SECONDS = 60 * 10;
// Allowed self-destruct timer options (in seconds)
const ALLOWED_TTL = [60 * 2, 60 * 5, 60 * 10];

const rooms = new Elysia({ prefix: "/room" })
  .post("/create", async ({ body }) => {
    const roomId = nanoid();

    // Custom TTL from body, fallback to default
    const ttl = body?.ttl && ALLOWED_TTL.includes(body.ttl) ? body.ttl : ROOM_TTL_SECONDS;

    await redis.hset(`meta:${roomId}`, {
      connected: [],
      createAt: Date.now(),
    });

    await redis.expire(`meta:${roomId}`, ttl);
    return { roomId };
  }, {
    body: z.object({ ttl: z.number().optional() }).optional(),
  })
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    {
      query: z.object({ roomId: z.string() }),
    },
  )
  .delete("/", async ({ auth }) => {
    await realtime
      .channel(auth.roomId)
      .emit("chat.destroy", { isDestroyed: true });
    await Promise.all([
      redis.del(auth.roomId),
      redis.del(`meta:${auth.roomId}`),
      redis.del(`messages:${auth.roomId}`),
    ])
  }, {
    query: z.object({ roomId: z.string() })
  });

const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text } = body;
      const { roomId } = auth;
      const roomExits = await redis.exists(`meta:${roomId}`);

      if (!roomExits) {
        throw new Error("Room does not exist!");
      }

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      };

      // message history
      await redis.rpush(`messages:${roomId}`, {
        ...message,
        token: auth.token,
      });
      await realtime.channel(roomId).emit("chat.message", message);

      // Expiration
      const remaining = await redis.ttl(`meta:${roomId}`);
      await redis.expire(`messages:${roomId}`, remaining);
      await redis.expire(`history:${roomId}`, remaining);
      await redis.expire(roomId, remaining);
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000),
      }),
    },
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(
        `messages:${auth.roomId}`,
        0,
        -1,
      );

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      };
    },
    { query: z.object({ roomId: z.string() }) },
  );

// Typing indicator
const typing = new Elysia({ prefix: "/typing" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      await realtime
        .channel(auth.roomId)
        .emit("chat.typing", { sender: body.sender, isTyping: true });
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({ sender: z.string().max(100) }),
    },
  );

// Presence (join/leave notifications)
const presence = new Elysia({ prefix: "/presence" })
  .use(authMiddleware)
  .post(
    "/join",
    async ({ body, auth }) => {
      await realtime
        .channel(auth.roomId)
        .emit("chat.join", { sender: body.sender });
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({ sender: z.string().max(100) }),
    },
  )
  .post(
    "/leave",
    async ({ body, auth }) => {
      await realtime
        .channel(auth.roomId)
        .emit("chat.leave", { sender: body.sender });
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({ sender: z.string().max(100) }),
    },
  );

const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages).use(typing).use(presence);

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;


export type App = typeof app;
