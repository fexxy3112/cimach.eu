import { verifyAccessToken } from './tokens.js'

export function createAuthenticate({ pool, config }) {
  return async function authenticate(req, res, next) {
    const token = req.cookies?.[config.cookie.name]
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    let claims
    try {
      claims = verifyAccessToken(token, config)
    } catch {
      clearAuthCookie(res, config)
      return res.status(401).json({ error: 'unauthorized' })
    }

    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.email, u.role
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL
           AND s.expires_at > UTC_TIMESTAMP(3) AND u.is_active = 1
         LIMIT 1`,
        [claims.sid, claims.sub],
      )
      const user = rows[0]
      if (!user) {
        clearAuthCookie(res, config)
        return res.status(401).json({ error: 'unauthorized' })
      }
      req.auth = { userId: String(user.id), email: user.email, role: user.role, sessionId: claims.sid }
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

export function authCookieOptions(config, maxAge) {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  }
}

export function clearAuthCookie(res, config) {
  res.clearCookie(config.cookie.name, authCookieOptions(config))
}
