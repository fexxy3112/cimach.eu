export function notFound(_req, res) {
  return res.status(404).json({ error: 'not_found' })
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error)
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'request_too_large' })
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_request' })
  if (error?.code === 'INVALID_UPLOAD') return res.status(422).json({ error: 'invalid_upload' })
  if (error?.code === 'UPLOAD_BUSY') return res.status(503).json({ error: 'upload_busy' })
  return res.status(500).json({ error: 'internal_error' })
}
