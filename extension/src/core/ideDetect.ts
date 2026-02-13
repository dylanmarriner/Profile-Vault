import * as vscode from "vscode";
import { IdeFlavor } from "./model";

export function detectIde(): IdeFlavor {
    const name = (vscode.env.appName || "").toLowerCase();
    if (name.includes("windsurf")) return "windsurf";
    if (name.includes("antigravity")) return "antigravity";
    if (name.includes("visual studio code") || name.includes("vscode")) return "vscode";
    return "unknown";
}
