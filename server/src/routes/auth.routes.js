import { Router } from 'express'
import { validateLogin } from '../validators/auth.validator.js'

export function createAuthRouter({ controller, loginRateLimiter, authenticate }) {
  const router = Router()
  router.post('/login', loginRateLimiter, validateLogin, controller.login)
  router.get('/me', authenticate, controller.me)
  router.post('/logout', controller.logout)
  return router
}
