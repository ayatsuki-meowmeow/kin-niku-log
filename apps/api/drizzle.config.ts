import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.dev.vars' });

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // drizzle-kit は direct 接続(DATABASE_URL_DIRECT)を優先し、無ければ pooled(DATABASE_URL)にフォールバックする
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!,
  },
});

