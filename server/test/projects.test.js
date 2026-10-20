import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcryptjs'
import { createApp } from '../src/app.js'

const origin = 'http://localhost:5173'
const config = {
  frontendOrigin: origin,
  jwtSecret: Buffer.from('test-only-secret-material-long-enough-for-hs256'),
  jwtIssuer: 'https://cimach.eu',
  jwtAudience: 'cimach-admin-api',
  accessTtlSeconds: 600,
  trustProxyCidrs: [],
  cookie: { name: 'cimach_admin', path: '/api', sameSite: 'strict', secure: false },
}

function fakePool() {
  return {
    async execute(sql, values) {
      if (sql.includes('FROM projects p') && sql.includes('p.slug = ?')) {
        if (values[1] !== 'studio-bodyart') return [[], []]
        return [projectRow(values[0]), []]
      }
      if (sql.includes('FROM projects p') && sql.includes("p.status = 'published'")) {
        return [projectRow(values[0]), []]
      }
      if (sql.includes('FROM project_technologies') && sql.includes('project_id IN')) {
        return [[{ projectId: 7, label: 'PHP' }, { projectId: 7, label: 'SCSS' }, { projectId: 7, label: 'JS' }], []]
      }
      if (sql.includes('FROM project_technologies') && sql.includes('project_id = ?')) {
        return [[{ label: 'PHP' }, { label: 'SCSS' }, { label: 'JS' }], []]
      }
      if (sql.includes('FROM project_images')) {
        return [[{ src: 'https://images.example/photo.jpg', altPl: 'Wnętrze studia', altEn: 'Studio interior' }], []]
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    },
  }
}

function projectRow(locale) {
  return [{
    id: 7,
    number: '02',
    caseStudySlug: 'studio-bodyart',
    href: 'https://michalowice.studio-bodyart.pl',
    mainImage: null,
    name: 'Studio BodyArt',
    category: 'Business website',
    description: locale === 'pl' ? 'Strona usługowa.' : 'A service website.',
    seoTitle: 'Studio BodyArt - project | CIMACH',
    seoDescription: 'Project SEO description.',
  }]
}

async function startApi(t) {
  const app = await createApp({
    pool: fakePool(),
    config,
    dummyPasswordHash: await bcrypt.hash('test-only-dummy-password', 4),
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  return `http://127.0.0.1:${server.address().port}`
}

test('public project list returns the locale mapping without internal database IDs', async (t) => {
  const base = await startApi(t)
  const response = await fetch(`${base}/api/projects?locale=en`)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.projects.length, 1)
  assert.equal(body.projects[0].number, '02')
  assert.equal(body.projects[0].description, 'A service website.')
  assert.deepEqual(body.projects[0].technologies, ['PHP', 'SCSS', 'JS'])
  assert.equal(body.projects[0].caseStudySlug, 'studio-bodyart')
  assert.equal('id' in body.projects[0], false)
})

test('public detail endpoint includes the translated gallery and rejects unknown or invalid routes', async (t) => {
  const base = await startApi(t)
  const response = await fetch(`${base}/api/projects/studio-bodyart?locale=pl`)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.project.description, 'Strona usługowa.')
  assert.deepEqual(body.project.gallery, [{ src: 'https://images.example/photo.jpg', alt: 'Wnętrze studia' }])
  assert.equal('id' in body.project, false)
  assert.equal((await fetch(`${base}/api/projects/missing?locale=pl`)).status, 404)
  assert.equal((await fetch(`${base}/api/projects?locale=de`)).status, 400)
})
