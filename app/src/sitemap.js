const origin = 'https://cimach.eu'

const xmlEscape = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll("'", '&apos;')

function renderUrl(seo) {
  const alternates = [
    ['pl', seo.alternatePl],
    ['en', seo.alternateEn],
    ['x-default', seo.xDefault],
  ]
    .filter(([, href]) => href)
    .map(([locale, href]) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${xmlEscape(href)}" />`)

  return [
    '  <url>',
    `    <loc>${xmlEscape(seo.canonical)}</loc>`,
    ...alternates,
    '  </url>',
  ].join('\n')
}

export function generateSitemap(catalogs, getSeo) {
  const entries = []

  for (const locale of ['pl', 'en']) {
    entries.push(renderUrl(getSeo(locale, 'home')))
    entries.push(renderUrl(getSeo(locale, 'projects')))
  }

  for (const locale of ['pl', 'en']) {
    for (const project of catalogs[locale].projects) {
      const slug = project.caseStudySlug
      if (!slug) continue
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(`Invalid published project slug for sitemap: ${slug}`)
      }

      const availableLocales = ['pl', 'en'].filter((candidateLocale) =>
        catalogs[candidateLocale].projects.some((candidate) => candidate.caseStudySlug === slug),
      )
      const seo = getSeo(locale, 'project', project, slug, availableLocales)
      entries.push(renderUrl(seo))
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}
