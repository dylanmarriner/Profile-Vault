import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { ProfileSnapshot } from "./model";
import { detectIde } from "./ideDetect";
import { resolveUserDir, userSettingsPath, userKeybindingsPath } from "./paths";

async function ensureDir(p: string) {
    await fs.mkdir(p, { recursive: true });
}

async function writeFileAtomic(target: string, data: Buffer) {
    await ensureDir(path.dirname(target));
    const tmp = `${target}.tmp-${Date.now()}`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
}

export async function applySnapshot(snapshot: ProfileSnapshot, applyToWorkspace: boolean) {
    const ide = detectIde();
    const userDir = resolveUserDir(ide);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // User files
    if (userDir) {
        const settings = snapshot.blobs.get("user/settings.json");
        if (settings) await writeFileAtomic(userSettingsPath(userDir), settings);

        const keys = snapshot.blobs.get("user/keybindings.json");
        if (keys) await writeFileAtomic(userKeybindingsPath(userDir), keys);

        for (const [logical, buf] of snapshot.blobs.entries()) {
            if (!logical.startsWith("user/snippets/")) continue;
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
            } else if (logical.startsWith("rules/")) {
                const rel = logical.substring("rules/".length).replaceAll("/", path.sep);
                await writeFileAtomic(path.join(workspaceRoot, rel), buf);
            }
        }
    }

    // Extensions install (best-effort)
    if (snapshot.manifest.extensions?.length) {
        for (const ext of snapshot.manifest.extensions) {
            if (ext.isBuiltin) continue;
            const existing = vscode.extensions.getExtension(ext.id);
            if (existing) continue;
            try {
                await vscode.commands.executeCommand("workbench.extensions.installExtension", ext.id);
            } catch {
                // swallow: marketplace/fork constraints
            }
        }
    }

    const choice = await vscode.window.showInformationMessage(
        "Profile applied. Reload window to activate settings/keybindings.",
        "Reload",
        "Later"
    );
    if (choice === "Reload") {
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
}
