import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import React from 'react'
import { renderToString } from 'react-dom/server'

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const serializeJsonForHtml = (value) => JSON.stringify(value)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029')

function prerenderPages() {
  return {
    name: 'prerender-language-pages',
    apply: 'build',
    async closeBundle() {
      const server = await (await import('vite')).createServer({
        configFile: false,
        root: process.cwd(),
        plugins: [react()],
        server: { middlewareMode: true },
        appType: 'custom',
      })

      try {
        const { default: App } = await server.ssrLoadModule('/src/app/App.tsx')
        const { getSeo } = await server.ssrLoadModule('/src/seo.ts')
        const { generateSitemap } = await server.ssrLoadModule('/src/sitemap.js')
        const { loadPublicProjectCatalog, loadAllPublicProjectCatalog, loadPublicProjectPage } = await server.ssrLoadModule('/src/data/projectApi.ts')
        const apiBase = process.env.CIMACH_API_BASE_URL || 'http://127.0.0.1:3001/api'
        const template = await readFile('dist/index.html', 'utf8')
        const catalogs = {
          pl: await loadPublicProjectCatalog('pl', apiBase),
          en: await loadPublicProjectCatalog('en', apiBase),
        }
        const allCatalogs = {
          pl: await loadAllPublicProjectCatalog('pl', apiBase),
          en: await loadAllPublicProjectCatalog('en', apiBase),
        }

        for (const locale of ['pl', 'en']) {
          const pages = [{ name: 'home' }, { name: 'projects' }]
          for (const project of allCatalogs[locale].projects) {
            const slug = project.caseStudySlug
            if (!slug) continue
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
              throw new Error(`Invalid published project slug for prerendering: ${slug}`)
            }
            const availableLocales = ['pl', 'en'].filter((candidateLocale) =>
              allCatalogs[candidateLocale].projects.some((candidate) => candidate.caseStudySlug === slug),
            )
            const projectPage = await loadPublicProjectPage(locale, slug, apiBase, fetch, undefined, availableLocales)
            if (!projectPage) throw new Error(`Published project detail is missing from the ${locale} API response for slug: ${slug}`)
            pages.push({ name: 'project', slug, project: projectPage.project, projectPage })
          }
          pages.push({ name: 'login' }, { name: 'admin' })

          for (const route of pages) {
            const pageName = route.name
            const project = route.project
            const pageData = pageName === 'home' ? catalogs[locale] : pageName === 'projects' ? allCatalogs[locale] : route.projectPage
            const projectLocales = route.projectPage?.availableLocales
            const page = getSeo(locale, pageName, project, route.slug, projectLocales)
            const isHome = pageName === 'home'
            const isPrivatePage = pageName === 'login' || pageName === 'admin'
            const structuredData = isPrivatePage ? null : isHome
              ? {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'Mateusz Cimachowski',
                  url: page.canonical,
                  image: 'https://cimach.eu/og-cimach.png',
                  jobTitle: 'Web developer',
                  sameAs: ['https://github.com/fexxy3112', 'https://www.instagram.com/_cimach_/'],
                }
              : pageName === 'projects' ? {
                  '@context': 'https://schema.org',
                  '@type': 'CollectionPage',
                  name: page.title,
                  url: page.canonical,
                  description: page.description,
                } : {
                  '@context': 'https://schema.org',
                  '@type': 'CreativeWork',
                  name: project.name,
                  url: page.canonical,
                  description: page.description,
                  creator: { '@type': 'Person', name: 'Mateusz Cimachowski' },
                }
            const markup = renderToString(React.createElement(App, {
              initialLocale: locale,
              initialPage: pageName,
              initialProjectSlug: route.slug,
              initialData: pageData,
            }))
            const title = escapeHtml(page.title)
            const description = escapeHtml(page.description)
            const canonical = escapeHtml(page.canonical)
            const html = template
              .replace('<html lang="pl"', `<html lang="${locale}"`)
              .replace('<meta name="robots" content="index, follow, max-image-preview:large" />', `<meta name="robots" content="${isPrivatePage ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}" />`)
              .replaceAll('content="__SEO_DESCRIPTION__"', `content="${description}"`)
              .replace('href="__SEO_CANONICAL__"', `href="${canonical}"`)
              .replaceAll('content="__SEO_CANONICAL__"', `content="${canonical}"`)
              .replace('<link rel="alternate" hreflang="pl" href="__SEO_PL_ALTERNATE__" />', page.alternatePl
                ? `<link rel="alternate" hreflang="pl" href="${page.alternatePl}" />`
                : '')
              .replace('<link rel="alternate" hreflang="en" href="__SEO_EN_ALTERNATE__" />', page.alternateEn
                ? `<link rel="alternate" hreflang="en" href="${page.alternateEn}" />`
                : '')
              .replace('<link rel="alternate" hreflang="x-default" href="__SEO_PL_ALTERNATE__" />', page.xDefault
                ? `<link rel="alternate" hreflang="x-default" href="${page.xDefault}" />`
                : '')
              .replace('content="__OG_LOCALE__"', `content="${page.ogLocale}"`)
              .replaceAll('content="__SEO_TITLE__"', `content="${title}"`)
              .replace('<title>__SEO_TITLE__</title>', `<title>${title}</title>`)
              .replace('<div id="root"></div>', `<div id="root">${markup}</div>${pageData
                ? `<script id="cimach-prerender-data" type="application/json">${serializeJsonForHtml(pageData)}</script>`
                : ''}`)
              .replace('</head>', `${structuredData ? `<script type="application/ld+json">${serializeJsonForHtml(structuredData)}</script>\n  ` : ''}</head>`)

            await mkdir(`dist${page.path}`, { recursive: true })
            await writeFile(`dist${page.path}index.html`, html)
            if (locale === 'pl' && isHome) await writeFile('dist/index.html', html)
          }
        }

        await writeFile('dist/sitemap.xml', generateSitemap(allCatalogs, getSeo))
      } finally {
        await server.close()
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), prerenderPages()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
})
