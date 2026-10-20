import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createSessionModel } from '../database/models/session.model.js'
import { createUserModel } from '../database/models/user.model.js'
import { issueAccessToken, verifyAccessToken } from '../utils/access-token.js'

export function createAuthService({ pool, config, dummyPasswordHash }) {
  const users = createUserModel(pool)
  const sessions = createSessionModel(pool)

  return {
    async login({ email, password }) {
      const user = email ? await users.findByEmail(email) : null
      const passwordMatches = await bcrypt.compare(password || 'invalid-input', user?.password_hash || dummyPasswordHash)
      if (!user || !passwordMatches || !user.is_active || user.role !== 'admin') return null

      const sessionId = randomUUID()
      const expiresAt = new Date(Date.now() + config.accessTtlSeconds * 1000)
      await sessions.create({ id: sessionId, userId: user.id, expiresAt })
      const token = issueAccessToken({ userId: user.id, sessionId, role: user.role }, config)
      return { token, user: { id: String(user.id), email: user.email, role: user.role } }
    },

    async authenticate(token) {
      let claims
      try {
        claims = verifyAccessToken(token, config)
      } catch {
        return null
      }
      const user = await sessions.findActive({ id: claims.sid, userId: claims.sub })
      if (!user) return null
      return { userId: String(user.id), email: user.email, role: user.role, sessionId: claims.sid }
    },

    async logout(token) {
      let claims
      try {
        claims = verifyAccessToken(token, config)
      } catch {
        return
      }
      await sessions.revoke({ id: claims.sid, userId: claims.sub })
    },
  }
}
