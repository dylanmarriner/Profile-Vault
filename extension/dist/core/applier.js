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
exports.applySnapshot = applySnapshot;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const ideDetect_1 = require("./ideDetect");
const paths_1 = require("./paths");
async function ensureDir(p) {
    await fs.mkdir(p, { recursive: true });
}
async function writeFileAtomic(target, data) {
    await ensureDir(path.dirname(target));
    const tmp = `${target}.tmp-${Date.now()}`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
}
async function applySnapshot(snapshot, applyToWorkspace) {
    const ide = (0, ideDetect_1.detectIde)();
    const userDir = (0, paths_1.resolveUserDir)(ide);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    // User files
    if (userDir) {
        const settings = snapshot.blobs.get("user/settings.json");
        if (settings)
            await writeFileAtomic((0, paths_1.userSettingsPath)(userDir), settings);
        const keys = snapshot.blobs.get("user/keybindings.json");
        if (keys)
            await writeFileAtomic((0, paths_1.userKeybindingsPath)(userDir), keys);
        for (const [logical, buf] of snapshot.blobs.entries()) {
            if (!logical.startsWith("user/snippets/"))
                continue;
            const rel = logical.substring("user/snippets/".length).replaceAll("/", path.sep);
            await writeFileAtomic(path.join(userDir, "snippets", rel), buf);
        }
    }
    // Workspace files
    if (applyToWorkspace && workspaceRoot) {
        for (const [logical, buf] of snapshot.blobs.entries()) {
            if (logical.startsWith("workspace/")) {
                const rel = logical.substring("workspace/".length).replaceAll("/", path.sep);
                await writeFileAtomic(path.join(workspaceRoot, rel), buf);
            }
            else if (logical.startsWith("rules/")) {
                const rel = logical.substring("rules/".length).replaceAll("/", path.sep);
                await writeFileAtomic(path.join(workspaceRoot, rel), buf);
            }
        }
    }
    // Extensions install (best-effort)
    if (snapshot.manifest.extensions?.length) {
        for (const ext of snapshot.manifest.extensions) {
            if (ext.isBuiltin)
                continue;
            const existing = vscode.extensions.getExtension(ext.id);
            if (existing)
                continue;
            try {
                await vscode.commands.executeCommand("workbench.extensions.installExtension", ext.id);
            }
            catch {
                // swallow: marketplace/fork constraints
            }
        }
    }
    const choice = await vscode.window.showInformationMessage("Profile applied. Reload window to activate settings/keybindings.", "Reload", "Later");
    if (choice === "Reload") {
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
}
