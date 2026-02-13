"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffManifests = diffManifests;
function diffManifests(a, b) {
    const aFiles = new Map(a.files.map(f => [f.logicalPath, f.sha256]));
    const bFiles = new Map(b.files.map(f => [f.logicalPath, f.sha256]));
    const filesAdded = [];
    const filesRemoved = [];
    const filesChanged = [];
    for (const [p, h] of bFiles.entries()) {
        if (!aFiles.has(p))
            filesAdded.push(p);
        else if (aFiles.get(p) !== h)
            filesChanged.push(p);
    }
    for (const p of aFiles.keys()) {
        if (!bFiles.has(p))
            filesRemoved.push(p);
    }
    const aExt = new Map((a.extensions ?? []).map(e => [e.id, e.version]));
    const bExt = new Map((b.extensions ?? []).map(e => [e.id, e.version]));
    const extensionsAdded = [];
    const extensionsRemoved = [];
    const extensionsVersionChanged = [];
    for (const [id, v] of bExt.entries()) {
        if (!aExt.has(id))
            extensionsAdded.push(id);
        else if (aExt.get(id) !== v)
            extensionsVersionChanged.push({ id, from: aExt.get(id), to: v });
    }
    for (const id of aExt.keys()) {
        if (!bExt.has(id))
            extensionsRemoved.push(id);
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
