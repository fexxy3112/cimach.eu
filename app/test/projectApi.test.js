import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

let loadPublicProjectCatalog
let loadAllPublicProjectCatalog
let loadPublicProjectPage
let loadAdminProjectPreview

before(async () => {
  const source = await readFile(resolve(process.cwd(), 'src/data/projectApi.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  ;({ loadPublicProjectCatalog, loadAllPublicProjectCatalog, loadPublicProjectPage, loadAdminProjectPreview } = await import(moduleUrl))
})

const project = {
  number: '17', name: 'New project', category: 'Web application', description: 'Project description.',
  technologies: ['REACT'], href: 'https://example.com', caseStudySlug: 'new-project-17',
  mainImage: null, seoTitle: 'Project | CIMACH', seoDescription: 'SEO description.',
  gallery: [{ src: 'https://images.example/1.jpg', alt: 'Project image' }],
}

test('loads the published project catalog by locale', async () => {
  const requests = []
  const fetcher = async (url) => {
    requests.push(url)
    return new Response(JSON.stringify({ projects: [project] }), { status: 200 })
  }
  const catalog = await loadPublicProjectCatalog('pl', 'http://api.example/api/', fetcher)
  assert.deepEqual(requests, ['http://api.example/api/projects?locale=pl'])
  assert.equal(catalog.kind, 'catalog')
  assert.equal(catalog.scope, 'featured')
  assert.equal(catalog.projects[0].caseStudySlug, 'new-project-17')
})

test('admin preview uses credentials and disables caching while preserving actual available languages', async () => {
  const data = { kind: 'project', preview: true, locale: 'pl', slug: project.caseStudySlug, availableLocales: ['pl'], project: { ...project, status: 'draft' } }
  const result = await loadAdminProjectPreview('pl', project.caseStudySlug, '/api', async (url, options) => {
    assert.equal(url, '/api/admin/projects/by-slug/new-project-17/preview?locale=pl')
    assert.equal(options.credentials, 'include')
    assert.equal(options.cache, 'no-store')
    return new Response(JSON.stringify(data))
  })
  assert.deepEqual(result, data)
})

test('admin preview rejects unauthorized users, missing translations and mismatched records', async () => {
  for (const status of [401, 403]) {
    await assert.rejects(loadAdminProjectPreview('pl', 'draft', '/api', async () => new Response('{}', { status })), /preview_unauthorized/)
  }
  assert.equal(await loadAdminProjectPreview('en', 'draft', '/api', async () => new Response('{}', { status: 404 })), null)
  const wrong = { kind: 'project', preview: true, locale: 'pl', slug: 'different', project }
  assert.equal(await loadAdminProjectPreview('pl', 'draft', '/api', async () => new Response(JSON.stringify(wrong))), null)
})

test('loads all published projects separately from featured homepage catalog', async () => {
  const requests = []
  const fetcher = async (url) => {
    requests.push(url)
    return new Response(JSON.stringify({ projects: [project] }), { status: 200 })
  }
  const catalog = await loadAllPublicProjectCatalog('en', '/api', fetcher)
  assert.deepEqual(requests, ['/api/projects?locale=en&scope=all'])
  assert.equal(catalog.scope, 'all')
  assert.equal(catalog.projects[0].caseStudySlug, 'new-project-17')
})

test('loads arbitrary slugs from the detail API and checks translated availability', async () => {
  const requests = []
  const fetcher = async (url) => {
    requests.push(url)
    if (url.endsWith('/projects/new-project-17?locale=pl')) {
      return new Response(JSON.stringify({ project }), { status: 200 })
    }
    return new Response(JSON.stringify({ projects: [{ ...project, name: 'New project EN' }] }), { status: 200 })
  }
  const result = await loadPublicProjectPage('pl', 'new-project-17', '/api', fetcher)
  assert.deepEqual(requests, ['/api/projects/new-project-17?locale=pl', '/api/projects?locale=en&scope=all'])
  assert.equal(result.project.name, 'New project')
  assert.deepEqual(result.availableLocales, ['pl', 'en'])
})

test('returns not found for unknown or unpublished slugs without rendering another record', async () => {
  const fetcher = async () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
  assert.equal(await loadPublicProjectPage('en', 'draft-project', '/api', fetcher), null)
})

test('rejects a detail response whose slug differs from the requested slug', async () => {
  const fetcher = async () => new Response(JSON.stringify({ project }), { status: 200 })
  assert.equal(await loadPublicProjectPage('pl', 'different-slug', '/api', fetcher), null)
})

test('fails catalog loading when the API is unavailable', async () => {
  const fetcher = async () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 })
  await assert.rejects(loadPublicProjectCatalog('en', '/api', fetcher), /Project API request failed \(503\)/)
})
