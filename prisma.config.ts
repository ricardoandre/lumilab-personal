// Prisma 7 moved connection URLs out of schema.prisma and into here.
// Single environment: APP_DB_URL is lumilab_personal, the only database this
// app has. There is no sandbox — see .env for why.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('APP_DB_URL'),
    shadowDatabaseUrl: env('SHADOW_DB_URL'),
  },
});
