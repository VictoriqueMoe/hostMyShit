import {Configuration, Constant, Inject} from "@tsed/di";
import type {BeforeRoutesInit} from "@tsed/common";
import {PlatformApplication} from "@tsed/common";
import "@tsed/platform-express";
import "@tsed/ajv";
import "@tsed/swagger";
// custom index imports
import "./protocols/index.js";
import "./filters/index.js";
import "./engine/impl/index.js";
import * as rest from "./controllers/rest/index.js";
import "./services/FileCleaner.js";
import * as views from "./controllers/views/index.js";
import * as adminViews from './controllers/secure/index.js';
import * as globalMiddleware from "./middleware/global/index.js";
import {FileServerController} from "./controllers/serve/FileServerController.js";
// import * as secureViews from "./controllers/secureViews";
// custom index imports end
import {config} from "./config/index.js";
import {CustomUserInfoModel} from "./model/auth/CustomUserInfoModel.js";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import session from "express-session";
import methodOverride from "method-override";
import {isProduction} from "./config/envs/index.js";
import helmet from "helmet";
import process from "process";
import cors from "cors";
import {TypeormStore} from "connect-typeorm";
import {SQLITE_DATA_SOURCE} from "./model/di/tokens.js";
import {DataSource} from "typeorm";
import {SessionModel} from "./model/db/Session.model.js";
import compression from "compression";
import GlobalEnv from "./model/constants/GlobalEnv.js";
import multer from "multer";
import path from "node:path";
import rateLimit from "express-rate-limit";
import {LRUCache} from "lru-cache";
import {filesDir, FileUtils, NetworkUtils} from "./utils/Utils.js";
import {fileURLToPath} from "node:url";

const opts: Partial<TsED.Configuration> = {
    ...config,
    acceptMimes: ["application/json"],
    httpPort: process.env.PORT ?? 8083,
    httpsPort: (function (): number | boolean {
        if (process.env.HTTPS === "true") {
            return Number.parseInt(process.env.HTTPS_PORT as string);
        }
        return false;
    }()),
    multer: {
        dest: filesDir,
        limits: {
            fileSize: Number.parseInt(process.env.FILE_SIZE_UPLOAD_LIMIT_MB as string) * 1048576
        },
        storage: multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, filesDir);
            },
            filename: function (req, file, cb) {
                const ext = FileUtils.getExtension(file.originalname);
                const fileName = ext ? `${Date.now()}.${ext}` : `${Date.now()}`;
                return cb(null, fileName);
            }
        }),
        preservePath: true
    },
    passport: {
        userInfoModel: CustomUserInfoModel
    },
    mount: {
        "/rest": [
            ...Object.values(rest)
        ],
        "/": [
            ...Object.values(views)
        ],
        "/f": [
            FileServerController
        ],
        "/admin": [
            ...Object.values(adminViews)
        ]
    },
    statics: {
        "/assets": [
            {
                root: `${path.dirname(fileURLToPath(import.meta.url))}/public/assets`
            }
        ],
        "/favicon.ico": [
            {
                // for safari...
                root: `${path.dirname(fileURLToPath(import.meta.url))}/public/assets/custom/images/favicon.ico`
            }
        ],
        "/robots.txt": [
            {
                root: `${path.dirname(fileURLToPath(import.meta.url))}/public/robots.txt`
            }
        ]
    },
    socketIO: {
        cors: {
            origin: process.env.BASE_URL
        }
    },
    middlewares: [
        helmet({
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: {
                policy: "cross-origin"
            },
            crossOriginEmbedderPolicy: {
                policy: "credentialless"
            }
        }),
        cors({
            origin: process.env.BASE_URL,
            exposedHeaders: ["Location"]
        }),
        cookieParser(),
        methodOverride(),
        bodyParser.json(),
        bodyParser.urlencoded({
            extended: true
        }),
        compression(),
        rateLimit({
            windowMs: 1000,
            limit: 1,
            message: "You have exceeded your 1 request a second.",
            standardHeaders: true,
            skip: (request) => {
                if (request?.$ctx?.request?.request?.session?.passport) {
                    return true;
                }
                return request.path.includes("/admin") ? true : !request.path.includes("/rest");
            },
            keyGenerator: (request) => {
                return NetworkUtils.getIp(request);
            }
        }),
        ...Object.values(globalMiddleware)
    ],
    views: {
        root: `${path.dirname(fileURLToPath(import.meta.url))}/public`,
        viewEngine: "ejs",
        extensions: {
            ejs: "ejs"
        },
        options: {
            ejs: {
                rmWhitespace: false,
                cache: isProduction ? LRUCache : null
            }
        }
    },
    swagger: [
        {
            path: "/api-docs",
            specVersion: "3.0.3",
            options: {
                withCredentials: true
            }
        }
    ],
    exclude: [
        "**/*.spec.ts"
    ]
};

@Configuration(opts)
export class Server implements BeforeRoutesInit {

    public constructor(
        @Inject() private app: PlatformApplication,
        @Inject(SQLITE_DATA_SOURCE) private ds: DataSource
    ) {
    }

    @Configuration()
    protected settings: Configuration;

    @Constant(GlobalEnv.SESSION_KEY)
    private readonly sessionKey: string;

    @Constant(GlobalEnv.HTTPS)
    private readonly https: string;

    public $beforeRoutesInit(): void {
        if (isProduction) {
            this.app.getApp().set("trust proxy", 1);
        }
        if (this.sessionKey) {
            this.app.use(session({
                secret: this.sessionKey,
                resave: false,
                store: new TypeormStore({
                    cleanupLimit: 2,
                }).connect(this.ds.getRepository(SessionModel)),
                saveUninitialized: false,
                cookie: {
                    path: "/",
                    httpOnly: true,
                    maxAge: 86400000,
                    secure: this.https === "true",
                    sameSite: "strict"
                }
            }));
        }
    }
}
