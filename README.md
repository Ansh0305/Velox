# ⚡ Velox

**A private, self-destructing real-time chat application.**

Create anonymous, encrypted chat rooms that automatically destroy themselves — along with every message — when the timer runs out. No accounts. No logs. No trace.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)
![Upstash](https://img.shields.io/badge/Upstash-Redis-00E9A3?logo=redis)

---

## ✨ Features

- **🔒 Self-Destructing Rooms** — Choose a 2, 5, or 10-minute timer. When it hits zero, the room and all messages are permanently erased.
- **👻 Anonymous Identities** — Auto-generated anonymous usernames (`anonymous-wolf-x3k9a`). No signup required.
- **⚡ Real-Time Messaging** — Powered by Upstash Realtime for instant message delivery.
- **✍️ Typing Indicators** — See when the other person is typing, in real-time.
- **🚪 Presence Notifications** — Join/leave events are broadcast to all participants.
- **📋 Room Sharing** — Share the room code with anyone to let them join instantly.
- **💥 Instant Destroy** — Manually nuke the room at any time. All data is wiped immediately.
- **🍪 Token-Based Auth** — Cookie-based session tokens validate room membership per-request.

---

## 🛠️ Tech Stack

| Layer        | Technology                                                          |
| ------------ | ------------------------------------------------------------------- |
| **Framework**    | [Next.js 16](https://nextjs.org) (App Router)                      |
| **Language**     | [TypeScript](https://www.typescriptlang.org)                       |
| **Styling**      | [Tailwind CSS v4](https://tailwindcss.com)                         |
| **API**          | [Elysia](https://elysiajs.com) (type-safe API with Eden client)   |
| **Database**     | [Upstash Redis](https://upstash.com) (serverless, with TTL expiry) |
| **Realtime**     | [Upstash Realtime](https://upstash.com/docs/redis/sdks/ts/realtime)|
| **Data Fetching**| [TanStack Query](https://tanstack.com/query)                       |
| **Font**         | [JetBrains Mono](https://www.jetbrains.com/lp/mono/)              |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- [npm](https://www.npmjs.com/) (or yarn / pnpm / bun)
- An [Upstash](https://upstash.com) Redis database

### 1. Clone the repository

```bash
git clone https://github.com/Ansh0305/Velox.git
cd Velox
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start chatting.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/              # Elysia API routes (rooms, messages, presence, typing)
│   │   ├── [[...slugs]]/ # Catch-all API handler + auth middleware
│   │   └── realtime/     # Upstash Realtime SSE endpoint
│   ├── room/[roomId]/    # Chat room page
│   ├── page.tsx          # Lobby — create or join rooms
│   ├── layout.tsx        # Root layout with metadata & providers
│   └── globals.css       # Global styles & animations
├── components/
│   └── providers.tsx     # TanStack Query provider
├── hooks/
│   └── use-username.ts   # Anonymous username generation & persistence
├── lib/
│   ├── client.ts         # Elysia Eden type-safe API client
│   ├── redis.ts          # Upstash Redis instance
│   ├── realtime.ts       # Server-side realtime helper
│   └── realtime-client.ts# Client-side realtime hook
└── proxy.ts              # API proxy utility
```

---

## 🔐 How It Works

```
┌─────────────┐       ┌──────────────┐       ┌─────────────────┐
│   Browser    │──────▶│  Next.js API │──────▶│  Upstash Redis  │
│  (React UI)  │◀──────│  (Elysia)    │◀──────│  (TTL-based)    │
└─────────────┘  SSE  └──────────────┘       └─────────────────┘
                 via Upstash Realtime
```

1. **Create** — A room is created in Redis with a TTL (time-to-live). A unique room ID is generated via `nanoid`.
2. **Join** — Users navigate to `/room/{id}`. A session token is stored in a cookie and validated on every API call.
3. **Chat** — Messages are stored in Redis and broadcast to all connected clients via Upstash Realtime (SSE).
4. **Self-Destruct** — When the Redis TTL expires, the key is automatically deleted. The room, messages, and all metadata vanish.
5. **Manual Destroy** — Any participant can trigger instant destruction, wiping all data immediately.

---

## �️ Roadmap

Features that can be implemented in the future:

- [ ] **Media Sharing** — Send images, files, and voice notes that self-destruct with the room.
- [ ] **Custom Room Codes** — Let users pick a memorable room code instead of a random ID.
- [ ] **Password-Protected Rooms** — Require a passphrase to join a room.
- [ ] **Read Receipts** — Show when a message has been seen by the other participant.
- [ ] **Message Reactions** — React to messages with emojis.
- [ ] **Dark/Light Theme Toggle** — User-selectable theme preference.
- [ ] **Room Capacity Settings** — Allow the room creator to set a max participant limit (currently 2).
- [ ] **Markdown Support** — Render messages with bold, italic, code blocks, and links.
- [ ] **Mobile PWA** — Installable progressive web app with push notifications.
- [ ] **QR Code Sharing** — Generate a QR code for easy room joining on mobile.
- [ ] **Sound Notifications** — Audio alerts for new messages and room events.
- [ ] **Link Previews** — Automatically preview URLs shared in the chat.
- [ ] **Multi-Language Support** — i18n for global accessibility.

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ⚡ by <a href="https://github.com/Ansh0305">Sirigiri Sai Ansh Raj</a>
</p>
