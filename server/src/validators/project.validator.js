export const PROJECT_STATUSES = Object.freeze(['draft', 'published'])
export const FEATURED_PROJECT_LIMIT = 3

export function isProjectStatus(value) {
  return PROJECT_STATUSES.includes(value)
}

export function validateProjectLocale(req, res, next) {
  const locale = req.query.locale === undefined ? 'pl' : req.query.locale
  if (locale !== 'pl' && locale !== 'en') return res.status(400).json({ error: 'invalid_locale' })
  const scope = req.query.scope === undefined ? 'featured' : req.query.scope
  if (scope !== 'featured' && scope !== 'all') return res.status(400).json({ error: 'invalid_scope' })
  req.projectLocale = locale
  req.projectScope = scope
  return next()
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

function isImageUrl(value) {
  return isHttpUrl(value) || (typeof value === 'string' && /^\/api\/uploads\/[a-f0-9]{40}\.webp$/.test(value))
}

function optionalText(value, maxLength) {
  return value === null || value === undefined || value === '' || (typeof value === 'string' && value.length <= maxLength)
}

export function validateProjectId(req, res, next) {
  if (!/^[1-9]\d{0,19}$/.test(req.params.id)) return res.status(400).json({ error: 'invalid_project_id' })
  return next()
}

function validateProjectPayload(req, res, next, { requireSortOrder = true } = {}) {
  const body = req.body
  const fields = {}
  const add = (field, message) => { fields[field] = message }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(422).json({ error: 'validation_failed', fields: { project: 'invalid' } })
  }
  if (typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length > 160) add('slug', 'invalid')
  if (!isHttpUrl(body.projectUrl)) add('projectUrl', 'invalid')
  if (body.mainImageUrl !== null && body.mainImageUrl !== '' && !isImageUrl(body.mainImageUrl)) add('mainImageUrl', 'invalid')
  if (!optionalText(body.mainImageAltPl, 512)) add('mainImageAltPl', 'invalid')
  if (!optionalText(body.mainImageAltEn, 512)) add('mainImageAltEn', 'invalid')
  if (!isProjectStatus(body.status)) add('status', 'invalid')
  if ((requireSortOrder || body.sortOrder !== undefined) &&
      (!Number.isSafeInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 1000000)) add('sortOrder', 'invalid')

  if (!body.translations || typeof body.translations !== 'object' || Array.isArray(body.translations)) {
    add('translations', 'required')
  } else {
    for (const locale of ['pl', 'en']) {
      const translation = body.translations[locale]
      if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
        add(`translations.${locale}`, 'required')
        continue
      }
      for (const field of ['title', 'category', 'description']) {
        const maxLength = field === 'description' ? 20000 : 255
        if (typeof translation[field] !== 'string' || !translation[field].trim() || translation[field].length > maxLength) {
          add(`translations.${locale}.${field}`, 'required_or_too_long')
        }
      }
      if (!optionalText(translation.seoTitle, 255)) add(`translations.${locale}.seoTitle`, 'too_long')
      if (!optionalText(translation.seoDescription, 20000)) add(`translations.${locale}.seoDescription`, 'too_long')
      if (!Array.isArray(translation.technologies) || translation.technologies.length > 30 ||
          translation.technologies.some((value) => typeof value !== 'string' || !value.trim() || value.length > 100)) {
        add(`translations.${locale}.technologies`, 'invalid')
      }
    }
  }

  if (!Array.isArray(body.gallery) || body.gallery.length > 50) {
    add('gallery', 'invalid')
  } else {
    body.gallery.forEach((image, index) => {
      if (!image || typeof image !== 'object' || !isImageUrl(image.src)) add(`gallery.${index}.src`, 'invalid')
      if (typeof image?.altPl !== 'string' || image.altPl.length > 512) add(`gallery.${index}.altPl`, 'invalid')
      if (typeof image?.altEn !== 'string' || image.altEn.length > 512) add(`gallery.${index}.altEn`, 'invalid')
    })
  }

  if (Object.keys(fields).length) return res.status(422).json({ error: 'validation_failed', fields })
  req.validatedProject = body
  return next()
}

export function validateProjectUpdate(req, res, next) {
  return validateProjectPayload(req, res, next)
}

export function validateProjectCreate(req, res, next) {
  return validateProjectPayload(req, res, next, { requireSortOrder: false })
}

export function validateFeaturedSelection(req, res, next) {
  const projectIds = req.body?.projectIds
  if (!Array.isArray(projectIds) || projectIds.length > FEATURED_PROJECT_LIMIT ||
      projectIds.some((id) => !(typeof id === 'string' && /^[1-9]\d{0,19}$/.test(id))) ||
      new Set(projectIds).size !== projectIds.length) {
    return res.status(422).json({ error: 'validation_failed', fields: { projectIds: 'invalid' } })
  }
  req.validatedProjectIds = projectIds
  return next()
}
