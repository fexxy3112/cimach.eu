import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { rateLimit } from 'express-rate-limit'
import { authCookieOptions, clearAuthCookie, createAuthenticate, requireRole } from './middleware.js'
import { issueAccessToken, verifyAccessToken } from './tokens.js'

const genericLoginError = { error: 'invalid_credentials' }

export function createAuthRouter({ pool, config, dummyPasswordHash }) {
  const router = Router()
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_req, res) => res.status(429).json({ error: 'rate_limited' }),
  })

  router.post('/auth/login', loginLimiter, async (req, res, next) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!email || !password || email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
      await bcrypt.compare('invalid-input', dummyPasswordHash)
      return res.status(401).json(genericLoginError)
    }

    try {
      const [rows] = await pool.execute(
        `SELECT id, email, password_hash, role, is_active
         FROM users WHERE email = ? LIMIT 1`,
        [email],
      )
      const user = rows[0]
      const passwordMatches = await bcrypt.compare(password, user?.password_hash || dummyPasswordHash)

      if (!user || !passwordMatches || !user.is_active || user.role !== 'admin') {
        return res.status(401).json(genericLoginError)
      }

      const sessionId = randomUUID()
      const expiresAt = new Date(Date.now() + config.accessTtlSeconds * 1000)
      await pool.execute(
        `INSERT INTO auth_sessions (id, user_id, expires_at, created_at)
         VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
        [sessionId, user.id, expiresAt],
      )
      const token = issueAccessToken({ userId: user.id, sessionId, role: user.role }, config)
      res.cookie(config.cookie.name, token, authCookieOptions(config, config.accessTtlSeconds * 1000))
      return res.json({ user: { id: String(user.id), email: user.email, role: user.role } })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/auth/me', createAuthenticate({ pool, config }), (req, res) => {
    res.json({ user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role } })
  })

  router.post('/auth/logout', async (req, res, next) => {
    const token = req.cookies?.[config.cookie.name]
    if (token) {
      try {
        const claims = verifyAccessToken(token, config)
        await pool.execute(
          `UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3)
           WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
          [claims.sid, claims.sub],
        )
      } catch (error) {
        if (!(error instanceof jwt.TokenExpiredError) && !(error instanceof jwt.JsonWebTokenError) && error.message !== 'Invalid access token claims') {
          return next(error)
        }
      }
    }
    clearAuthCookie(res, config)
    return res.status(204).end()
  })

  return router
}

export function createAdminRouter({ pool, config }) {
  const router = Router()
  router.use(createAuthenticate({ pool, config }), requireRole('admin'))
  router.get('/', (req, res) => {
    res.json({ user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role } })
  })
  return router
}
