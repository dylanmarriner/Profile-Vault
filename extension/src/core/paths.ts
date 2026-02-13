import * as os from "os";
import * as path from "path";
import { IdeFlavor } from "./model";

function home() {
    return os.homedir();
}

export function resolveUserDir(flavor: IdeFlavor): string | undefined {
    const platform = process.platform;

    const product =
        flavor === "windsurf" ? "Windsurf" :
            flavor === "antigravity" ? "Antigravity" :
                flavor === "vscode" ? "Code" :
                    undefined;

    if (!product) return undefined;

    if (platform === "darwin") {
        return path.join(home(), "Library", "Application Support", product, "User");
    }
    if (platform === "win32") {
        const appData = process.env.APPDATA;
        if (!appData) return undefined;
        return path.join(appData, product, "User");
    }
    return path.join(home(), ".config", product, "User");
}

export function userSettingsPath(userDir: string) {
    return path.join(userDir, "settings.json");
}
export function userKeybindingsPath(userDir: string) {
    return path.join(userDir, "keybindings.json");
}
export function userSnippetsDir(userDir: string) {
    return path.join(userDir, "snippets");
}
