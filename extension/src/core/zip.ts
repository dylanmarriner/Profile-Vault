import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import yazl from "yazl";
import yauzl from "yauzl";

// Type declarations for yazl and yauzl
interface ZipFile {
    addFile(filePath: string, metaPath: string): void;
    end(): void;
    outputStream: NodeJS.ReadableStream;
}

interface Entry {
    fileName: string;
}

interface YauzlZipFile {
    readEntry(): void;
    openReadStream(entry: Entry, callback: (err: Error | null, stream?: NodeJS.ReadableStream) => void): void;
    on(event: string, listener: (...args: any[]) => void): void;
    close(): void;
}

export async function zipFolderToFile(folderPath: string, outFile: string): Promise<void> {
    await fsp.mkdir(path.dirname(outFile), { recursive: true });

    const zip = new yazl.ZipFile();
    const out = fs.createWriteStream(outFile);

    const done = new Promise<void>((resolve, reject) => {
        out.on("close", () => resolve());
        out.on("error", reject);
        zip.outputStream.pipe(out);
    });

    async function addDir(dir: string, prefix: string) {
        const ents = await fsp.readdir(dir, { withFileTypes: true });
        for (const ent of ents) {
            const full = path.join(dir, ent.name);
            const rel = path.posix.join(prefix, ent.name);
            if (ent.isDirectory()) await addDir(full, rel);
            else if (ent.isFile()) zip.addFile(full, rel);
        }
    }

    await addDir(folderPath, "");
    zip.end();
    await done;
}

export async function unzipFileToFolder(zipFile: string, outFolder: string): Promise<void> {
    await fsp.mkdir(outFolder, { recursive: true });

    const openZip = (): Promise<YauzlZipFile> =>
        new Promise((resolve, reject) => {
            yauzl.open(zipFile, { lazyEntries: true }, (err: Error | null, zf: YauzlZipFile | undefined) => {
                if (err || !zf) reject(err ?? new Error("Failed to open zip"));
                else resolve(zf);
            });
        });

    const zf = await openZip();

    await new Promise<void>((resolve, reject) => {
        zf.readEntry();

        zf.on("entry", (entry: Entry) => {
            const filePath = path.join(outFolder, entry.fileName);

            if (/\/$/.test(entry.fileName)) {
                fsp.mkdir(filePath, { recursive: true })
                    .then(() => zf.readEntry())
                    .catch(reject);
                return;
            }

            fsp.mkdir(path.dirname(filePath), { recursive: true })
                .then(() => {
                    zf.openReadStream(entry, (err: Error | null, rs: NodeJS.ReadableStream | undefined) => {
                        if (err || !rs) return reject(err ?? new Error("Read stream error"));
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
