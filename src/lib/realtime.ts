import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { redis } from "@/lib/redis";
import z from "zod";

const message = z.object({
  id: z.string(),
  sender: z.string(),
  text: z.string(),
  timestamp: z.number(),
  roomId: z.string(),
  token: z.string().optional(),
});

const schema = {
  chat: {
    message,
    destroy: z.object({
      isDestroyed: z.literal(true),
    }),
    // Typing indicator event
    typing: z.object({
      sender: z.string(),
      isTyping: z.boolean(),
    }),
    // Join/Leave notification events
    join: z.object({
      sender: z.string(),
    }),
    leave: z.object({
      sender: z.string(),
    }),
  },
};

export const realtime = new Realtime({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
export type Message = z.infer<typeof message>
