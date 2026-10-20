export function validateLogin(req, res, next) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  req.validatedCredentials = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 &&
    password.length > 0 && Buffer.byteLength(password, 'utf8') <= 72
    ? { email, password }
    : null
  next()
}
