import * as vscode from 'vscode';
import * as fs from 'fs/promises';

/**
 * Class to support partial file reads for vscode
 */
export class ElfFileReader {
    private filePath: string;

    constructor(uri: vscode.Uri) {
        this.filePath = uri.fsPath;
    }

    /**
     * Reads a chunk of the file starting at the given offset
     */
    async readChunk(offset: number, length: number): Promise<Uint8Array> {
        const fileHandle = await fs.open(this.filePath, 'r');
        try {
            const buffer = Buffer.alloc(length);
            const { bytesRead } = await fileHandle.read(buffer, 0, length, offset);
            return new Uint8Array(buffer.subarray(0, bytesRead));
        } finally {
            await fileHandle.close();
        }
    }
}