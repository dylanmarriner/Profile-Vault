import * as crypto from "crypto";

export type EncryptedPayload = {
    v: 1;
    salt: string; // base64
    iv: string;   // base64
    tag: string;  // base64
    data: string; // base64
};

const PBKDF2_ITERS = 200_000;
const KEY_LEN = 32;

function b64(b: Buffer) { return b.toString("base64"); }
function unb64(s: string) { return Buffer.from(s, "base64"); }

export function deriveKey(passphrase: string, salt: Buffer) {
    return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERS, KEY_LEN, "sha256");
}

export function encryptBytes(plain: Buffer, passphrase: string): EncryptedPayload {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(passphrase, salt);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();

    return { v: 1, salt: b64(salt), iv: b64(iv), tag: b64(tag), data: b64(enc) };
}

export function decryptBytes(payload: EncryptedPayload, passphrase: string): Buffer {
    if (payload.v !== 1) throw new Error("Unsupported encryption payload version");
    const salt = unb64(payload.salt);
    const key = deriveKey(passphrase, salt);
    const iv = unb64(payload.iv);
    const tag = unb64(payload.tag);
    const data = unb64(payload.data);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}
