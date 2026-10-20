import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'

export function issueAccessToken({ userId, sessionId, role }, config) {
  return jwt.sign(
    { role, sid: sessionId },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      subject: String(userId),
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: config.accessTtlSeconds,
      jwtid: randomUUID(),
    },
  )
}

export function verifyAccessToken(token, config) {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    clockTolerance: 0,
  })

  if (
    typeof payload !== 'object' ||
    typeof payload.sub !== 'string' ||
    !/^\d+$/.test(payload.sub) ||
    typeof payload.sid !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(payload.sid) ||
    typeof payload.role !== 'string' ||
    payload.role.length === 0 ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.jti !== 'string'
  ) {
    throw new Error('Invalid access token claims')
  }
  const now = Math.floor(Date.now() / 1000)
  if (
    payload.iat > now + 5 ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > config.accessTtlSeconds + 5 ||
    !/^[0-9a-f-]{36}$/i.test(payload.jti)
  ) {
    throw new Error('Invalid access token time claims')
  }

  return payload
}
