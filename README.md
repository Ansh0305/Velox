# ⚡ Velox

**Zero-Knowledge, End-to-End Encrypted, Self-Destructing Chat.**

Velox is a secure communication tool designed for absolute privacy. Rooms are ephemeral, identities are anonymous, and messages are encrypted on your device before they ever touch our servers. We cannot read your messages even if we wanted to.

![E2E Encrypted](https://img.shields.io/badge/Security-E2E_Encrypted-green?logo=letsencrypt)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)
![Upstash](https://img.shields.io/badge/Upstash-Redis-00E9A3?logo=redis)

---

## ✨ Features

- **🔒 End-to-End Encryption (E2EE)** — Messages are encrypted with AES-GCM (256-bit) using a key derived from the room invite. The server only stores ciphertext.
- **💣 Self-Destructing Rooms** — Set a timer (2, 5, or 10 minutes). When it expires, the room and all data are permanently wiped from Redis.
- **👻 Truly Anonymous** — No accounts, no emails, no logs. auto-generated identities (e.g., `anonymous-wolf`).
- **🛡️ IDOR-Proof Access Control** — Access is strictly controlled via cryptographically secure keys. Knowing a Room ID is not enough to join.
- **⚡ Real-Time** — Instant message delivery via Upstash Realtime (Server-Sent Events).
- **📋 Smart Invites** — Share a single link that contains the secure key. Special `VEL-` codes allow safe manual entry.

---

## 🔐 Security Architecture

Velox follows a **Zero-Knowledge** architecture. Here is how we secure your data:

1.  **Room Creation**:
    *   The server generates a `RoomID` (nanoid) and a cryptographically secure, random 32-character `RoomKey`.
    *   The server also generates a unique random `Salt`.
    *   The `RoomKey` is sent **only** to the creator. The server stores a hash/metadata but does NOT use this key for encryption.

2.  **Joining**:
    *   To join, you must possess the `RoomKey` (embedded in the link or invite code).
    *   The browser requests the `Salt` from the server using the `RoomKey` for authentication.
    *   **Client-Side Derivation**: Your browser uses PBKDF2 (150,000 iterations) to mix the `RoomKey` + `Salt` into a **derived Encryption Key**.
    *   This Encryption Key **never leaves your device**.

3.  **Messaging**:
    *   **Encryption**: Messages are encrypted locally using AES-GCM with a unique, random 12-byte IV (Initialization Vector) for *every* message.
    *   **Transport**: The server receives only `iv:ciphertext`. It cannot decrypt this.
    *   **Decryption**: Other participants (who also derived the key client-side) decrypt the message locally.

---

## 🛠️ Tech Stack

| Layer        | Technology                                                          |
| ------------ | ------------------------------------------------------------------- |
| **Framework**    | [Next.js 16](https://nextjs.org) (App Router)                      |
| **Language**     | [TypeScript](https://www.typescriptlang.org)                       |
| **Security**     | [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (Native Browser Encryption)|
| **API**          | [Elysia](https://elysiajs.com) (Type-safe API backend)             |
| **Database**     | [Upstash Redis](https://upstash.com) (Serverless, TTL expiry)      |
| **Realtime**     | [Upstash Realtime](https://upstash.com) (SSE)                      |
| **Styling**      | [Tailwind CSS v4](https://tailwindcss.com)                         |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
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
# Optional: Public URL for copy-link feature in production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to create your first secure room.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/              # Elysia Backend
│   │   ├── [[...slugs]]/ # API Router + E2EE Auth Middleware
│   │   └── realtime/     # SSE Endpoint
│   ├── room/[roomId]/    # Secure Chat Room (Decryption logic here)
│   └── page.tsx          # Lobby & Join Flow
├── lib/
│   ├── crypto.ts         # CORE: AES-GCM & PBKDF2 logic
│   ├── parse-invite.ts   # Secure link parsing utility
│   ├── redis.ts          # DB Connection
│   └── realtime.ts       # SSE Helper
└── proxy.ts              # Middleware for route protection
```

---

## ️ Roadmap

- [ ] **Secure File Sharing** — Encrypted blob storage for images.
- [ ] **Burn-on-Read** — Option for messages to disappear immediately after being viewed.
- [ ] **Voice Notes** — Encrypted audio blobs.
- [ ] **QR Code Invites** — Scan to join instantly on mobile.

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ⚡ & 🔒 by <a href="https://github.com/Ansh0305">Sirigiri Sai Ansh Raj</a>
</p>
