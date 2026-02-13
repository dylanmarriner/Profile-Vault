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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectSnapshot = collectSnapshot;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const ideDetect_1 = require("./ideDetect");
const paths_1 = require("./paths");
const redaction_1 = require("./redaction");
function sha256(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}
async function readFileIfExists(p) {
    try {
        return await fs.readFile(p);
    }
    catch {
        return null;
    }
}
async function* walkDir(dir) {
    let ents;
    try {
        ents = await fs.readdir(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const ent of ents) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory())
            yield* walkDir(full);
        else if (ent.isFile())
            yield full;
    }
}
async function collectSnapshot(opts) {
    const ide = (0, ideDetect_1.detectIde)();
    const userDir = (0, paths_1.resolveUserDir)(ide);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const blobs = new Map();
    const files = [];
    async function addBlob(logicalPath, raw) {
        const buf = (0, redaction_1.redactIfText)(logicalPath, raw, opts.redaction);
        blobs.set(logicalPath, buf);
        files.push({ logicalPath, sha256: sha256(buf), bytes: buf.byteLength });
    }
    // User settings/keybindings/snippets
    if (opts.includeUser && userDir) {
        const s = await readFileIfExists((0, paths_1.userSettingsPath)(userDir));
        if (s)
            await addBlob("user/settings.json", s);
        const k = await readFileIfExists((0, paths_1.userKeybindingsPath)(userDir));
        if (k)
            await addBlob("user/keybindings.json", k);
        const snipDir = (0, paths_1.userSnippetsDir)(userDir);
        for await (const f of walkDir(snipDir)) {
            const rel = path.relative(snipDir, f).replaceAll("\\", "/");
            const b = await readFileIfExists(f);
            if (b)
                await addBlob(`user/snippets/${rel}`, b);
        }
    }
    // Workspace .vscode/*
    if (opts.includeWorkspace && workspaceRoot) {
        const vscodeDir = path.join(workspaceRoot, ".vscode");
        for await (const f of walkDir(vscodeDir)) {
            const rel = path.relative(workspaceRoot, f).replaceAll("\\", "/");
            const b = await readFileIfExists(f);
            if (b)
                await addBlob(`workspace/${rel}`, b);
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
                }
                else if (st.isDirectory()) {
                    for await (const f of walkDir(p)) {
                        const rel = path.relative(workspaceRoot, f).replaceAll("\\", "/");
                        const b = await readFileIfExists(f);
                        if (b)
                            await addBlob(`rules/${rel}`, b);
                    }
                }
            }
            catch {
                // ignore
            }
        }
        // globs (workspace-relative)
        const matches = await (0, fast_glob_1.default)(opts.ruleGlobs, {
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
            if (!b)
                continue;
            await addBlob(`rules/${rel.replaceAll("\\", "/")}`, b);
        }
    }
    // Extensions list
    const extensions = opts.includeExtensions
        ? vscode.extensions.all.map(ext => ({
            id: `${ext.id}`,
            version: ext.packageJSON?.version,
            isBuiltin: !!ext.packageJSON?.isBuiltin
        }))
        : undefined;
    const manifest = {
        schemaVersion: 1,
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
