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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zipFolderToFile = zipFolderToFile;
exports.unzipFileToFolder = unzipFileToFolder;
const fs = __importStar(require("fs"));
const fsp = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yazl_1 = __importDefault(require("yazl"));
const yauzl_1 = __importDefault(require("yauzl"));
async function zipFolderToFile(folderPath, outFile) {
    await fsp.mkdir(path.dirname(outFile), { recursive: true });
    const zip = new yazl_1.default.ZipFile();
    const out = fs.createWriteStream(outFile);
    const done = new Promise((resolve, reject) => {
        out.on("close", () => resolve());
        out.on("error", reject);
        zip.outputStream.pipe(out);
    });
    async function addDir(dir, prefix) {
        const ents = await fsp.readdir(dir, { withFileTypes: true });
        for (const ent of ents) {
            const full = path.join(dir, ent.name);
            const rel = path.posix.join(prefix, ent.name);
            if (ent.isDirectory())
                await addDir(full, rel);
            else if (ent.isFile())
                zip.addFile(full, rel);
        }
    }
    await addDir(folderPath, "");
    zip.end();
    await done;
}
async function unzipFileToFolder(zipFile, outFolder) {
    await fsp.mkdir(outFolder, { recursive: true });
    const openZip = () => new Promise((resolve, reject) => {
        yauzl_1.default.open(zipFile, { lazyEntries: true }, (err, zf) => {
            if (err || !zf)
                reject(err ?? new Error("Failed to open zip"));
            else
                resolve(zf);
        });
    });
    const zf = await openZip();
    await new Promise((resolve, reject) => {
        zf.readEntry();
        zf.on("entry", (entry) => {
            const filePath = path.join(outFolder, entry.fileName);
            if (/\/$/.test(entry.fileName)) {
                fsp.mkdir(filePath, { recursive: true })
                    .then(() => zf.readEntry())
                    .catch(reject);
                return;
            }
            fsp.mkdir(path.dirname(filePath), { recursive: true })
                .then(() => {
                zf.openReadStream(entry, (err, rs) => {
                    if (err || !rs)
                        return reject(err ?? new Error("Read stream error"));
                    const ws = fs.createWriteStream(filePath);
                    rs.pipe(ws);
                    ws.on("close", () => zf.readEntry());
                    ws.on("error", reject);
                });
            })
                .catch(reject);
        });
        zf.on("end", () => resolve());
        zf.on("error", reject);
    });
    zf.close();
}
