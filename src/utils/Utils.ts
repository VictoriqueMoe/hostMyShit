import { fileURLToPath } from "node:url";
import path from "node:path";
import TimeUnit from "../model/constants/TimeUnit.js";
import process from "node:process";
import type { Request } from "express";
import fs from "node:fs/promises";
import type { PlatformContext, PlatformMulterFile } from "@tsed/common";
import { FileUploadModel } from "../model/db/FileUpload.model.js";
import { isFormatSupportedByFfmpeg } from "./ffmpgWrapper.js";
import { WorkerResponse } from "./typeings.js";
import { Worker } from "node:worker_threads";
import * as crypto from "node:crypto";
import { constant } from "@tsed/di";
import GlobalEnv from "../model/constants/GlobalEnv.js";
import { BadRequest } from "@tsed/exceptions";
import { InjectContext } from "@tsed/di";

export class ObjectUtils {
    public static getNumber(source: string): number {
        const matches = source.match(/-?\d+/g);
        return matches && matches[0] ? parseInt(matches[0]) : 0;
    }

    public static enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
        return Object.keys(obj).filter(k => !Number.isNaN(k)) as K[];
    }

    public static humanFileSize(bytes: number, si = false, dp = 1): string {
        const thresh = si ? 1000 : 1024;

        if (Math.abs(bytes) < thresh) {
            return bytes + " B";
        }

        const units = si
            ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
            : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
        let u = -1;
        const r = 10 ** dp;

        do {
            bytes /= thresh;
            ++u;
        } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

        return bytes.toFixed(dp) + " " + units[u];
    }

    public static timeToHuman(value: number, timeUnit: TimeUnit = TimeUnit.MILLI_SECONDS): string {
        let seconds: number;
        if (timeUnit === TimeUnit.MILLI_SECONDS) {
            seconds = Math.round(value / 1000);
        } else if (timeUnit !== TimeUnit.SECONDS) {
            seconds = Math.round(ObjectUtils.convertToMilli(value, timeUnit) / 1000);
        } else {
            seconds = Math.round(value);
        }
        if (Number.isNaN(seconds)) {
            throw new Error("Unknown error");
        }
        const levels: [number, string][] = [
            [Math.floor(seconds / 31536000), "years"],
            [Math.floor((seconds % 31536000) / 86400), "days"],
            [Math.floor(((seconds % 31536000) % 86400) / 3600), "hours"],
            [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), "minutes"],
            [Math.floor((((seconds % 31536000) % 86400) % 3600) % 60), "seconds"],
        ];
        let returnText = "";

        for (let i = 0, max = levels.length; i < max; i++) {
            if (levels[i][0] === 0) {
                continue;
            }
            returnText += ` ${levels[i][0]} ${levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length - 1) : levels[i][1]}`;
        }
        return returnText.trim();
    }

    public static convertToMilli(value: number, unit: TimeUnit): number {
        switch (unit) {
            case TimeUnit.SECONDS:
                return value * 1000;
            case TimeUnit.MINUTES:
                return value * 60000;
            case TimeUnit.HOURS:
                return value * 3600000;
            case TimeUnit.DAYS:
                return value * 86400000;
            case TimeUnit.WEEKS:
                return value * 604800000;
            case TimeUnit.MONTHS:
                return value * 2629800000;
            case TimeUnit.YEARS:
                return value * 31556952000;
            case TimeUnit.DECADES:
                return value * 315569520000;
            default:
                return -1;
        }
    }

    public static removeObjectFromArray<T>(arr: T[], predicate: (itm: T) => boolean): void {
        let arrLen = arr.length;
        while (arrLen--) {
            const currentItem = arr[arrLen];
            if (predicate(currentItem)) {
                arr.splice(arrLen, 1);
            }
        }
    }
}

export class FileUtils {
    private static readonly minExpiration = 30 * 24 * 60 * 60 * 1000;
    private static readonly maxExpiration = 365 * 24 * 60 * 60 * 1000;

    public static isFileExpired(entry: FileUploadModel): boolean {
        const expired = FileUtils.getTimeLeft(entry);
        return expired === null ? false : expired <= 0;
    }

    public static isImage(file: FileUploadModel): boolean {
        return file.mediaType?.startsWith("image/") ?? false;
    }

    public static isVideo(file: FileUploadModel): boolean {
        return file.mediaType?.startsWith("video/") ?? false;
    }

    public static isValidForThumbnail(file: FileUploadModel): boolean {
        return (
            (FileUtils.isImage(file) || FileUtils.isVideoSupportedByFfmpeg(file)) && file.fileProtectionLevel === "None"
        );
    }

    public static isVideoSupportedByFfmpeg(file: FileUploadModel): boolean {
        if (!FileUtils.isVideo(file)) {
            return false;
        }
        if (file.fileExtension) {
            return isFormatSupportedByFfmpeg(file.fileExtension);
        }
        return false;
    }

    public static getExtension(file: string): string {
        return path.extname(file).slice(1);
    }

    public static getTimeLeft(entry: FileUploadModel): number | null {
        return entry.expires === null ? null : entry.expires - Date.now();
    }

    public static getTimeLeftBySize(filesize: number): number {
        const ttl = Math.floor(
            (FileUtils.minExpiration - FileUtils.maxExpiration) *
                Math.pow(filesize / (Number.parseInt(process.env.FILE_SIZE_UPLOAD_LIMIT_MB!) * 1048576) - 1, 3),
        );
        return ttl < FileUtils.minExpiration ? FileUtils.minExpiration : ttl;
    }

    public static getExpiresBySize(filesize: number, dateToUse = Date.now()): number {
        return dateToUse + this.getTimeLeftBySize(filesize);
    }

    public static async getFilesCount(): Promise<number> {
        try {
            const realFiles = await fs.readdir(filesDir, { withFileTypes: true });
            return realFiles.length;
        } catch {
            return 0;
        }
    }

    public static deleteFile(file: string | PlatformMulterFile, force = true): Promise<void> {
        const toDelete = this.getFilePath(file);
        return fs.rm(toDelete, { recursive: true, force });
    }

    public static async getFileSize(file: string | PlatformMulterFile | FileUploadModel): Promise<number> {
        const f = this.getFilePath(file);
        const stat = await fs.stat(f);
        return stat.size;
    }

    public static getFilePath(file: string | PlatformMulterFile | FileUploadModel): string {
        if (file instanceof FileUploadModel) {
            return file.fullLocationOnDisk;
        }
        return typeof file === "string" ? `${filesDir}/${file}` : file.path;
    }

    public static async fileExists(file: string): Promise<boolean> {
        try {
            await fs.access(file, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
}

export class NetworkUtils {
    public static getIp(req: Request): string {
        const useCf = process.env.USE_CLOUDFLARE === "true";
        let ip: string;
        if (useCf && req.headers["cf-connecting-ip"]) {
            ip = req.headers["cf-connecting-ip"] as string;
        } else {
            ip = req.ip as string;
        }
        const extractedIp = this.extractIp(ip);
        const salt = constant(GlobalEnv.IP_SALT, "");
        return crypto
            .createHash("sha256")
            .update(extractedIp + salt)
            .digest("hex");
    }

    private static extractIp(ipString: string): string {
        const ipSplit = ipString.split(":");
        if (ipSplit.length === 1 || (ipSplit.length > 2 && !ipString.includes("]"))) {
            return ipString;
        }
        if (ipSplit.length === 2) {
            return ipSplit[0];
        }
        return ipSplit
            .slice(0, ipSplit.length - 1)
            .join(":")
            .replace(/\[/, "")
            .replace(/]/, "");
    }
}

export class WorkerUtils {
    @InjectContext()
    protected static $ctx?: PlatformContext;

    public static workerMap = new Map<string, number>();
    public static limitMap = new Map<string, number>();

    public static newWorker<T = void>(file: string | URL, data: Record<string, unknown>): [Promise<T>, Worker] {
        if (typeof file === "string") {
            // if string, the file ust be relative to the `workers` folder
            file = new URL(`../workers/${file}`, import.meta.url);
        }

        const limitKey = file.pathname.substring(file.pathname.lastIndexOf("/") + 1);

        const ip = NetworkUtils.getIp(this.$ctx?.request.request) + ":" + limitKey;
        let processCount = this.workerMap.get(ip) ?? 0;
        const limit = this.limitMap.get(limitKey);
        if (limit) {
            if (processCount >= limit) {
                throw new BadRequest("Too many processes");
            }
        }

        const worker = new Worker(file, {
            workerData: data,
        });

        processCount++;
        this.workerMap.set(ip, processCount);

        const p: Promise<T> = new Promise((resolve, reject): void => {
            worker.on("message", (message: WorkerResponse<T>) => {
                if (message.success) {
                    resolve(message.data);
                } else {
                    reject(new Error(message.error));
                }
            });
            worker.on("error", reject);
            worker.on("exit", code => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
                if (limit) {
                    processCount = this.workerMap.get(ip) ?? 0;
                    processCount--;
                    if (processCount <= 0) {
                        this.workerMap.delete(ip);
                    } else {
                        this.workerMap.set(ip, processCount);
                    }
                }
            });
        });

        return [p, worker];
    }
}

export const filesDir = `${path.dirname(fileURLToPath(import.meta.url))}/../../files`;
