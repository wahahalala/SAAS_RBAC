import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface StoredFile {
    /** Absolute path on disk — persisted in `Report.filePath`, never sent to clients. */
    filePath: string;
    fileName: string;
    fileSize: number;
}

/**
 * Local-disk artifact storage.
 *
 * Reports are written under a per-tenant directory so the layout mirrors the
 * isolation boundary; the download endpoint still re-checks membership rather
 * than trusting the path.
 *
 * `REPORTS_DIR` lets a deployment point this at a mounted volume; the default
 * is `storage/reports` relative to the process working directory.
 */
@Injectable()
export class ReportStorageService {
    private readonly logger = new Logger(ReportStorageService.name);
    private readonly rootDir: string;

    constructor() {
        // An empty-string env var must not win over the default: `??` would
        // accept "" and resolve the root to the working directory itself.
        const configured = process.env.REPORTS_DIR?.trim();

        this.rootDir = configured
            ? resolve(configured)
            : resolve(join(process.cwd(), "storage", "reports"));

        this.logger.log(`Report storage root: ${this.rootDir}`);
    }

    /**
     * Persist a generated artifact.
     *
     * `reportId` is part of the filename so two concurrent reports for the same
     * tenant/type cannot overwrite each other.
     */
    async save(params: {
        tenantId: string;
        reportId: string;
        type: string;
        extension: string;
        content: Buffer | string;
    }): Promise<StoredFile> {
        const directory = join(this.rootDir, params.tenantId);
        await mkdir(directory, { recursive: true });

        const fileName = `${params.type}-${params.reportId}.${params.extension}`;
        const filePath = join(directory, fileName);

        const buffer =
            typeof params.content === "string"
                ? Buffer.from(params.content, "utf8")
                : params.content;

        await writeFile(filePath, buffer);

        return { filePath, fileName, fileSize: buffer.byteLength };
    }

    /** The declared root, for diagnostics/health. */
    getRootDir(): string {
        return this.rootDir;
    }
}
