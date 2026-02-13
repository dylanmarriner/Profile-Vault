import { ProfileManifest } from "./model";

export type ProfileDiff = {
    filesAdded: string[];
    filesRemoved: string[];
    filesChanged: string[];
    extensionsAdded: string[];
    extensionsRemoved: string[];
    extensionsVersionChanged: Array<{ id: string; from?: string; to?: string }>;
};

export function diffManifests(a: ProfileManifest, b: ProfileManifest): ProfileDiff {
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
