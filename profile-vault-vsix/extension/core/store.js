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
exports.ProfileStore = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const crypto = __importStar(require("crypto"));
const crypto_1 = require("./crypto");
const SECRET_KEY_NAME = "profileVault.passphrase";
async function ensureDir(p) {
    await fs.mkdir(p, { recursive: true });
}
async function exists(p) {
    try {
        await fs.stat(p);
        return true;
    }
    catch {
        return false;
    }
}
async function readJson(p) {
    const s = await fs.readFile(p, "utf8");
    try {
        return JSON.parse(s);
    }
    catch (e) {
        throw new Error(`Failed to parse JSON from ${p}: ${String(e)}`);
    }
}
async function writeJson(p, obj) {
    await ensureDir(path.dirname(p));
    const tmp = `${p}.tmp-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
    await fs.rename(tmp, p);
}
class ProfileStore {
    ctx;
    encryptLocalStore;
    constructor(ctx, encryptLocalStore) {
        this.ctx = ctx;
        this.encryptLocalStore = encryptLocalStore;
    }
    baseDir() {
        return path.join(this.ctx.globalStorageUri.fsPath, "profiles");
    }
    profileDir(id) {
        return path.join(this.baseDir(), id);
    }
    manifestPath(id) {
        return path.join(this.profileDir(id), "manifest.json");
    }
    blobsDir(id) {
        return path.join(this.profileDir(id), "blobs");
    }
    blobFilePath(id, logicalPath) {
        // ensure safe path
        const safe = logicalPath.replaceAll("..", "__").replaceAll(":", "_");
        return path.join(this.blobsDir(id), safe);
    }
    async ensureReady() {
        await ensureDir(this.baseDir());
    }
    async getOrCreatePassphrase() {
        const existing = await this.ctx.secrets.get(SECRET_KEY_NAME);
        if (existing)
            return existing;
        // Generate a random passphrase; user can rotate later via future UX if desired.
        const generated = cryptoRandomBase64(32);
        await this.ctx.secrets.store(SECRET_KEY_NAME, generated);
        return generated;
    }
    async list() {
        await this.ensureReady();
        const dirs = await fs.readdir(this.baseDir(), { withFileTypes: true });
        const out = [];
        for (const d of dirs) {
            if (!d.isDirectory())
                continue;
            const id = d.name;
            const mp = this.manifestPath(id);
            if (!(await exists(mp)))
                continue;
            try {
                const m = await readJson(mp);
                out.push({
                    id: m.id,
                    name: m.name,
                    createdAt: m.createdAt,
                    ideFlavor: m.ide.flavor
                });
            }
            catch {
                // ignore corrupt
            }
        }
        out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return out;
    }
    async save(snapshot) {
        await this.ensureReady();
        const id = snapshot.manifest.id;
        await ensureDir(this.profileDir(id));
        await ensureDir(this.blobsDir(id));
        const passphrase = this.encryptLocalStore ? await this.getOrCreatePassphrase() : "";
        for (const [logical, buf] of snapshot.blobs.entries()) {
            const fp = this.blobFilePath(id, logical);
            await ensureDir(path.dirname(fp));
            if (this.encryptLocalStore) {
                const enc = (0, crypto_1.encryptBytes)(buf, passphrase);
                await writeJson(fp + ".enc.json", enc);
            }
            else {
                await fs.writeFile(fp, buf);
            }
        }
        await writeJson(this.manifestPath(id), snapshot.manifest);
    }
    async load(id) {
        const manifest = await readJson(this.manifestPath(id));
        const blobs = new Map();
        const passphrase = this.encryptLocalStore ? await this.getOrCreatePassphrase() : "";
        // rebuild by reading manifest logical paths (authoritative)
        for (const f of manifest.files) {
            const logical = f.logicalPath;
            const fp = this.blobFilePath(id, logical);
            if (this.encryptLocalStore) {
                const encPath = fp + ".enc.json";
                const enc = await readJson(encPath);
                const plain = (0, crypto_1.decryptBytes)(enc, passphrase);
                blobs.set(logical, plain);
            }
            else {
                const plain = await fs.readFile(fp);
                blobs.set(logical, plain);
            }
        }
        return { manifest, blobs };
    }
    async delete(id) {
        const dir = this.profileDir(id);
        await fs.rm(dir, { recursive: true, force: true });
    }
    storageUri() {
        return this.ctx.globalStorageUri;
    }
}
exports.ProfileStore = ProfileStore;
function cryptoRandomBase64(bytes) {
    return crypto.randomBytes(bytes).toString("base64");
}
