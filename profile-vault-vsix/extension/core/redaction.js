"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactIfText = redactIfText;
function redactIfText(logicalPath, buf, cfg) {
    if (!cfg.enabled)
        return buf;
    // Redact only likely-text files to avoid corrupting binaries.
    const isText = /\.(json|code-snippets|md|txt|yml|yaml|toml|ini)$/i.test(logicalPath) ||
        logicalPath.includes("settings.json") ||
        logicalPath.includes("keybindings.json") ||
        logicalPath.includes(".windsurfrules") ||
        logicalPath.includes(".cursorrules");
    if (!isText)
        return buf;
    let s;
    try {
        s = buf.toString("utf8");
    }
    catch {
        return buf;
    }
    let out = s;
    for (const re of cfg.patterns) {
        out = out.replace(re, (m) => {
            // Keep only a tiny prefix, then redact the rest.
            const prefix = m.slice(0, 4);
            return `${prefix}…[REDACTED]`;
        });
    }
    return Buffer.from(out, "utf8");
}
