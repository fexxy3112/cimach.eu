import { clearAuthCookie, authCookieOptions } from '../utils/auth-cookie.js'

export function createAuthController({ authService, config }) {
  return {
    async login(req, res, next) {
      try {
        if (!req.validatedCredentials) {
          return res.status(401).json({ error: 'invalid_credentials' })
        }
        const result = await authService.login(req.validatedCredentials)
        if (!result) return res.status(401).json({ error: 'invalid_credentials' })
        res.cookie(config.cookie.name, result.token, authCookieOptions(config, config.accessTtlSeconds * 1000))
        return res.json({ user: result.user })
      } catch (error) {
        return next(error)
      }
    },

    me(req, res) {
      return res.json({ user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role } })
    },

    async logout(req, res, next) {
      try {
        await authService.logout(req.cookies?.[config.cookie.name])
        clearAuthCookie(res, config)
        return res.status(204).end()
      } catch (error) {
        return next(error)
      }
    },
  }
}
