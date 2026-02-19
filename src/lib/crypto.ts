
// Web Crypto API implementation for E2EE

// Configuration constants
const ALGORITHM_NAME = "AES-GCM";
const KEY_DERIVATION_ALGORITHM = "PBKDF2";
const HASH_ALGORITHM = "SHA-256";
const ITERATIONS = 150000;
const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 12; // bytes
const KEY_LENGTH = 256; // bits

/**
 * Generates a cryptographically secure random salt.
 * @returns Base64 encoded salt string
 */
export function generateSalt(): string {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    return arrayBufferToBase64(salt);
}

/**
 * Derives an AES-GCM encryption key from a room key and salt using PBKDF2.
 * @param roomKey The shared room secret key
 * @param saltBase64 The base64 encoded salt unique to the room
 * @returns Promise resolving to a CryptoKey
 */
export async function getDerivedKey(roomKey: string, saltBase64: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(roomKey) as any,
        { name: KEY_DERIVATION_ALGORITHM },
        false,
        ["deriveKey"]
    );

    const salt = base64ToArrayBuffer(saltBase64);

    return crypto.subtle.deriveKey(
        {
            name: KEY_DERIVATION_ALGORITHM,
            salt: salt as any,
            iterations: ITERATIONS,
            hash: HASH_ALGORITHM,
        },
        keyMaterial,
        { name: ALGORITHM_NAME, length: KEY_LENGTH },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a text message using AES-GCM.
 * @param text The plaintext message
 * @param key The derived CryptoKey
 * @returns Promise resolving to "base64(iv):base64(ciphertext)"
 */
export async function encryptMessage(text: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: ALGORITHM_NAME,
            iv: iv as any,
        },
        key,
        data
    );

    const ivBase64 = arrayBufferToBase64(iv);
    const ciphertextBase64 = arrayBufferToBase64(new Uint8Array(encrypted));

    return `${ivBase64}:${ciphertextBase64}`;
}

/**
 * Decrypts a message using AES-GCM.
 * @param encryptedData The "base64(iv):base64(ciphertext)" string
 * @param key The derived CryptoKey
 * @returns Promise resolving to the plaintext string
 */
export async function decryptMessage(encryptedData: string, key: CryptoKey): Promise<string> {
    try {
        const [ivBase64, ciphertextBase64] = encryptedData.split(":");
        if (!ivBase64 || !ciphertextBase64) {
            throw new Error("Invalid encrypted data format");
        }

        const iv = base64ToArrayBuffer(ivBase64);
        const ciphertext = base64ToArrayBuffer(ciphertextBase64);

        const decrypted = await crypto.subtle.decrypt(
            {
                name: ALGORITHM_NAME,
                iv: iv as any,
            },
            key,
            ciphertext as any
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        console.error("Decryption failed:", error);
        return "[Decryption Error]"; // Fallback for invalid keys/data
    }
}

// Utility functions for Base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}
