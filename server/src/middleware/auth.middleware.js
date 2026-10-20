export function createAuthenticate(authService, config) {
  return async function authenticate(req, res, next) {
    const token = req.cookies?.[config.cookie.name]
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    try {
      const auth = await authService.authenticate(token)
      if (!auth) {
        res.clearCookie(config.cookie.name, {
          httpOnly: true,
          secure: config.cookie.secure,
          sameSite: config.cookie.sameSite,
          path: config.cookie.path,
          ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
        })
        return res.status(401).json({ error: 'unauthorized' })
      }
      req.auth = auth
      return next()
    } catch (error) {
      return next(error)
    }
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'unauthorized' })
    if (req.auth.role !== role) return res.status(403).json({ error: 'forbidden' })
    return next()
  }
}
