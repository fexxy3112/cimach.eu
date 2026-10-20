import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.js'

const origin = 'http://localhost:5173'
const secret = Buffer.from('test-only-secret-material-long-enough-for-hs256')
const config = {
  frontendOrigin: origin,
  jwtSecret: secret,
  jwtIssuer: 'https://cimach.eu',
  jwtAudience: 'cimach-admin-api',
  accessTtlSeconds: 600,
  trustProxyCidrs: [],
  cookie: { name: 'cimach_admin', path: '/api', sameSite: 'strict', secure: false },
}

let passwordHash
let dummyPasswordHash

before(async () => {
  passwordHash = await bcrypt.hash('correct horse battery staple', 4)
  dummyPasswordHash = await bcrypt.hash('not an account password', 4)
})

function fakePool(role = 'admin') {
  const user = { id: 1, email: 'admin@cimach.test', password_hash: passwordHash, role, is_active: 1 }
  const sessions = new Map()
  return {
    sessions,
    async execute(sql, values) {
      if (sql.includes('FROM users WHERE email')) return [[values[0] === user.email ? user : undefined].filter(Boolean), []]
      if (sql.includes('INSERT INTO auth_sessions')) {
        sessions.set(values[0], { userId: String(values[1]), expiresAt: values[2], revokedAt: null })
        return [{ affectedRows: 1 }, []]
      }
      if (sql.includes('FROM auth_sessions s')) {
        const session = sessions.get(values[0])
        if (!session || session.userId !== String(values[1]) || session.revokedAt || session.expiresAt <= new Date()) return [[], []]
        return [[{ id: user.id, email: user.email, role: user.role }], []]
      }
      if (sql.includes('UPDATE auth_sessions')) {
        const session = sessions.get(values[0])
        if (session && session.userId === String(values[1])) session.revokedAt = new Date()
        return [{ affectedRows: session ? 1 : 0 }, []]
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    },
  }
}

async function startTestApi(t) {
  const db = fakePool()
  const app = await createApp({ pool: db, config, dummyPasswordHash })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  return { db, base: `http://127.0.0.1:${server.address().port}` }
}

async function send(base, path, { method = 'GET', body, cookie, csrf = true, requestOrigin = origin } = {}) {
  const headers = { Origin: requestOrigin }
  if (cookie) headers.Cookie = cookie
  if (csrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers['X-CIMACH-CSRF'] = '1'
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}

async function login(base, email = 'admin@cimach.test', password = 'correct horse battery staple') {
  const response = await send(base, '/api/auth/login', { method: 'POST', body: { email, password } })
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

test('valid login returns an HttpOnly SameSite cookie and session survives a new request', async (t) => {
  const { base } = await startTestApi(t)
  assert.equal((await send(base, '/api/admin')).status, 401)
  const { response, cookie } = await login(base)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/i)
  assert.ok(cookie)
  const me = await send(base, '/api/auth/me', { cookie })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).user.email, 'admin@cimach.test')
  assert.equal((await send(base, '/api/admin', { cookie })).status, 200)
})

test('production cookie configuration adds the Secure attribute', async (t) => {
  const db = fakePool()
  const productionConfig = { ...config, cookie: { ...config.cookie, secure: true } }
  const app = await createApp({ pool: db, config: productionConfig, dummyPasswordHash })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  const { response } = await login(`http://127.0.0.1:${server.address().port}`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /Secure/i)
})

test('unknown user and wrong password use the same response', async (t) => {
  const { base } = await startTestApi(t)
  const wrongPassword = await login(base, 'admin@cimach.test', 'wrong password')
  const unknownUser = await login(base, 'nobody@cimach.test', 'wrong password')
  assert.equal(wrongPassword.response.status, 401)
  assert.equal(unknownUser.response.status, 401)
  assert.deepEqual(await wrongPassword.response.json(), await unknownUser.response.json())
})

test('login rate limit returns HTTP 429 after five failed attempts', async (t) => {
  const { base } = await startTestApi(t)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await login(base, 'nobody@cimach.test', 'wrong password')).response.status, 401)
  }
  assert.equal((await login(base, 'nobody@cimach.test', 'wrong password')).response.status, 429)
})

test('missing, invalid-signature and expired tokens are rejected', async (t) => {
  const { base } = await startTestApi(t)
  assert.equal((await send(base, '/api/auth/me')).status, 401)

  const claims = { sid: randomUUID(), role: 'admin' }
  const wrongSignature = jwt.sign(claims, Buffer.from('a completely different test key material'), {
    algorithm: 'HS256', subject: '1', issuer: config.jwtIssuer, audience: config.jwtAudience, expiresIn: 60,
  })
  const expired = jwt.sign(claims, secret, {
    algorithm: 'HS256', subject: '1', issuer: config.jwtIssuer, audience: config.jwtAudience, expiresIn: -1,
  })
  const unsignedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const unsignedPayload = Buffer.from(JSON.stringify({
    ...claims, sub: '1', iss: config.jwtIssuer, aud: config.jwtAudience,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, jti: randomUUID(),
  })).toString('base64url')
  const unsigned = `${unsignedHeader}.${unsignedPayload}.`
  assert.equal((await send(base, '/api/auth/me', { cookie: `cimach_admin=${wrongSignature}` })).status, 401)
  assert.equal((await send(base, '/api/auth/me', { cookie: `cimach_admin=${expired}` })).status, 401)
  assert.equal((await send(base, '/api/auth/me', { cookie: `cimach_admin=${unsigned}` })).status, 401)
})

test('an authenticated user without the required role gets HTTP 403', async (t) => {
  const db = fakePool('editor')
  const app = await createApp({ pool: db, config, dummyPasswordHash })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  const base = `http://127.0.0.1:${server.address().port}`
  const sessionId = randomUUID()
  db.sessions.set(sessionId, { userId: '1', expiresAt: new Date(Date.now() + 60000), revokedAt: null })
  const editorToken = jwt.sign({ sid: sessionId, role: 'editor' }, secret, {
    algorithm: 'HS256', subject: '1', issuer: config.jwtIssuer, audience: config.jwtAudience, expiresIn: 60, jwtid: randomUUID(),
  })
  const response = await send(base, '/api/admin', { cookie: `cimach_admin=${editorToken}` })
  assert.equal(response.status, 403)
})

test('logout revokes a token and later protected requests reject it', async (t) => {
  const { base } = await startTestApi(t)
  const { cookie } = await login(base)
  assert.equal((await send(base, '/api/auth/logout', { method: 'POST', cookie })).status, 204)
  assert.equal((await send(base, '/api/auth/me', { cookie })).status, 401)
})

test('cookie-authenticated mutations require exact origin and CSRF header', async (t) => {
  const { base } = await startTestApi(t)
  const response = await send(base, '/api/auth/logout', { method: 'POST', csrf: false })
  assert.equal(response.status, 403)
  const wrongOrigin = await send(base, '/api/auth/logout', { method: 'POST', requestOrigin: 'https://attacker.example' })
  assert.equal(wrongOrigin.status, 403)
})
