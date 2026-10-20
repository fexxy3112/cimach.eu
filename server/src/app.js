import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { randomBytes } from 'node:crypto'
import { createAdminRouter, createAuthRouter } from './auth/routes.js'
import { requireSameOriginCsrf } from './auth/csrf.js'

export async function createApp({ pool, config, dummyPasswordHash }) {
  const fallbackHash = dummyPasswordHash || await bcrypt.hash(randomBytes(32).toString('hex'), 12)
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxyCidrs.length ? config.trustProxyCidrs : false)
  app.use(helmet())
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, false)
      return callback(null, origin === config.frontendOrigin)
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CIMACH-CSRF'],
    maxAge: 600,
  }))
  app.use(express.json({ limit: '16kb', strict: true }))
  app.use(cookieParser())
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', requireSameOriginCsrf(config.frontendOrigin))

  app.get('/api/healthz', (_req, res) => res.status(200).json({ status: 'ok' }))
  app.use('/api', createAuthRouter({ pool, config, dummyPasswordHash: fallbackHash }))
  app.use('/api/admin', createAdminRouter({ pool, config }))

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'request_too_large' })
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_request' })
    return res.status(500).json({ error: 'internal_error' })
  })

  return app
}
