import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import fg from "fast-glob";
import { detectIde } from "./ideDetect";
import { resolveUserDir, userSettingsPath, userKeybindingsPath, userSnippetsDir } from "./paths";
import { ProfileSnapshot } from "./model";
import { redactIfText, RedactionConfig } from "./redaction";

type CollectOptions = {
    name: string;
    includeUser: boolean;
    includeWorkspace: boolean;
    includeRulesWorkflows: boolean;
    includeExtensions: boolean;
    ruleGlobs: string[];
    redaction: RedactionConfig;
};

function sha256(buf: Buffer) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

async function readFileIfExists(p: string): Promise<Buffer | null> {
    try { return await fs.readFile(p); } catch { return null; }
}

async function* walkDir(dir: string): AsyncGenerator<string> {
    let ents: any[];
    try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of ents) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) yield* walkDir(full);
        else if (ent.isFile()) yield full;
    }
}

export async function collectSnapshot(opts: CollectOptions): Promise<ProfileSnapshot> {
    const ide = detectIde();
    const userDir = resolveUserDir(ide);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const blobs = new Map<string, Buffer>();
    const files: { logicalPath: string; sha256: string; bytes: number }[] = [];

    async function addBlob(logicalPath: string, raw: Buffer) {
        const buf = redactIfText(logicalPath, raw, opts.redaction);
        blobs.set(logicalPath, buf);
        files.push({ logicalPath, sha256: sha256(buf), bytes: buf.byteLength });
    }

    // User settings/keybindings/snippets
    if (opts.includeUser && userDir) {
        const s = await readFileIfExists(userSettingsPath(userDir));
        if (s) await addBlob("user/settings.json", s);

        const k = await readFileIfExists(userKeybindingsPath(userDir));
        if (k) await addBlob("user/keybindings.json", k);

        const snipDir = userSnippetsDir(userDir);
        for await (const f of walkDir(snipDir)) {
            const rel = path.relative(snipDir, f).replaceAll("\\", "/");
            const b = await readFileIfExists(f);
            if (b) await addBlob(`user/snippets/${rel}`, b);
        }
    }

    // Workspace .vscode/*
    if (opts.includeWorkspace && workspaceRoot) {
        const vscodeDir = path.join(workspaceRoot, ".vscode");
        for await (const f of walkDir(vscodeDir)) {
            const rel = path.relative(workspaceRoot, f).replaceAll("\\", "/");
            const b = await readFileIfExists(f);
            if (b) await addBlob(`workspace/${rel}`, b);
        }
    }

    // Rules/workflows: known set + globs
    if (opts.includeRulesWorkflows && workspaceRoot) {
        const known = [
            ".windsurfrules",
            ".cursorrules",
            ".antigravity",
            ".windsurf"
        ];

        for (const k of known) {
            const p = path.join(workspaceRoot, k);
            try {
                const st = await fs.stat(p);
                if (st.isFile()) {
                    const b = await fs.readFile(p);
                    await addBlob(`rules/${k.replaceAll("\\", "/")}`, b);
                } else if (st.isDirectory()) {
                    for await (const f of walkDir(p)) {
                        const rel = path.relative(workspaceRoot, f).replaceAll("\\", "/");
                        const b = await readFileIfExists(f);
                        if (b) await addBlob(`rules/${rel}`, b);
                    }
                }
            } catch {
                // ignore
            }
        }

        // globs (workspace-relative)
        const matches = await fg(opts.ruleGlobs, {
            cwd: workspaceRoot,
            dot: true,
            onlyFiles: true,
            unique: true,
            suppressErrors: true,
            followSymbolicLinks: false
        });

        for (const rel of matches) {
            const p = path.join(workspaceRoot, rel);
            const b = await readFileIfExists(p);
            if (!b) continue;
            await addBlob(`rules/${rel.replaceAll("\\", "/")}`, b);
        }
    }

    // Extensions list
    const extensions = opts.includeExtensions
        ? vscode.extensions.all.map(ext => ({
            id: `${ext.id}`,
            version: ext.packageJSON?.version as string | undefined,
            isBuiltin: !!ext.packageJSON?.isBuiltin
        }))
        : undefined;

    const manifest = {
        schemaVersion: 1 as const,
        id,
        name: opts.name,
        createdAt,
        ide: { flavor: ide, appName: vscode.env.appName, vscodeVersion: vscode.version },
        machine: { platform: process.platform, arch: process.arch },
        includes: {
            userSettings: opts.includeUser,
            userKeybindings: opts.includeUser,
            userSnippets: opts.includeUser,
            workspaceVscodeDir: opts.includeWorkspace,
            rulesAndWorkflows: opts.includeRulesWorkflows,
            extensions: opts.includeExtensions
        },
        paths: { userDir, workspaceRoot },
        extensions,
        files
    };

    return { manifest, blobs };
}
