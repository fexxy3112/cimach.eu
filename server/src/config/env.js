import 'dotenv/config'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function parseOrigin(value, name) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute origin URL`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) {
    throw new Error(`${name} must contain only an HTTP(S) origin without credentials or a path`)
  }
  return url.origin
}

const nodeEnv = required('NODE_ENV')
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production')
}
const frontendOrigin = parseOrigin(required('FRONTEND_ORIGIN'), 'FRONTEND_ORIGIN')
if (nodeEnv === 'production' && !frontendOrigin.startsWith('https://')) {
  throw new Error('FRONTEND_ORIGIN must use HTTPS in production')
}

const jwtSecretBase64 = required('JWT_SECRET_BASE64')
const jwtSecret = Buffer.from(jwtSecretBase64, 'base64')
if (jwtSecret.length < 32 || jwtSecret.toString('base64').replace(/=+$/, '') !== jwtSecretBase64.replace(/=+$/, '')) {
  throw new Error('JWT_SECRET_BASE64 must be canonical base64 containing at least 32 random bytes')
}

const sameSite = (process.env.AUTH_COOKIE_SAME_SITE || 'strict').toLowerCase()
if (!['strict', 'lax', 'none'].includes(sameSite)) throw new Error('AUTH_COOKIE_SAME_SITE must be strict, lax, or none')
const cookieSecure = nodeEnv === 'production'
if (sameSite === 'none' && !cookieSecure) throw new Error('AUTH_COOKIE_SAME_SITE=none requires production HTTPS')

const port = Number(process.env.PORT || 3001)
const dbPort = Number(process.env.DB_PORT || 3306)
const accessTtlSeconds = Number(process.env.JWT_ACCESS_TTL_SECONDS || 600)
const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 5)
const cookieName = process.env.AUTH_COOKIE_NAME || 'cimach_admin'
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid')
if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) throw new Error('DB_PORT is invalid')
if (!Number.isInteger(accessTtlSeconds) || accessTtlSeconds < 60 || accessTtlSeconds > 900) {
  throw new Error('JWT_ACCESS_TTL_SECONDS must be between 60 and 900')
}
if (!Number.isInteger(connectionLimit) || connectionLimit < 1 || connectionLimit > 50) throw new Error('DB_CONNECTION_LIMIT is invalid')
if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName)) throw new Error('AUTH_COOKIE_NAME is invalid')
if (cookieDomain && !/^\.?[a-z0-9.-]+$/i.test(cookieDomain)) throw new Error('AUTH_COOKIE_DOMAIN is invalid')

const trustProxyCidrs = (process.env.TRUST_PROXY_CIDRS || '').split(',').map((value) => value.trim()).filter(Boolean)
if (nodeEnv === 'production' && trustProxyCidrs.length === 0) {
  throw new Error('Set TRUST_PROXY_CIDRS to the exact trusted reverse-proxy address or subnet in production')
}

export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port,
  frontendOrigin,
  jwtSecret,
  jwtIssuer: process.env.JWT_ISSUER || 'https://cimach.eu',
  jwtAudience: process.env.JWT_AUDIENCE || 'cimach-admin-api',
  accessTtlSeconds,
  db: {
    host: required('DB_HOST'),
    port: dbPort,
    database: required('DB_DATABASE'),
    user: required('DB_USERNAME'),
    password: required('DB_PASSWORD'),
    connectionLimit,
  },
  trustProxyCidrs,
  cookie: {
    name: cookieName,
    sameSite,
    secure: cookieSecure,
    domain: cookieDomain,
    path: '/api',
  },
})
