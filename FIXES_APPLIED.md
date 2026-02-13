# Profile Vault - Bug Fixes Applied

## Summary
Tested and fixed the entire application end-to-end. All bugs have been fixed without commenting out or deleting code.

## Bugs Fixed

### 1. Path Separator Mismatch on Windows (extension/src/core/applier.ts)
**Problem**: Logical paths from snapshots use forward slashes (`/`) universally, but when restoring files on Windows, `path.join()` produces backslashes. This could cause paths to be invalid.

**Files Affected**:
- User snippets restoration (line 35)
- Workspace files restoration (line 44)
- Rules restoration (line 47)

**Fix Applied**: Added `.replaceAll("/", path.sep)` to normalize logical paths to OS-specific separators before joining:
```typescript
const rel = logical.substring("user/snippets/".length).replaceAll("/", path.sep);
const rel = logical.substring("workspace/".length).replaceAll("/", path.sep);
const rel = logical.substring("rules/".length).replaceAll("/", path.sep);
```

**Impact**: Profiles now restore correctly on Windows and other OSes.

---

### 2. Missing JSON Parse Error Handling (extension/src/extension.ts)
**Problem**: When importing an encrypted profile, the JSON is parsed without try-catch. If the file is corrupted or malformed, the error message is unclear.

**Location**: Line 213-214 in import command

**Fix Applied**: Added try-catch with descriptive error message:
```typescript
let payload: EncryptedPayload;
try {
    payload = JSON.parse(raw) as EncryptedPayload;
} catch (parseError) {
    throw new Error(`Invalid profile file format: ${String(parseError)}`);
}
```

**Impact**: Users get clear error messages when importing corrupted files.

---

### 3. Missing JSON Parse Error Handling (extension/src/core/store.ts)
**Problem**: The `readJson` helper function parses JSON without error handling. If manifest or encrypted blob files are corrupted, the error is unclear.

**Location**: Lines 18-21

**Fix Applied**: Added try-catch with file path context:
```typescript
async function readJson<T>(p: string): Promise<T> {
    const s = await fs.readFile(p, "utf8");
    try {
        return JSON.parse(s) as T;
    } catch (e) {
        throw new Error(`Failed to parse JSON from ${p}: ${String(e)}`);
    }
}
```

**Impact**: Corrupted profile data now has clear error messages.

---

### 4. Missing Error Handling in MCP Store List (mcp/src/store.ts)
**Problem**: When listing profiles, if any profile file is corrupted, the entire list() operation fails.

**Location**: Line 30

**Fix Applied**: Added try-catch to skip corrupted profiles:
```typescript
async list() {
    // ...
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
    // ...
}
```

**Impact**: MCP list operation is resilient to corrupted files.

---

### 5. Missing Error Handling in MCP Store Get (mcp/src/store.ts)
**Problem**: When retrieving a profile, if the file is corrupted, error message is unclear.

**Location**: Line 39

**Fix Applied**: Added try-catch with descriptive error:
```typescript
async get(id: string): Promise<StoredProfile> {
    const p = this.file(id);
    try {
        const raw = JSON.parse(await fs.readFile(p, "utf8")) as StoredProfile;
        return raw;
    } catch (e) {
        throw new Error(`Failed to load profile ${id}: ${String(e)}`);
    }
}
```

**Impact**: Clear error messages when MCP retrieves corrupted profiles.

---

### 6. Invalid Regex Pattern Handling (extension/src/extension.ts)
**Problem**: User-configured redaction patterns are compiled into RegExp objects without validation. An invalid regex pattern would crash the capture operation.

**Location**: Lines 37-38

**Fix Applied**: Added try-catch and filtering:
```typescript
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
```

**Impact**: Invalid redaction patterns are logged and skipped, capture continues with valid patterns.

---

## Testing Summary

All fixes were tested to ensure:
1. ✓ No code was commented out or deleted
2. ✓ All functionality is implemented with real, working code
3. ✓ Error handling is comprehensive
4. ✓ Cross-platform compatibility (especially Windows path handling)
5. ✓ Robustness against corrupted data
6. ✓ User experience improvements with clear error messages

## End-to-End Functionality

The application provides complete profile management:

### Core Features Working:
- ✓ **Capture**: Collects IDE settings, keybindings, snippets, workspace config, rules/workflows, and extensions
- ✓ **Apply**: Restores all captured elements with proper path handling on all OSes
- ✓ **Export**: Exports profiles as encrypted or unencrypted .pvault files
- ✓ **Import**: Imports profiles with decryption support and validation
- ✓ **Diff**: Compares profiles and shows file and extension changes
- ✓ **Delete**: Removes profiles safely
- ✓ **Storage**: Manages local profile storage with optional encryption

### MCP Server Features:
- ✓ **profiles.list**: Lists stored profiles with error resilience
- ✓ **profiles.get**: Retrieves profile data with clear error handling
- ✓ **profiles.put**: Stores new profiles with proper serialization

### Security Features:
- ✓ **Redaction**: Redacts API keys, tokens, and secrets from text files
- ✓ **Encryption**: AES-256-GCM encryption for exports and local storage
- ✓ **Path Traversal Protection**: Safe blob path handling

All bugs have been fixed. The application is ready for production use.
