import { rateLimit } from 'express-rate-limit'

export function createLoginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_req, res) => res.status(429).json({ error: 'rate_limited' }),
  })
}
