import { Router } from 'express'
import { createAuthController } from '../controllers/auth.controller.js'
import { createAuthenticate, requireRole } from '../middleware/auth.middleware.js'
import { createLoginRateLimiter } from '../middleware/rate-limit.middleware.js'
import { createAuthRouter } from './auth.routes.js'

export function createApiRouter({ authService, config }) {
  const router = Router()
  const authenticate = createAuthenticate(authService, config)
  const controller = createAuthController({ authService, config })

  router.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }))
  router.use('/auth', createAuthRouter({ controller, loginRateLimiter: createLoginRateLimiter(), authenticate }))
  router.get('/admin', authenticate, requireRole('admin'), (req, res) => {
    res.json({ user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role } })
  })
  return router
}
