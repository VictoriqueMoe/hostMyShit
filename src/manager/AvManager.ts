import { Inject, Injectable, OnInit } from "@tsed/di";
import { AvFactory } from "../factory/AvFactory.js";
import type { PlatformMulterFile } from "@tsed/common";
import { Logger } from "@tsed/logger";
import { FileEngine } from "../engine/impl/index.js";
import { BadRequest } from "@tsed/exceptions";
import path from "node:path";
import { IAvEngine } from "../engine/IAvEngine.js";
import { AvScanResult } from "../utils/typeings.js";

@Injectable()
export class AvManager implements OnInit {
    private avEngines: IAvEngine[];

    public constructor(
        @Inject() private avFactory: AvFactory,
        @Inject() private logger: Logger,
        @Inject() private fileEngine: FileEngine,
    ) {}

    public async $onInit(): Promise<void> {
        this.avEngines = await this.avFactory.getAvEngines();
        if (this.avEngines.length === 0) {
            this.logger.warn("No AV is enabled! AV scanning is disabled");
        } else if (this.avEngines.length === 1) {
            this.logger.info(`Using av engine ${this.avEngines[0].name} to scan files`);
        } else {
            this.logger.info(
                `Multiple AV engines are enabled, the engines will be used to scan files in the following order: ${this.avEngines.map(e => e.name).join(", ")}`,
            );
        }
    }

    public async scanFile(file: string | PlatformMulterFile): Promise<void> {
        if (this.avEngines.length === 0) {
            return;
        }
        const resource = typeof file === "string" ? path.basename(file) : file.filename;
        const scanResults = await this.doScan(resource);

        for (const scanResult of scanResults) {
            if (scanResult.passed) {
                continue;
            }
            const fileExists = await this.fileEngine.fileExists(resource);
            if (fileExists) {
                try {
                    await this.fileEngine.deleteFile(file, false);
                } catch (e) {
                    // this basically means we could not delete the virus...
                    this.logger.error(`Unable to delete resource ${resource} after positive AV detection`);
                    throw new BadRequest(e.message);
                }
            }
            let errStr = `AV engine ${scanResult.engineName} found issues `;
            if (scanResult.additionalMessage) {
                errStr += `AV scan of resource ${resource} for issues terminated with message "${scanResult.additionalMessage}"`;
            }
            if (scanResult.errorCode) {
                errStr += ` scan exited with code ${scanResult.errorCode}`;
            }
            if (errStr === "") {
                // the scan found issues but nothing was reported
                errStr = "AV Scan ended with no reported reason";
            }
            this.logger.warn(errStr);
            throw new BadRequest("Failed to store file");
        }
    }

    private doScan(resource: string): Promise<AvScanResult[]> {
        const pArr = this.avEngines.map(engine => engine.scan(resource));
        return Promise.all(pArr);
    }
}
