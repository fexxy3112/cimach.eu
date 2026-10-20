export function requireSameOriginCsrf(frontendOrigin) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    if (req.get('origin') !== frontendOrigin || req.get('x-cimach-csrf') !== '1') {
      return res.status(403).json({ error: 'csrf_rejected' })
    }
    return next()
  }
}
