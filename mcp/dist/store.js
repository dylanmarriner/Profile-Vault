import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
async function ensureDir(p) {
    await fs.mkdir(p, { recursive: true });
}
export class ProfileStore {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    file(id) {
        return path.join(this.dir, `${id}.json`);
    }
    async list() {
        await ensureDir(this.dir);
        const ents = await fs.readdir(this.dir, { withFileTypes: true });
        const out = [];
        for (const ent of ents) {
            if (!ent.isFile() || !ent.name.endsWith(".json"))
                continue;
            try {
                const raw = JSON.parse(await fs.readFile(path.join(this.dir, ent.name), "utf8"));
                out.push({ id: raw.id, name: raw.name, createdAt: raw.createdAt });
            }
            catch (e) {
                // Skip corrupted profile files
                continue;
            }
        }
        out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return out;
    }
    async get(id) {
        const p = this.file(id);
        try {
            const raw = JSON.parse(await fs.readFile(p, "utf8"));
            return raw;
        }
        catch (e) {
            throw new Error(`Failed to load profile ${id}: ${String(e)}`);
        }
    }
    async put(name, zipBase64, manifestJson) {
        await ensureDir(this.dir);
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const payload = { id, name, createdAt, zipBase64, manifestJson };
        await fs.writeFile(this.file(id), JSON.stringify(payload, null, 2), "utf8");
        return id;
    }
}
