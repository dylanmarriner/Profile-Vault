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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const collector_1 = require("./core/collector");
const applier_1 = require("./core/applier");
const store_1 = require("./core/store");
const diff_1 = require("./core/diff");
const zip_1 = require("./core/zip");
const crypto_1 = require("./core/crypto");
const quickpick_1 = require("./ui/quickpick");
const log_1 = require("./ui/log");
async function activate(ctx) {
    const log = new log_1.Log();
    const cfg = () => vscode.workspace.getConfiguration("profileVault");
    const store = new store_1.ProfileStore(ctx, !!cfg().get("crypto.encryptLocalStore"));
    await store.ensureReady();
    ctx.subscriptions.push(vscode.commands.registerCommand("profileVault.capture", async () => {
        try {
            const name = await vscode.window.showInputBox({
                prompt: "Profile name",
                value: `Profile ${new Date().toLocaleString()}`
            });
            if (!name)
                return;
            const includeUser = !!cfg().get("capture.includeUser");
            const includeWorkspace = !!cfg().get("capture.includeWorkspace");
            const includeRulesWorkflows = !!cfg().get("capture.includeRulesWorkflows");
            const includeExtensions = !!cfg().get("capture.includeExtensions");
            const ruleGlobs = cfg().get("capture.ruleGlobs") ?? [];
            const enableRedaction = !!cfg().get("security.enableRedaction");
            const patterns = (cfg().get("security.redactionPatterns") ?? [])
                .map(p => {
                try {
                    return new RegExp(p, "g");
                }
                catch (e) {
                    log.warn(`Invalid redaction pattern: ${p}`);
                    return null;
                }
            })
                .filter((p) => p !== null);
            log.info(`Capturing profile: ${name}`);
            const snapshot = await (0, collector_1.collectSnapshot)({
                name,
                includeUser,
                includeWorkspace,
                includeRulesWorkflows,
                includeExtensions,
                ruleGlobs,
                redaction: { enabled: enableRedaction, patterns }
            });
            await store.save(snapshot);
            log.info(`Saved profile ${snapshot.manifest.id} (${snapshot.manifest.files.length} files)`);
            log.show();
            vscode.window.showInformationMessage(`Profile saved: ${name}`);
        }
        catch (e) {
            log.error(String(e?.stack ?? e));
            log.show();
            vscode.window.showErrorMessage("Profile capture failed. See Output → Profile Vault.");
        }
    }), vscode.commands.registerCommand("profileVault.apply", async () => {
        try {
            const profiles = await store.list();
            if (!profiles.length) {
                vscode.window.showInformationMessage("No profiles found.");
                return;
            }
            const id = await (0, quickpick_1.pickProfile)(profiles, "Select a profile to apply");
            if (!id)
                return;
            const applyToWorkspace = await askYesNo("Apply workspace files (.vscode + rules/workflows) too?");
            const snap = await store.load(id);
            log.info(`Applying profile ${snap.manifest.name} (${id})`);
            await (0, applier_1.applySnapshot)(snap, applyToWorkspace);
            log.info("Apply complete.");
            log.show();
        }
        catch (e) {
            log.error(String(e?.stack ?? e));
            log.show();
            vscode.window.showErrorMessage("Profile apply failed. See Output → Profile Vault.");
        }
    }), vscode.commands.registerCommand("profileVault.diff", async () => {
        try {
            const profiles = await store.list();
            if (profiles.length < 2) {
                vscode.window.showInformationMessage("Need at least 2 profiles to diff.");
                return;
            }
            const idA = await (0, quickpick_1.pickProfile)(profiles, "Pick first profile");
            if (!idA)
                return;
            const idB = await (0, quickpick_1.pickProfile)(profiles.filter(p => p.id !== idA), "Pick second profile");
            if (!idB)
                return;
            const a = await store.load(idA);
            const b = await store.load(idB);
            const d = (0, diff_1.diffManifests)(a.manifest, b.manifest);
            const doc = await vscode.workspace.openTextDocument({
                content: formatDiff(a.manifest.name, b.manifest.name, d),
                language: "markdown"
            });
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (e) {
            log.error(String(e?.stack ?? e));
            log.show();
            vscode.window.showErrorMessage("Diff failed. See Output → Profile Vault.");
        }
    }), vscode.commands.registerCommand("profileVault.delete", async () => {
        try {
            const profiles = await store.list();
            if (!profiles.length) {
                vscode.window.showInformationMessage("No profiles found.");
                return;
            }
            const id = await (0, quickpick_1.pickProfile)(profiles, "Select a profile to delete");
            if (!id)
                return;
            const ok = await askYesNo("Delete this profile permanently?");
            if (!ok)
                return;
            await store.delete(id);
            vscode.window.showInformationMessage("Profile deleted.");
        }
        catch (e) {
            log.error(String(e?.stack ?? e));
            log.show();
            vscode.window.showErrorMessage("Delete failed. See Output → Profile Vault.");
        }
    }), vscode.commands.registerCommand("profileVault.export", async () => {
        try {
            const profiles = await store.list();
            if (!profiles.length) {
                vscode.window.showInformationMessage("No profiles found.");
                return;
            }
            const id = await (0, quickpick_1.pickProfile)(profiles, "Select a profile to export");
            if (!id)
                return;
            const pDir = path.join(store.storageUri().fsPath, "profiles", id);
            const target = await vscode.window.showSaveDialog({
                title: "Export Profile Vault",
                filters: { "Profile Vault": ["pvault"] },
                saveLabel: "Export"
            });
            if (!target)
                return;
            // Create a temp zip in globalStorage, then optionally encrypt and write final.
            const tmpZip = path.join(store.storageUri().fsPath, `export-${id}-${Date.now()}.pvault`);
            await (0, zip_1.zipFolderToFile)(pDir, tmpZip);
            const encryptExports = !!cfg().get("crypto.encryptExports");
            if (!encryptExports) {
                await fs.copyFile(tmpZip, target.fsPath);
                await fs.rm(tmpZip, { force: true });
                vscode.window.showInformationMessage("Exported profile.");
                return;
            }
            const pass = await askPassphrase("Passphrase to encrypt export (store it somewhere safe)");
            if (!pass)
                return;
            const zipBytes = await fs.readFile(tmpZip);
            const payload = (0, crypto_1.encryptBytes)(zipBytes, pass);
            const encPath = target.fsPath + ".enc.json";
            await fs.writeFile(encPath, JSON.stringify(payload, null, 2), "utf8");
            await fs.rm(tmpZip, { force: true });
            vscode.window.showInformationMessage("Exported encrypted profile.");
        }
        catch (e) {
            log.error(String(e?.stack ?? e));
            log.show();
            vscode.window.showErrorMessage("Export failed. See Output → Profile Vault.");
        }
    }), vscode.commands.registerCommand("profileVault.import", async () => {
        try {
            const picked = await vscode.window.showOpenDialog({
                title: "Import Profile Vault",
                canSelectMany: false,
                filters: { "Profile Vault": ["pvault", "json"] }
            });
            if (!picked?.[0])
                return;
            const file = picked[0].fsPath;
            // Import either:
            //  - raw .pvault (zip), or
            //  - encrypted payload json created by export.
            const isEncryptedJson = file.toLowerCase().endsWith(".json");
            const tmpFolder = path.join(store.storageUri().fsPath, `import-${Date.now()}`);
            await fs.mkdir(tmpFolder, { recursive: true });
            let zipFile = path.join(tmpFolder, "import.pvault");
            if (isEncryptedJson) {
                const raw = await fs.readFile(file, "utf8");
                let payload;
                try {
                    payload = JSON.parse(raw);
                }
                catch (parseError) {
                    throw new Error(`Invalid profile file format: ${String(parseError)}`);
                }
                const pass = await askPassphrase("Passphrase to decrypt import");
                if (!pass)
                    return;
                const zipBytes = (0, crypto_1.decryptBytes)(payload, pass);
                await fs.writeFile(zipFile, zipBytes);
            }
            else {
                zipFile = file;
            }
            const outFolder = path.join(tmpFolder, "unzipped");
            await (0, zip_1.unzipFileToFolder)(zipFile, outFolder);
            // The zip contains a profile folder with manifest.json at root.
            const manifestPath = path.join(outFolder, "manifest.json");
            const manifestExists = await fileExists(manifestPath);
            if (!manifestExists) {
                throw new Error("Invalid .pvault: manifest.json not found at root.");
            }
            // Copy to local store
            const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
            const id = manifest.id;
            const dest = path.join(store.storageUri().fsPath, "profiles", id);
            // prevent overwrite without prompt
            if (await fileExists(dest)) {
                const ok = await askYesNo("A profile with this ID already exists. Overwrite?");
                if (!ok)
                    return;
                await fs.rm(dest, { recursive: true, force: true });
            }
            await copyDir(outFolder, dest);
            vscode.window.showInformationMessage(`Imported profile: ${manifest.name ?? id}`);
        }
        catch (e) {
            log.error(String(e?.stack ?? e));
            log.show();
            vscode.window.showErrorMessage("Import failed. See Output → Profile Vault.");
        }
    }), vscode.commands.registerCommand("profileVault.openStorage", async () => {
        await vscode.commands.executeCommand("revealFileInOS", store.storageUri());
    }));
    log.info("Profile Vault activated.");
}
function deactivate() { }
async function askYesNo(prompt) {
    const choice = await vscode.window.showWarningMessage(prompt, { modal: true }, "Yes", "No");
    return choice === "Yes";
}
async function askPassphrase(prompt) {
    return vscode.window.showInputBox({
        prompt,
        password: true,
        ignoreFocusOut: true,
        validateInput: (v) => (v && v.length >= 8 ? undefined : "Minimum 8 characters")
    });
}
async function fileExists(p) {
    try {
        await fs.stat(p);
        return true;
    }
    catch {
        return false;
    }
}
async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const ents = await fs.readdir(src, { withFileTypes: true });
    for (const ent of ents) {
        const s = path.join(src, ent.name);
        const d = path.join(dest, ent.name);
        if (ent.isDirectory())
            await copyDir(s, d);
        else if (ent.isFile())
            await fs.copyFile(s, d);
    }
}
function formatDiff(nameA, nameB, d) {
    return [
        `# Profile Diff`,
        ``,
        `**A:** ${nameA}`,
        `**B:** ${nameB}`,
        ``,
        `## Files`,
        `- Added: ${d.filesAdded.length}`,
        `- Removed: ${d.filesRemoved.length}`,
        `- Changed: ${d.filesChanged.length}`,
        ``,
        `### Added`,
        ...d.filesAdded.map((x) => `- \`${x}\``),
        ``,
        `### Removed`,
        ...d.filesRemoved.map((x) => `- \`${x}\``),
        ``,
        `### Changed`,
        ...d.filesChanged.map((x) => `- \`${x}\``),
        ``,
        `## Extensions`,
        `- Added: ${d.extensionsAdded.length}`,
        `- Removed: ${d.extensionsRemoved.length}`,
        `- Version changed: ${d.extensionsVersionChanged.length}`,
        ``,
        `### Added`,
        ...d.extensionsAdded.map((x) => `- \`${x}\``),
        ``,
        `### Removed`,
        ...d.extensionsRemoved.map((x) => `- \`${x}\``),
        ``,
        `### Version changed`,
        ...d.extensionsVersionChanged.map((x) => `- \`${x.id}\`: \`${x.from ?? "?"}\` → \`${x.to ?? "?"}\``)
    ].join("\n");
}
