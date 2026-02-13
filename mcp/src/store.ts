import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

export type StoredProfile = {
    id: string;
    name: string;
    createdAt: string;
    zipBase64: string; // raw zip bytes
    manifestJson?: any; // optional cached manifest
};

async function ensureDir(p: string) {
    await fs.mkdir(p, { recursive: true });
}

export class ProfileStore {
    constructor(private dir: string) { }

    private file(id: string) {
        return path.join(this.dir, `${id}.json`);
    }

    async list() {
        await ensureDir(this.dir);
        const ents = await fs.readdir(this.dir, { withFileTypes: true });
        const out: Array<{ id: string; name: string; createdAt: string }> = [];
        for (const ent of ents) {
            if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
            try {
                const raw = JSON.parse(await fs.readFile(path.join(this.dir, ent.name), "utf8")) as StoredProfile;
                out.push({ id: raw.id, name: raw.name, createdAt: raw.createdAt });
            } catch (e) {
                // Skip corrupted profile files
                continue;
            }
        }
        out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return out;
    }

    async get(id: string): Promise<StoredProfile> {
        const p = this.file(id);
        try {
            const raw = JSON.parse(await fs.readFile(p, "utf8")) as StoredProfile;
            return raw;
        } catch (e) {
            throw new Error(`Failed to load profile ${id}: ${String(e)}`);
        }
    }

    async put(name: string, zipBase64: string, manifestJson?: any): Promise<string> {
        await ensureDir(this.dir);
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const payload: StoredProfile = { id, name, createdAt, zipBase64, manifestJson };
        await fs.writeFile(this.file(id), JSON.stringify(payload, null, 2), "utf8");
        return id;
    }
}
