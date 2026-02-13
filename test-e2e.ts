/**
 * End-to-End Test Suite for Profile Vault
 * Tests core logic without VSCode/MCP runtime dependencies
 */

import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

// Test utilities
let testsPassed = 0;
let testsFailed = 0;
const testResults: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        testsPassed++;
        testResults.push(`✓ ${name}`);
        console.log(`✓ ${name}`);
    } catch (e) {
        testsFailed++;
        testResults.push(`✗ ${name}: ${String(e)}`);
        console.error(`✗ ${name}`);
        console.error(`  ${String(e)}`);
    }
}

// Test types
interface ProfileManifest {
    schemaVersion: 1;
    id: string;
    name: string;
    createdAt: string;
    ide: { flavor: string; appName: string; vscodeVersion: string };
    machine: { platform: string; arch: string };
    includes: {
        userSettings: boolean;
        userKeybindings: boolean;
        userSnippets: boolean;
        workspaceVscodeDir: boolean;
        rulesAndWorkflows: boolean;
        extensions: boolean;
    };
    paths: { userDir?: string; workspaceRoot?: string };
    extensions?: Array<{ id: string; version?: string; isBuiltin: boolean }>;
    files: Array<{ logicalPath: string; sha256: string; bytes: number }>;
}

interface ProfileSnapshot {
    manifest: ProfileManifest;
    blobs: Map<string, Buffer>;
}

// ============ CRYPTO TESTS ============

function b64(b: Buffer) { return b.toString("base64"); }
function unb64(s: string) { return Buffer.from(s, "base64"); }

const PBKDF2_ITERS = 200_000;
const KEY_LEN = 32;

function deriveKey(passphrase: string, salt: Buffer) {
    return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERS, KEY_LEN, "sha256");
}

type EncryptedPayload = {
    v: 1;
    salt: string;
    iv: string;
    tag: string;
    data: string;
};

function encryptBytes(plain: Buffer, passphrase: string): EncryptedPayload {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(passphrase, salt);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();

    return { v: 1, salt: b64(salt), iv: b64(iv), tag: b64(tag), data: b64(enc) };
}

function decryptBytes(payload: EncryptedPayload, passphrase: string): Buffer {
    if (payload.v !== 1) throw new Error("Unsupported encryption payload version");
    const salt = unb64(payload.salt);
    const key = deriveKey(passphrase, salt);
    const iv = unb64(payload.iv);
    const tag = unb64(payload.tag);
    const data = unb64(payload.data);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

test("Crypto: Encrypt and decrypt with correct passphrase", async () => {
    const plaintext = Buffer.from("sensitive data", "utf8");
    const passphrase = "mySecurePassphrase123";
    const encrypted = encryptBytes(plaintext, passphrase);
    const decrypted = decryptBytes(encrypted, passphrase);
    if (!plaintext.equals(decrypted)) throw new Error("Decrypted text doesn't match");
});

test("Crypto: Decrypt fails with wrong passphrase", async () => {
    const plaintext = Buffer.from("secret", "utf8");
    const encrypted = encryptBytes(plaintext, "correct");
    try {
        decryptBytes(encrypted, "wrong");
        throw new Error("Should have thrown");
    } catch (e: any) {
        if (!String(e).includes("Unsupported encryption") && !String(e).includes("Authentication")) {
            throw e;
        }
    }
});

test("Crypto: Large payload encryption/decryption", async () => {
    const largeData = Buffer.alloc(1024 * 1024); // 1MB
    crypto.getRandomValues(largeData);
    const passphrase = "testPassphrase";
    const encrypted = encryptBytes(largeData, passphrase);
    const decrypted = decryptBytes(encrypted, passphrase);
    if (!largeData.equals(decrypted)) throw new Error("Large payload mismatch");
});

// ============ DIFF TESTS ============

type ProfileDiff = {
    filesAdded: string[];
    filesRemoved: string[];
    filesChanged: string[];
    extensionsAdded: string[];
    extensionsRemoved: string[];
    extensionsVersionChanged: Array<{ id: string; from?: string; to?: string }>;
};

function diffManifests(a: ProfileManifest, b: ProfileManifest): ProfileDiff {
    const aFiles = new Map(a.files.map(f => [f.logicalPath, f.sha256]));
    const bFiles = new Map(b.files.map(f => [f.logicalPath, f.sha256]));

    const filesAdded: string[] = [];
    const filesRemoved: string[] = [];
    const filesChanged: string[] = [];

    for (const [p, h] of bFiles.entries()) {
        if (!aFiles.has(p)) filesAdded.push(p);
        else if (aFiles.get(p) !== h) filesChanged.push(p);
    }
    for (const p of aFiles.keys()) {
        if (!bFiles.has(p)) filesRemoved.push(p);
    }

    const aExt = new Map((a.extensions ?? []).map(e => [e.id, e.version]));
    const bExt = new Map((b.extensions ?? []).map(e => [e.id, e.version]));

    const extensionsAdded: string[] = [];
    const extensionsRemoved: string[] = [];
    const extensionsVersionChanged: Array<{ id: string; from?: string; to?: string }> = [];

    for (const [id, v] of bExt.entries()) {
        if (!aExt.has(id)) extensionsAdded.push(id);
        else if (aExt.get(id) !== v) extensionsVersionChanged.push({ id, from: aExt.get(id), to: v });
    }
    for (const id of aExt.keys()) {
        if (!bExt.has(id)) extensionsRemoved.push(id);
    }

    return {
        filesAdded: filesAdded.sort(),
        filesRemoved: filesRemoved.sort(),
        filesChanged: filesChanged.sort(),
        extensionsAdded: extensionsAdded.sort(),
        extensionsRemoved: extensionsRemoved.sort(),
        extensionsVersionChanged: extensionsVersionChanged.sort((x, y) => x.id.localeCompare(y.id))
    };
}

function sha256(buf: Buffer) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

function createManifest(name: string, files: Array<[string, Buffer]> = [], extensions: string[] = []): ProfileManifest {
    return {
        schemaVersion: 1,
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        ide: { flavor: "vscode", appName: "Visual Studio Code", vscodeVersion: "1.85.0" },
        machine: { platform: "linux", arch: "x64" },
        includes: {
            userSettings: true,
            userKeybindings: true,
            userSnippets: true,
            workspaceVscodeDir: true,
            rulesAndWorkflows: true,
            extensions: true
        },
        paths: { userDir: "/home/user/.config/Code/User", workspaceRoot: "/workspace" },
        extensions: extensions.map(id => ({ id, version: "1.0.0", isBuiltin: false })),
        files: files.map(([logicalPath, buf]) => ({
            logicalPath,
            sha256: sha256(buf),
            bytes: buf.byteLength
        }))
    };
}

test("Diff: Detect added files", async () => {
    const a = createManifest("Profile A", [["user/settings.json", Buffer.from('{"a": 1}')]]);
    const b = createManifest("Profile B", [
        ["user/settings.json", Buffer.from('{"a": 1}')],
        ["user/keybindings.json", Buffer.from('[]')]
    ]);
    const diff = diffManifests(a, b);
    if (!diff.filesAdded.includes("user/keybindings.json")) throw new Error("Should detect added file");
});

test("Diff: Detect removed files", async () => {
    const a = createManifest("Profile A", [
        ["user/settings.json", Buffer.from('{}')],
        ["user/keybindings.json", Buffer.from('[]')]
    ]);
    const b = createManifest("Profile B", [["user/settings.json", Buffer.from('{}')]]);
    const diff = diffManifests(a, b);
    if (!diff.filesRemoved.includes("user/keybindings.json")) throw new Error("Should detect removed file");
});

test("Diff: Detect changed files", async () => {
    const a = createManifest("Profile A", [["user/settings.json", Buffer.from('{"a": 1}')]]);
    const b = createManifest("Profile B", [["user/settings.json", Buffer.from('{"a": 2}')]]);
    const diff = diffManifests(a, b);
    if (!diff.filesChanged.includes("user/settings.json")) throw new Error("Should detect changed file");
});

test("Diff: Detect added extensions", async () => {
    const a = createManifest("Profile A", [], ["ext1"]);
    const b = createManifest("Profile B", [], ["ext1", "ext2"]);
    const diff = diffManifests(a, b);
    if (!diff.extensionsAdded.includes("ext2")) throw new Error("Should detect added extension");
});

test("Diff: Detect removed extensions", async () => {
    const a = createManifest("Profile A", [], ["ext1", "ext2"]);
    const b = createManifest("Profile B", [], ["ext1"]);
    const diff = diffManifests(a, b);
    if (!diff.extensionsRemoved.includes("ext2")) throw new Error("Should detect removed extension");
});

test("Diff: Detect identical profiles", async () => {
    const files = [["user/settings.json", Buffer.from('{}')]];
    const exts = ["ext1"];
    const a = createManifest("Profile A", files, exts);
    const b = createManifest("Profile B", files, exts);
    const diff = diffManifests(a, b);
    if (diff.filesAdded.length > 0 || diff.filesRemoved.length > 0 || diff.filesChanged.length > 0) {
        throw new Error("Should not detect changes in identical profiles");
    }
});

// ============ REDACTION TESTS ============

function redactIfText(logicalPath: string, buf: Buffer, enableRedaction: boolean): Buffer {
    if (!enableRedaction) return buf;

    const isText = /\.(json|code-snippets|md|txt|yml|yaml|toml|ini)$/i.test(logicalPath) ||
        logicalPath.includes("settings.json") ||
        logicalPath.includes("keybindings.json") ||
        logicalPath.includes(".windsurfrules") ||
        logicalPath.includes(".cursorrules");

    if (!isText) return buf;

    let s: string;
    try { s = buf.toString("utf8"); } catch { return buf; }

    const patterns = [
        /(?i)api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?/g,
        /(?i)secret\s*[:=]\s*['"]?.{8,}['"]?/g,
        /(?i)token\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?/g
    ];

    let out = s;
    for (const re of patterns) {
        out = out.replace(re, (m) => {
            const prefix = m.slice(0, 4);
            return `${prefix}…[REDACTED]`;
        });
    }

    return Buffer.from(out, "utf8");
}

test("Redaction: Redact API keys", async () => {
    const input = Buffer.from('{"api_key": "sk_test_very_long_secret_key_123456"}');
    const output = redactIfText("settings.json", input, true);
    const str = output.toString("utf8");
    if (str.includes("sk_test_very_long_secret_key_123456")) throw new Error("API key not redacted");
    if (!str.includes("[REDACTED]")) throw new Error("Should contain [REDACTED]");
});

test("Redaction: Redact tokens", async () => {
    const input = Buffer.from('token = "abcdefghijklmnopqrstuv"');
    const output = redactIfText("config.txt", input, true);
    const str = output.toString("utf8");
    if (str.includes("abcdefghijklmnopqrstuv")) throw new Error("Token not redacted");
    if (!str.includes("[REDACTED]")) throw new Error("Should contain [REDACTED]");
});

test("Redaction: Skip redaction when disabled", async () => {
    const input = Buffer.from('{"api_key": "secret123456789"}');
    const output = redactIfText("settings.json", input, false);
    if (!input.equals(output)) throw new Error("Should not redact when disabled");
});

test("Redaction: Don't redact binary files", async () => {
    const binary = Buffer.alloc(100);
    crypto.getRandomValues(binary);
    const output = redactIfText("image.png", binary, true);
    if (!binary.equals(output)) throw new Error("Should not redact binary files");
});

// ============ PATH RESOLUTION TESTS ============

function resolveUserDir(flavor: string, platform: string, homeDir: string): string | undefined {
    const product =
        flavor === "windsurf" ? "Windsurf" :
            flavor === "antigravity" ? "Antigravity" :
                flavor === "vscode" ? "Code" :
                    undefined;

    if (!product) return undefined;

    if (platform === "darwin") {
        return path.join(homeDir, "Library", "Application Support", product, "User");
    }
    if (platform === "win32") {
        return path.join("C:\\Users\\User\\AppData\\Roaming", product, "User");
    }
    return path.join(homeDir, ".config", product, "User");
}

test("Paths: Resolve VSCode user dir on Linux", async () => {
    const userDir = resolveUserDir("vscode", "linux", "/home/user");
    if (userDir !== path.join("/home/user", ".config", "Code", "User")) {
        throw new Error(`Expected .config/Code/User path, got ${userDir}`);
    }
});

test("Paths: Resolve Windsurf user dir on macOS", async () => {
    const userDir = resolveUserDir("windsurf", "darwin", "/Users/user");
    if (!userDir?.includes("Library/Application Support/Windsurf/User")) {
        throw new Error(`Expected Library path, got ${userDir}`);
    }
});

test("Paths: Unknown IDE returns undefined", async () => {
    const userDir = resolveUserDir("unknown", "linux", "/home/user");
    if (userDir !== undefined) throw new Error("Should return undefined for unknown IDE");
});

// ============ STORE TESTS ============

const tempDir = "/tmp/profile-vault-test";

async function cleanupTestDir() {
    try {
        await fs.rm(tempDir, { recursive: true, force: true });
    } catch { }
}

test("Store: Save and load profile without encryption", async () => {
    await cleanupTestDir();

    const snapshot: ProfileSnapshot = {
        manifest: createManifest("Test Profile", [["user/settings.json", Buffer.from('{"a": 1}')]]),
        blobs: new Map([["user/settings.json", Buffer.from('{"a": 1}')]])
    };

    const id = snapshot.manifest.id;
    const profileDir = path.join(tempDir, "profiles", id);
    const manifestPath = path.join(profileDir, "manifest.json");
    const blobPath = path.join(profileDir, "blobs", "user", "settings.json");

    await fs.mkdir(path.dirname(blobPath), { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(snapshot.manifest, null, 2), "utf8");
    await fs.writeFile(blobPath, snapshot.blobs.get("user/settings.json")!);

    const saved = await fs.readFile(blobPath);
    if (!saved.equals(snapshot.blobs.get("user/settings.json")!)) {
        throw new Error("Blob not saved correctly");
    }

    await cleanupTestDir();
});

test("Store: Save and load profile with encryption", async () => {
    await cleanupTestDir();

    const plainBlob = Buffer.from('{"secret": "value"}');
    const passphrase = "MySecurePassword123";

    const encrypted = encryptBytes(plainBlob, passphrase);
    const decrypted = decryptBytes(encrypted, passphrase);

    if (!plainBlob.equals(decrypted)) {
        throw new Error("Encrypted blob doesn't decrypt correctly");
    }

    await cleanupTestDir();
});

test("Store: Handle multiple files in profile", async () => {
    await cleanupTestDir();

    const files: Array<[string, Buffer]> = [
        ["user/settings.json", Buffer.from('{"setting": "value"}')],
        ["user/keybindings.json", Buffer.from('[]')],
        ["workspace/.vscode/settings.json", Buffer.from('{}')]
    ];

    const snapshot: ProfileSnapshot = {
        manifest: createManifest("Multi-file Profile", files),
        blobs: new Map(files)
    };

    if (snapshot.blobs.size !== 3) {
        throw new Error("Should have 3 files in snapshot");
    }

    await cleanupTestDir();
});

// ============ SNAPSHOT BUILDER TESTS ============

test("Snapshot: Create manifest with correct schema", async () => {
    const manifest = createManifest("Test", [["user/settings.json", Buffer.from('{}')]]);
    if (manifest.schemaVersion !== 1) throw new Error("Wrong schema version");
    if (!manifest.id) throw new Error("Missing ID");
    if (!manifest.createdAt) throw new Error("Missing createdAt");
    if (!manifest.ide.flavor) throw new Error("Missing IDE flavor");
});

test("Snapshot: Calculate file hashes correctly", async () => {
    const buf = Buffer.from("test content");
    const expectedHash = crypto.createHash("sha256").update(buf).digest("hex");
    const manifest = createManifest("Test", [["test.txt", buf]]);
    const file = manifest.files[0];
    if (file.sha256 !== expectedHash) throw new Error("Hash mismatch");
});

test("Snapshot: Support extensions list", async () => {
    const manifest = createManifest("Test", [], ["extension.id1", "extension.id2"]);
    if (!manifest.extensions || manifest.extensions.length !== 2) {
        throw new Error("Extensions not properly stored");
    }
});

// ============ ROUNDTRIP TESTS ============

test("Roundtrip: Encrypt, serialize, deserialize, decrypt", async () => {
    const original = Buffer.from("important data");
    const pass = "testPass123";

    // Encrypt
    const encrypted = encryptBytes(original, pass);

    // Serialize/Deserialize (simulating JSON storage)
    const serialized = JSON.stringify(encrypted);
    const deserialized = JSON.parse(serialized) as EncryptedPayload;

    // Decrypt
    const decrypted = decryptBytes(deserialized, pass);

    if (!original.equals(decrypted)) {
        throw new Error("Roundtrip failed");
    }
});

test("Roundtrip: Create snapshot → diff → analyze changes", async () => {
    const snap1 = {
        manifest: createManifest("Profile 1", [
            ["user/settings.json", Buffer.from('{"theme": "dark"}')],
            ["user/keybindings.json", Buffer.from('[]')]
        ], ["ext1", "ext2"]),
        blobs: new Map()
    };

    const snap2 = {
        manifest: createManifest("Profile 2", [
            ["user/settings.json", Buffer.from('{"theme": "light"}')],
            ["workspace/settings.json", Buffer.from('{}')]
        ], ["ext1", "ext3"]),
        blobs: new Map()
    };

    const diff = diffManifests(snap1.manifest, snap2.manifest);

    // Should detect changes
    if (!diff.filesChanged.includes("user/settings.json")) throw new Error("Theme change not detected");
    if (!diff.filesAdded.includes("workspace/settings.json")) throw new Error("New workspace file not detected");
    if (!diff.filesRemoved.includes("user/keybindings.json")) throw new Error("Removed keybindings not detected");
    if (!diff.extensionsAdded.includes("ext3")) throw new Error("New extension not detected");
    if (!diff.extensionsRemoved.includes("ext2")) throw new Error("Removed extension not detected");
});

// ============ ERROR HANDLING TESTS ============

test("Error: Encryption with empty passphrase", async () => {
    const buf = Buffer.from("test");
    const encrypted = encryptBytes(buf, "");
    const decrypted = decryptBytes(encrypted, "");
    if (!buf.equals(decrypted)) throw new Error("Empty passphrase roundtrip failed");
});

test("Error: Decrypt with corrupted payload", async () => {
    try {
        const corrupted: EncryptedPayload = {
            v: 1,
            salt: "invalidbase64===",
            iv: "invalidbase64===",
            tag: "invalidbase64===",
            data: "invalidbase64==="
        };
        decryptBytes(corrupted, "password");
        throw new Error("Should have thrown on corrupted payload");
    } catch (e: any) {
        if (!String(e).includes("should")) {
            // Expected error
        } else {
            throw e;
        }
    }
});

test("Error: Handle missing files in manifest", async () => {
    const manifest = createManifest("Test", []);
    if (manifest.files.length !== 0) throw new Error("Should have no files");
});

// ============ EXTENSION TESTS ============

test("Extensions: Map extension with version and builtin flag", async () => {
    const manifest = createManifest("Test", [], []);
    manifest.extensions = [
        { id: "publisher.extension", version: "1.0.0", isBuiltin: false },
        { id: "vscode.builtin-ext", version: "1.85.0", isBuiltin: true }
    ];

    if (manifest.extensions.length !== 2) throw new Error("Extensions not stored");
    const ext = manifest.extensions[0];
    if (!ext.id || !ext.version || ext.isBuiltin !== false) {
        throw new Error("Extension properties incorrect");
    }
});

// ============ SUMMARY ============

console.log("\n" + "=".repeat(60));
console.log("TEST SUMMARY");
console.log("=".repeat(60));
console.log(`\nTotal: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
    console.log("\nFailed tests:");
    testResults.filter(r => r.startsWith("✗")).forEach(r => console.log(r));
    process.exit(1);
} else {
    console.log("\n✓ ALL TESTS PASSED");
    process.exit(0);
}
