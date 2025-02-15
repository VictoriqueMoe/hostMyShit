const prefix = "envs.";

/**
 * Env to be used in `@Constant` decorators
 */
enum GlobalEnv {
    PORT = `${prefix}PORT`,
    SESSION_KEY = `${prefix}SESSION_KEY`,
    HTTPS = `${prefix}HTTPS`,
    HTTPS_PORT = `${prefix}HTTPS_PORT`,
    NODE_ENV = `${prefix}NODE_ENV`,
    BASE_URL = `${prefix}BASE_URL`,
    FILE_SIZE_UPLOAD_LIMIT_MB = `${prefix}FILE_SIZE_UPLOAD_LIMIT_MB`,
    CLAM_PATH = `${prefix}CLAM_PATH`,
    BLOCKED_MIME_TYPES = `${prefix}BLOCKED_MIME_TYPES`,
    USE_CLOUDFLARE = `${prefix}USE_CLOUDFLARE`,
    MAX_URL_LENGTH = `${prefix}MAX_URL_LENGTH`,
    MS_DEFENDER_PATH = `${prefix}MS_DEFENDER_PATH`,
    CAPTCHA_SITE_KEY = `${prefix}CAPTCHA_SITE_KEY`,
    CAPTCHA_SECRET_KEY = `${prefix}CAPTCHA_SECRET_KEY`,
    FILE_CLEANER_CRON = `${prefix}FILE_CLEANER_CRON`,
    SALT = `${prefix}SALT`,
    UPLOAD_SECRET = `${prefix}UPLOAD_SECRET`,
    RATE_LIMIT = `${prefix}RATE_LIMIT`,
    RATE_LIMIT_MS = `${prefix}RATE_LIMIT_MS`,
    REDIS_URI = `${prefix}REDIS_URI`,
    ZIP_MAX_SIZE_MB = `${prefix}ZIP_MAX_SIZE_MB`,
    IP_SALT = `${prefix}IP_SALT`,
    PROCESS_LIMITS = `${prefix}PROCESS_LIMITS`,
}

export default GlobalEnv;
