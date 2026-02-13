import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { collectSnapshot } from "./core/collector";
import { applySnapshot } from "./core/applier";
import { ProfileStore } from "./core/store";
import { diffManifests } from "./core/diff";
import { zipFolderToFile, unzipFileToFolder } from "./core/zip";
import { encryptBytes, decryptBytes, EncryptedPayload } from "./core/crypto";
import { pickProfile } from "./ui/quickpick";
import { Log } from "./ui/log";
import { ProfileProvider } from "./ui/treeProvider";

export async function activate(ctx: vscode.ExtensionContext) {
    const log = new Log();

    const cfg = () => vscode.workspace.getConfiguration("profileVault");
    const store = new ProfileStore(ctx, !!cfg().get<boolean>("crypto.encryptLocalStore"));

    await store.ensureReady();

    // Register tree provider for sidebar
    const profileProvider = new ProfileProvider(store);
    vscode.window.registerTreeDataProvider("profileVault.profiles", profileProvider);
    
    ctx.subscriptions.push(
        vscode.commands.registerCommand("profileVault.refresh", () => profileProvider.refresh()),
        vscode.commands.registerCommand("profileVault.capture", async () => {
            try {
                const name = await vscode.window.showInputBox({
                    prompt: "Profile name",
                    value: `Profile ${new Date().toLocaleString()}`
                });
                if (!name) return;

                const includeUser = !!cfg().get<boolean>("capture.includeUser");
                const includeWorkspace = !!cfg().get<boolean>("capture.includeWorkspace");
                const includeRulesWorkflows = !!cfg().get<boolean>("capture.includeRulesWorkflows");
                const includeExtensions = !!cfg().get<boolean>("capture.includeExtensions");
                const ruleGlobs = cfg().get<string[]>("capture.ruleGlobs") ?? [];

                const enableRedaction = !!cfg().get<boolean>("security.enableRedaction");
                const patterns = (cfg().get<string[]>("security.redactionPatterns") ?? [])
                    .map(p => {
                        try {
                            return new RegExp(p, "g");
                        } catch (e) {
                            log.warn(`Invalid redaction pattern: ${p}`);
                            return null;
                        }
                    })
                    .filter((p): p is RegExp => p !== null);

                log.info(`Capturing profile: ${name}`);
                const snapshot = await collectSnapshot({
                    name,
                    includeUser,
                    includeWorkspace,
                    includeRulesWorkflows,
                    includeExtensions,
                    ruleGlobs,
                    redaction: { enabled: enableRedaction, patterns }
                });

                await store.save(snapshot);
                profileProvider.refresh();
                log.info(`Saved profile ${snapshot.manifest.id} (${snapshot.manifest.files.length} files)`);
                log.show();

                vscode.window.showInformationMessage(`Profile saved: ${name}`);
            } catch (e: any) {
                log.error(String(e?.stack ?? e));
                log.show();
                vscode.window.showErrorMessage("Profile capture failed. See Output → Profile Vault.");
            }
        }),

        vscode.commands.registerCommand("profileVault.apply", async () => {
            try {
                const profiles = await store.list();
                if (!profiles.length) {
                    vscode.window.showInformationMessage("No profiles found.");
                    return;
                }

                const id = await pickProfile(profiles, "Select a profile to apply");
                if (!id) return;

                const applyToWorkspace = await askYesNo("Apply workspace files (.vscode + rules/workflows) too?");
                const snap = await store.load(id);

                log.info(`Applying profile ${snap.manifest.name} (${id})`);
                await applySnapshot(snap, applyToWorkspace);
                log.info("Apply complete.");
                log.show();
            } catch (e: any) {
                log.error(String(e?.stack ?? e));
                log.show();
                vscode.window.showErrorMessage("Profile apply failed. See Output → Profile Vault.");
            }
        }),

        vscode.commands.registerCommand("profileVault.diff", async () => {
            try {
                const profiles = await store.list();
                if (profiles.length < 2) {
                    vscode.window.showInformationMessage("Need at least 2 profiles to diff.");
                    return;
                }

                const idA = await pickProfile(profiles, "Pick first profile");
                if (!idA) return;
                const idB = await pickProfile(profiles.filter(p => p.id !== idA), "Pick second profile");
                if (!idB) return;

                const a = await store.load(idA);
                const b = await store.load(idB);

                const d = diffManifests(a.manifest, b.manifest);

                const doc = await vscode.workspace.openTextDocument({
                    content: formatDiff(a.manifest.name, b.manifest.name, d),
                    language: "markdown"
                });
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch (e: any) {
                log.error(String(e?.stack ?? e));
                log.show();
                vscode.window.showErrorMessage("Diff failed. See Output → Profile Vault.");
            }
        }),

        vscode.commands.registerCommand("profileVault.delete", async () => {
            try {
                const profiles = await store.list();
                if (!profiles.length) {
                    vscode.window.showInformationMessage("No profiles found.");
                    return;
                }

                const id = await pickProfile(profiles, "Select a profile to delete");
                if (!id) return;

                const ok = await askYesNo("Delete this profile permanently?");
                if (!ok) return;

                await store.delete(id);
                profileProvider.refresh();
                vscode.window.showInformationMessage("Profile deleted.");
            } catch (e: any) {
                log.error(String(e?.stack ?? e));
                log.show();
                vscode.window.showErrorMessage("Delete failed. See Output → Profile Vault.");
            }
        }),

        vscode.commands.registerCommand("profileVault.export", async () => {
            try {
                const profiles = await store.list();
                if (!profiles.length) {
                    vscode.window.showInformationMessage("No profiles found.");
                    return;
                }

                const id = await pickProfile(profiles, "Select a profile to export");
                if (!id) return;

                const pDir = path.join(store.storageUri().fsPath, "profiles", id);

                const target = await vscode.window.showSaveDialog({
                    title: "Export Profile Vault",
                    filters: { "Profile Vault": ["pvault"] },
                    saveLabel: "Export"
                });
                if (!target) return;

                // Create a temp zip in globalStorage, then optionally encrypt and write final.
                const tmpZip = path.join(store.storageUri().fsPath, `export-${id}-${Date.now()}.pvault`);
                await zipFolderToFile(pDir, tmpZip);

                const encryptExports = !!cfg().get<boolean>("crypto.encryptExports");
                if (!encryptExports) {
                    await fs.copyFile(tmpZip, target.fsPath);
                    await fs.rm(tmpZip, { force: true });
                    vscode.window.showInformationMessage("Exported profile.");
                    return;
                }

                const pass = await askPassphrase("Passphrase to encrypt export (store it somewhere safe)");
                if (!pass) return;

                const zipBytes = await fs.readFile(tmpZip);
                const payload = encryptBytes(zipBytes, pass);

                const encPath = target.fsPath + ".enc.json";
                await fs.writeFile(encPath, JSON.stringify(payload, null, 2), "utf8");

                await fs.rm(tmpZip, { force: true });
                vscode.window.showInformationMessage("Exported encrypted profile.");
            } catch (e: any) {
                log.error(String(e?.stack ?? e));
                log.show();
                vscode.window.showErrorMessage("Export failed. See Output → Profile Vault.");
            }
        }),

        vscode.commands.registerCommand("profileVault.import", async () => {
            try {
                const picked = await vscode.window.showOpenDialog({
                    title: "Import Profile Vault",
                    canSelectMany: false,
                    filters: { "Profile Vault": ["pvault", "json"] }
                });
                if (!picked?.[0]) return;

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
                    let payload: EncryptedPayload;
                    try {
                        payload = JSON.parse(raw) as EncryptedPayload;
                    } catch (parseError) {
                        throw new Error(`Invalid profile file format: ${String(parseError)}`);
                    }
                    const pass = await askPassphrase("Passphrase to decrypt import");
                    if (!pass) return;
                    const zipBytes = decryptBytes(payload, pass);
                    await fs.writeFile(zipFile, zipBytes);
                } else {
                    zipFile = file;
                }

                const outFolder = path.join(tmpFolder, "unzipped");
                await unzipFileToFolder(zipFile, outFolder);

                // The zip contains a profile folder with manifest.json at root.
                const manifestPath = path.join(outFolder, "manifest.json");
                const manifestExists = await fileExists(manifestPath);
                if (!manifestExists) {
                    throw new Error("Invalid .pvault: manifest.json not found at root.");
                }

                // Copy to local store
                const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
                const id = manifest.id as string;

                const dest = path.join(store.storageUri().fsPath, "profiles", id);

                // prevent overwrite without prompt
                if (await fileExists(dest)) {
                    const ok = await askYesNo("A profile with this ID already exists. Overwrite?");
                    if (!ok) return;
                    await fs.rm(dest, { recursive: true, force: true });
                }

                await copyDir(outFolder, dest);

                vscode.window.showInformationMessage(`Imported profile: ${manifest.name ?? id}`);
            } catch (e: any) {
                log.error(String(e?.stack ?? e));
                log.show();
                vscode.window.showErrorMessage("Import failed. See Output → Profile Vault.");
            }
        }),

        vscode.commands.registerCommand("profileVault.openStorage", async () => {
            await vscode.commands.executeCommand("revealFileInOS", store.storageUri());
        })
    );

    log.info("Profile Vault activated.");
}

export function deactivate() { }

async function askYesNo(prompt: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(prompt, { modal: true }, "Yes", "No");
    return choice === "Yes";
}

async function askPassphrase(prompt: string): Promise<string | undefined> {
    return vscode.window.showInputBox({
        prompt,
        password: true,
        ignoreFocusOut: true,
        validateInput: (v) => (v && v.length >= 8 ? undefined : "Minimum 8 characters")
    });
}

async function fileExists(p: string): Promise<boolean> {
    try { await fs.stat(p); return true; } catch { return false; }
}

async function copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const ents = await fs.readdir(src, { withFileTypes: true });
    for (const ent of ents) {
        const s = path.join(src, ent.name);
        const d = path.join(dest, ent.name);
        if (ent.isDirectory()) await copyDir(s, d);
        else if (ent.isFile()) await fs.copyFile(s, d);
    }
}

function formatDiff(nameA: string, nameB: string, d: any): string {
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
        ...d.filesAdded.map((x: string) => `- \`${x}\``),
        ``,
        `### Removed`,
        ...d.filesRemoved.map((x: string) => `- \`${x}\``),
        ``,
        `### Changed`,
        ...d.filesChanged.map((x: string) => `- \`${x}\``),
        ``,
        `## Extensions`,
        `- Added: ${d.extensionsAdded.length}`,
        `- Removed: ${d.extensionsRemoved.length}`,
        `- Version changed: ${d.extensionsVersionChanged.length}`,
        ``,
        `### Added`,
        ...d.extensionsAdded.map((x: string) => `- \`${x}\``),
        ``,
        `### Removed`,
        ...d.extensionsRemoved.map((x: string) => `- \`${x}\``),
        ``,
        `### Version changed`,
        ...d.extensionsVersionChanged.map((x: any) => `- \`${x.id}\`: \`${x.from ?? "?"}\` → \`${x.to ?? "?"}\``)
    ].join("\n");
}
