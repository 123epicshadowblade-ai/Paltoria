import { fileURLToPath } from "url";
import path from "path";
import botConfig, { validateConfig } from "./bot.js";
import { shopConfig as shop } from "./shop/index.js";
import { pgConfig } from "./database/postgres.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appConfig = {
  paths: {
    root: path.join(__dirname, "../.."),
    commands: path.join(__dirname, "../commands"),
    events: path.join(__dirname, "../events"),
    config: __dirname,
    utils: path.join(__dirname, "../utils"),
    services: path.join(__dirname, "../services"),
    handlers: path.join(__dirname, "../handlers"),
    interactions: path.join(__dirname, "../interactions"),
  },

  bot: {
    ...botConfig,
    token: process.env.DISCORD_TOKEN || process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    // Retained for tutorial/setup compatibility; not used for command registration.
    guildId: process.env.GUILD_ID,

    shop: {
      ...botConfig.shop,
      ...shop,
    },
  },

  // PostgreSQL configuration - Primary production database
  postgresql: {
    ...pgConfig,
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: {
      enabled: process.env.LOG_TO_FILE === "true",
      path: path.join(__dirname, "../../logs"),
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    },
    console: {
      enabled: true,
      colorize: true,
      timestamp: true,
    },
    sentry: {
      enabled: process.env.SENTRY_DSN ? true : false,
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
    },
  },

  api: {
    port: process.env.PORT || 3000,
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
  },

  shop,

  kofi: {
    verificationToken: process.env.KOFI_VERIFICATION_TOKEN || null,
    pageUrl: process.env.KOFI_PAGE_URL || null,
    claimExpiryMinutes: Number(process.env.VIP_CLAIM_EXPIRY_MINUTES || 60),
  },

  palworld: {
    apiKey: process.env.PALWORLD_API_KEY || null,
    rcon: {
      host: process.env.PALWORLD_RCON_HOST || null,
      port: Number(process.env.PALWORLD_RCON_PORT || 0) || null,
      password: process.env.PALWORLD_RCON_PASSWORD || null,
      maxPlayers: Number(process.env.PALWORLD_MAX_PLAYERS || 0) || null,
    },
    sftp: {
      host: process.env.PALWORLD_SFTP_HOST || null,
      port: Number(process.env.PALWORLD_SFTP_PORT || 0) || null,
      username: process.env.PALWORLD_SFTP_USERNAME || null,
      password: process.env.PALWORLD_SFTP_PASSWORD || null,
      statsFilePath: process.env.PALWORLD_STATS_FILE_PATH
        || '/Pal/Binaries/Win64/ue4ss/Mods/PaltoriaStatsReport/stats.json',
    },
  },

  features: {
    ...botConfig.features,
    music: botConfig.features?.music ?? true,
  },

  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
};

Object.freeze(appConfig);

export default appConfig;