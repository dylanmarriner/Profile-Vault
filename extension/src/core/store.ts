import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import * as crypto from "crypto";
import { ProfileListItem, ProfileManifest, ProfileSnapshot } from "./model";
import { encryptBytes, decryptBytes, EncryptedPayload } from "./crypto";

const SECRET_KEY_NAME = "profileVault.passphrase";

async function ensureDir(p: string) {
    await fs.mkdir(p, { recursive: true });
}

async function exists(p: string) {
    try { await fs.stat(p); return true; } catch { return false; }
}

async function readJson<T>(p: string): Promise<T> {
    const s = await fs.readFile(p, "utf8");
    try {
        return JSON.parse(s) as T;
    } catch (e) {
        throw new Error(`Failed to parse JSON from ${p}: ${String(e)}`);
    }
}

async function writeJson(p: string, obj: any) {
    await ensureDir(path.dirname(p));
    const tmp = `${p}.tmp-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
    await fs.rename(tmp, p);
}

export class ProfileStore {
    constructor(
        private ctx: vscode.ExtensionContext,
        private encryptLocalStore: boolean
    ) { }

    private baseDir() {
        return path.join(this.ctx.globalStorageUri.fsPath, "profiles");
    }

    private profileDir(id: string) {
        return path.join(this.baseDir(), id);
    }

    private manifestPath(id: string) {
        return path.join(this.profileDir(id), "manifest.json");
    }

    private blobsDir(id: string) {
        return path.join(this.profileDir(id), "blobs");
    }

    private blobFilePath(id: string, logicalPath: string) {
        // ensure safe path
        const safe = logicalPath.replaceAll("..", "__").replaceAll(":", "_");
        return path.join(this.blobsDir(id), safe);
    }

    async ensureReady() {
        await ensureDir(this.baseDir());
    }

    async getOrCreatePassphrase(): Promise<string> {
        const existing = await this.ctx.secrets.get(SECRET_KEY_NAME);
        if (existing) return existing;

        // Generate a random passphrase; user can rotate later via future UX if desired.
        const generated = cryptoRandomBase64(32);
        await this.ctx.secrets.store(SECRET_KEY_NAME, generated);
        return generated;
    }

    async list(): Promise<ProfileListItem[]> {
        await this.ensureReady();
        const dirs = await fs.readdir(this.baseDir(), { withFileTypes: true });
        const out: ProfileListItem[] = [];

        for (const d of dirs) {
            if (!d.isDirectory()) continue;
            const id = d.name;
            const mp = this.manifestPath(id);
            if (!(await exists(mp))) continue;

            try {
                const m = await readJson<ProfileManifest>(mp);
                out.push({
                    id: m.id,
                    name: m.name,
                    createdAt: m.createdAt,
                    ideFlavor: m.ide.flavor
                });
            } catch {
                // ignore corrupt
            }
        }

        out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return out;
    }

    async save(snapshot: ProfileSnapshot): Promise<void> {
        await this.ensureReady();
        const id = snapshot.manifest.id;
        await ensureDir(this.profileDir(id));
        await ensureDir(this.blobsDir(id));

        const passphrase = this.encryptLocalStore ? await this.getOrCreatePassphrase() : "";

        for (const [logical, buf] of snapshot.blobs.entries()) {
            const fp = this.blobFilePath(id, logical);
            await ensureDir(path.dirname(fp));

            if (this.encryptLocalStore) {
                const enc = encryptBytes(buf, passphrase);
                await writeJson(fp + ".enc.json", enc);
            } else {
                await fs.writeFile(fp, buf);
            }
        }

        await writeJson(this.manifestPath(id), snapshot.manifest);
    }

    async load(id: string): Promise<ProfileSnapshot> {
        const manifest = await readJson<ProfileManifest>(this.manifestPath(id));
        const blobs = new Map<string, Buffer>();

        const passphrase = this.encryptLocalStore ? await this.getOrCreatePassphrase() : "";

        // rebuild by reading manifest logical paths (authoritative)
        for (const f of manifest.files) {
            const logical = f.logicalPath;
            const fp = this.blobFilePath(id, logical);

            if (this.encryptLocalStore) {
                const encPath = fp + ".enc.json";
                const enc = await readJson<EncryptedPayload>(encPath);
                const plain = decryptBytes(enc, passphrase);
                blobs.set(logical, plain);
            } else {
                const plain = await fs.readFile(fp);
                blobs.set(logical, plain);
            }
        }

        return { manifest, blobs };
    }

    async delete(id: string): Promise<void> {
        const dir = this.profileDir(id);
        await fs.rm(dir, { recursive: true, force: true });
    }

    storageUri(): vscode.Uri {
        return this.ctx.globalStorageUri;
    }
}

function cryptoRandomBase64(bytes: number): string {
    return crypto.randomBytes(bytes).toString("base64");
}
