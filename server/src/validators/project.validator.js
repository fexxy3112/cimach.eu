export const PROJECT_STATUSES = Object.freeze(['draft', 'published'])

export function isProjectStatus(value) {
  return PROJECT_STATUSES.includes(value)
}

export function validateProjectLocale(req, res, next) {
  const locale = req.query.locale === undefined ? 'pl' : req.query.locale
  if (locale !== 'pl' && locale !== 'en') return res.status(400).json({ error: 'invalid_locale' })
  req.projectLocale = locale
  return next()
}
