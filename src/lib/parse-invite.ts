const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{6,64}$/;
const ROOM_KEY_REGEX = /^[a-zA-Z0-9_-]{16,128}$/;

function isValidRoomId(id: string): boolean {
    return ROOM_ID_REGEX.test(id);
}

function isValidRoomKey(key: string): boolean {
    return ROOM_KEY_REGEX.test(key);
}

export function parseInvite(input: string): { roomId: string | null; roomKey: string | null } {
    try {
        const trimmed = input.trim();
        if (!trimmed) return { roomId: null, roomKey: null };

        let roomId: string | null = null;
        let roomKey: string | null = null;

        // URL parsing
        if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.includes("?")) {
            try {
                const urlString = trimmed.startsWith("http")
                    ? trimmed
                    : `http://dummy.com/${trimmed.replace(/^\//, "")}`;

                const url = new URL(urlString);

                roomKey = url.searchParams.get("key");

                const parts = url.pathname.split("/").filter(Boolean);
                const roomIndex = parts.indexOf("room");

                if (roomIndex !== -1 && parts[roomIndex + 1]) {
                    roomId = parts[roomIndex + 1];
                } else if (parts.length > 0) {
                    roomId = parts[parts.length - 1];
                }
            } catch { }
        }

        // VEL code parsing (only if URL parsing didn't work)
        if (!roomId && trimmed.startsWith("VEL-")) {
            const parts = trimmed.slice(4).split("-");

            if (parts.length >= 2) {
                roomKey = parts.pop()!;
                roomId = parts.join("-");
            }
        }

        // Colon format parsing
        if (!roomId && trimmed.includes(":")) {
            const [id, key] = trimmed.split(":");
            roomId = id;
            roomKey = key || null;
        }

        // Raw ID fallback
        if (!roomId) {
            roomId = trimmed.split("?")[0].split("#")[0];
        }

        // Validate
        if (!roomId || !isValidRoomId(roomId)) {
            return { roomId: null, roomKey: null };
        }

        if (roomKey && !isValidRoomKey(roomKey)) {
            return { roomId: null, roomKey: null };
        }

        return { roomId, roomKey };

    } catch {
        return { roomId: null, roomKey: null };
    }
}
