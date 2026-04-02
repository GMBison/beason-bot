import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string(),
  APP_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_SUPER_ADMIN_ID: z.coerce.bigint(),
  TELEGRAM_NOTIFICATION_CHAT_ID: z.coerce.bigint(),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  ADMIN_SESSION_SECRET: z.string().min(32),
  BEASON_PRODUCT_CODE: z.string().min(1),
  BEASON_ISSUER_MODE: z.enum(["remote"]),
  BEASON_ISSUER_ENDPOINT: z.string().url(),
  BEASON_ISSUER_API_KEY: z.string().min(1),
  DEFAULT_TIMEZONE: z.string().default("Africa/Lagos"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "BEASON License Admin",
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  SUPABASE_URL: process.env.SUPABASE_URL ?? "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "placeholder-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role-key",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "placeholder-telegram-token",
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET ?? "placeholder-telegram-secret",
  TELEGRAM_SUPER_ADMIN_ID: process.env.TELEGRAM_SUPER_ADMIN_ID ?? "0",
  TELEGRAM_NOTIFICATION_CHAT_ID: process.env.TELEGRAM_NOTIFICATION_CHAT_ID ?? "0",
  ADMIN_USERNAME: process.env.ADMIN_USERNAME ?? "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "change-me-now",
  ADMIN_SESSION_SECRET:
    process.env.ADMIN_SESSION_SECRET ?? "replace-this-with-a-long-secure-admin-session-secret",
  BEASON_PRODUCT_CODE: process.env.BEASON_PRODUCT_CODE ?? "BEASON-CBT",
  BEASON_ISSUER_MODE: process.env.BEASON_ISSUER_MODE ?? "remote",
  BEASON_ISSUER_ENDPOINT:
    process.env.BEASON_ISSUER_ENDPOINT ?? "https://issuer.example.com/license/issue",
  BEASON_ISSUER_API_KEY: process.env.BEASON_ISSUER_API_KEY ?? "placeholder-issuer-key",
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE ?? "Africa/Lagos",
});
