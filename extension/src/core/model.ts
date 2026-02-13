export type IdeFlavor = "windsurf" | "antigravity" | "vscode" | "unknown";

export type ProfileManifest = {
    schemaVersion: 1;
    id: string;
    name: string;
    createdAt: string; // ISO
    ide: { flavor: IdeFlavor; appName: string; vscodeVersion: string };
    machine: { platform: NodeJS.Platform; arch: string };
    includes: {
        userSettings: boolean;
        userKeybindings: boolean;
        userSnippets: boolean;
        workspaceVscodeDir: boolean;
        rulesAndWorkflows: boolean;
        extensions: boolean;
    };
    paths: {
        userDir?: string;
        workspaceRoot?: string;
    };
    extensions?: Array<{
        id: string;        // publisher.name
        version?: string;
        isBuiltin: boolean;
    }>;
    files: Array<{
        logicalPath: string;
        sha256: string;
        bytes: number;
    }>;
};

export type ProfileSnapshot = {
    manifest: ProfileManifest;
    blobs: Map<string, Buffer>; // key = logicalPath
};

export type ProfileListItem = {
    id: string;
    name: string;
    createdAt: string;
    ideFlavor: IdeFlavor;
};
