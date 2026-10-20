import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { randomBytes } from 'node:crypto'
import { createAuthService } from './services/auth.service.js'
import { requireSameOriginCsrf } from './middleware/csrf.middleware.js'
import { errorHandler, notFound } from './middleware/error.middleware.js'
import { createApiRouter } from './routes/index.js'

export async function createApp({ pool, config, dummyPasswordHash }) {
  const fallbackHash = dummyPasswordHash || await bcrypt.hash(randomBytes(32).toString('hex'), 12)
  const authService = createAuthService({ pool, config, dummyPasswordHash: fallbackHash })
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
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CIMACH-CSRF'],
    maxAge: 600,
  }))
  app.use(express.json({ limit: '256kb', strict: true }))
  app.use(cookieParser())
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', requireSameOriginCsrf(config.frontendOrigin))

  app.use('/api', createApiRouter({ authService, config, pool }))
  app.use('/api', notFound)
  app.use(errorHandler)

  return app
}
