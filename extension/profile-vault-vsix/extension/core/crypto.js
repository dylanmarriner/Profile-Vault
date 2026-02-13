"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveKey = deriveKey;
exports.encryptBytes = encryptBytes;
exports.decryptBytes = decryptBytes;
const crypto = __importStar(require("crypto"));
const PBKDF2_ITERS = 200_000;
const KEY_LEN = 32;
function b64(b) { return b.toString("base64"); }
function unb64(s) { return Buffer.from(s, "base64"); }
function deriveKey(passphrase, salt) {
    return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERS, KEY_LEN, "sha256");
}
function encryptBytes(plain, passphrase) {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(passphrase, salt);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { v: 1, salt: b64(salt), iv: b64(iv), tag: b64(tag), data: b64(enc) };
}
function decryptBytes(payload, passphrase) {
    if (payload.v !== 1)
        throw new Error("Unsupported encryption payload version");
    const salt = unb64(payload.salt);
    const key = deriveKey(passphrase, salt);
    const iv = unb64(payload.iv);
    const tag = unb64(payload.tag);
    const data = unb64(payload.data);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}
