import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import React from 'react'
import { renderToString } from 'react-dom/server'

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

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
        const template = await readFile('dist/index.html', 'utf8')

        for (const locale of ['pl', 'en']) {
          for (const pageName of ['home', 'studioBodyArt', 'login', 'admin']) {
            const page = getSeo(locale, pageName)
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
              : {
                  '@context': 'https://schema.org',
                  '@type': 'CreativeWork',
                  name: 'Studio BodyArt',
                  url: page.canonical,
                  creator: { '@type': 'Person', name: 'Mateusz Cimachowski' },
                }
            const markup = renderToString(React.createElement(App, { initialLocale: locale, initialPage: pageName }))
            const title = escapeHtml(page.title)
            const description = escapeHtml(page.description)
            const canonical = escapeHtml(page.canonical)
            const html = template
              .replace('<html lang="pl"', `<html lang="${locale}"`)
              .replace('<meta name="robots" content="index, follow, max-image-preview:large" />', `<meta name="robots" content="${isPrivatePage ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}" />`)
              .replaceAll('content="__SEO_DESCRIPTION__"', `content="${description}"`)
              .replace('href="__SEO_CANONICAL__"', `href="${canonical}"`)
              .replaceAll('content="__SEO_CANONICAL__"', `content="${canonical}"`)
              .replace('href="__SEO_PL_ALTERNATE__"', `href="${page.alternatePl}"`)
              .replace('href="__SEO_EN_ALTERNATE__"', `href="${page.alternateEn}"`)
              .replace('content="__OG_LOCALE__"', `content="${page.ogLocale}"`)
              .replaceAll('content="__SEO_TITLE__"', `content="${title}"`)
              .replace('<title>__SEO_TITLE__</title>', `<title>${title}</title>`)
              .replace('<div id="root"></div>', `<div id="root">${markup}</div>`)
              .replace('</head>', `${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>\n  ` : ''}</head>`)

            await mkdir(`dist${page.path}`, { recursive: true })
            await writeFile(`dist${page.path}index.html`, html)
            if (locale === 'pl' && isHome) await writeFile('dist/index.html', html)
          }
        }
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
