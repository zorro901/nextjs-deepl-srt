import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'
const toggle = z.enum(['true', 'false', '0', '1']).transform(v => v === 'true' || v === '1')

export const env = createEnv({
  server: {
    DEBUG: toggle.default('false'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DEEPL_SERVER_URL: z.string().url()
  },
  runtimeEnv: {
    DEBUG: process.env.DEBUG,
    NODE_ENV: process.env.NODE_ENV,
    DEEPL_SERVER_URL: process.env.DEEPL_SERVER_URL
  }
})
