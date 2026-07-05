import { defineConfig } from '@prisma/config'
import * as dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  migrations: {
    seed: 'ts-node ./prisma/seed.ts',
  },
  datasource: {
    url: process.env.POSTGRES_URL_NON_POOLING as string,
  },
})
