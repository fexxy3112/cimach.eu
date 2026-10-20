import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

let generateSitemap
let getSeo

before(async () => {
  const [sitemapSource, seoSource] = await Promise.all([
    readFile(resolve(process.cwd(), 'src/sitemap.js'), 'utf8'),
    readFile(resolve(process.cwd(), 'src/seo.ts'), 'utf8'),
  ])
  const transpile = (source) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const importSource = (source) => import(`data:text/javascript;base64,${Buffer.from(transpile(source)).toString('base64')}`)
  ;({ generateSitemap } = await importSource(sitemapSource))
  ;({ getSeo } = await importSource(seoSource))
})

test('generates canonical and hreflang entries from published locale catalogs', () => {
  const catalogs = {
    pl: { projects: [
      { name: 'Cimach', caseStudySlug: 'cimach-eu' },
      { name: 'Studio BodyArt', caseStudySlug: 'studio-bodyart' },
      { name: 'Polish only', caseStudySlug: 'polski-projekt' },
    ] },
    en: { projects: [
      { name: 'Cimach', caseStudySlug: 'cimach-eu' },
      { name: 'Studio BodyArt', caseStudySlug: 'studio-bodyart' },
      { name: 'English only', caseStudySlug: 'english-project' },
    ] },
  }

  const sitemap = generateSitemap(catalogs, getSeo)
  assert.match(sitemap, /<loc>https:\/\/cimach\.eu\/pl\/<\/loc>/)
  assert.match(sitemap, /<loc>https:\/\/cimach\.eu\/en\/<\/loc>/)
  for (const path of [
    '/pl/projects/cimach-eu/', '/en/projects/cimach-eu/',
    '/pl/projects/studio-bodyart/', '/en/projects/studio-bodyart/',
    '/pl/projects/polski-projekt/', '/en/projects/english-project/',
  ]) assert.ok(sitemap.includes(`<loc>https://cimach.eu${path}</loc>`), `Missing ${path}`)

  const polishOnly = [...sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)]
    .map(([entry]) => entry)
    .find((entry) => entry.includes('/pl/projects/polski-projekt/'))
  assert.ok(polishOnly)
  assert.ok(!polishOnly.includes('hreflang="en"'))
  assert.ok(polishOnly.includes('hreflang="x-default" href="https://cimach.eu/pl/projects/polski-projekt/"'))
  const englishOnly = [...sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)]
    .map(([entry]) => entry)
    .find((entry) => entry.includes('/en/projects/english-project/'))
  assert.ok(englishOnly)
  assert.ok(!englishOnly.includes('hreflang="pl"'))
  assert.ok(!englishOnly.includes('x-default'))
})

test('rejects invalid slugs rather than writing malformed sitemap URLs', () => {
  const catalogs = {
    pl: { projects: [{ name: 'Invalid', caseStudySlug: '../draft' }] },
    en: { projects: [] },
  }
  assert.throws(() => generateSitemap(catalogs, getSeo), /Invalid published project slug/)
})
