import dotenv from "dotenv";
import { Env } from "@tsed/core";
import { WorkerUtils } from "../../utils/Utils.js";

export const envs = {
    ...process.env,
    ...dotenv.config().parsed,
};
export const isProduction = process.env.NODE_ENV === Env.PROD;

const processLimits = process.env.PROCESS_LIMITS ?? "";
processLimits.split(",").forEach(x => {
    const splitLimit = x.split(":");
    WorkerUtils.limitMap.set(splitLimit[0], parseInt(splitLimit[1], 10));
});
