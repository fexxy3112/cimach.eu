import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
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

function fakePool(role = 'admin') {
  const adminProjects = [
    { id: '9', slug: 'cimach-eu', status: 'published', sortOrder: 1, titlePl: 'cimach.eu', titleEn: 'cimach.eu', isFeatured: 0, featuredOrder: null },
    { id: '7', slug: 'studio-bodyart', status: 'published', sortOrder: 2, titlePl: 'Studio BodyArt', titleEn: 'Studio BodyArt', isFeatured: 1, featuredOrder: 1 },
    { id: '8', slug: 'draft-project', status: 'draft', sortOrder: 3, titlePl: 'Projekt roboczy', titleEn: null, isFeatured: 0, featuredOrder: null },
  ]
  const pool = {
    adminProjects,
    lastConnection: null,
    async execute(sql, values) {
      if (sql.includes('FROM auth_sessions s')) {
        return [[{ id: 1, email: 'admin@cimach.test', role }], []]
      }
      if (sql.includes('FROM projects p') && sql.includes('LEFT JOIN project_translations')) {
        return [adminProjects, []]
      }
      if (sql.includes('FROM projects WHERE id = ? LIMIT 1')) {
        return values[0] === '7' || values[0] === 7 ? [[{
          id: 7, slug: 'studio-bodyart', projectUrl: 'https://michalowice.studio-bodyart.pl',
          mainImageUrl: null, status: 'published', sortOrder: 2,
        }], []] : [[], []]
      }
      if (sql.includes('FROM project_translations WHERE project_id = ?')) {
        return [[
          { locale: 'pl', title: 'Studio BodyArt', category: 'Business website', description: 'Strona usługowa.', seoTitle: null, seoDescription: null },
          { locale: 'en', title: 'Studio BodyArt', category: 'Business website', description: 'A service website.', seoTitle: null, seoDescription: null },
        ], []]
      }
      if (sql.includes('FROM project_technologies WHERE project_id = ? ORDER BY locale')) {
        return [[{ locale: 'pl', label: 'PHP' }, { locale: 'pl', label: 'SCSS' }, { locale: 'en', label: 'PHP' }], []]
      }
      if (sql.includes('FROM projects p') && sql.includes('p.slug = ?')) {
        if (values[1] === 'studio-bodyart') return [projectRow(values[0]), []]
        if (values[1] === 'cimach-eu') return [otherProjectRow(values[0]), []]
        return [[], []]
      }
      if (sql.includes('FROM projects p') && sql.includes("p.status = 'published'")) {
        if (sql.includes('p.is_featured = 1')) {
          const featured = adminProjects.filter((project) => Number(project.isFeatured) === 1 && project.status === 'published')
            .sort((a, b) => a.featuredOrder - b.featuredOrder)
          return [featured.flatMap((project) => project.id === '7' ? projectRow(values[0]) : otherProjectRow(values[0])), []]
        }
        return [[...projectRow(values[0]), ...otherProjectRow(values[0])], []]
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
    async getConnection() {
      const connection = {
        statements: [],
        async beginTransaction() { this.statements.push('BEGIN') },
        async commit() { this.statements.push('COMMIT') },
        async rollback() { this.statements.push('ROLLBACK') },
        release() { this.statements.push('RELEASE') },
        async execute(sql, values = []) {
          this.statements.push(sql)
          if (sql.includes('SELECT id FROM projects WHERE id = ? FOR UPDATE')) {
            return values[0] === '7' || values[0] === 7 ? [[{ id: 7 }], []] : [[], []]
          }
          if (sql.includes('SELECT source_url AS src') && sql.includes('FOR UPDATE')) {
            return [[{ src: 'https://images.example/photo.jpg', altPl: 'Wnętrze studia', altEn: 'Studio interior' }], []]
          }
          if (sql.includes('SELECT id, status FROM projects WHERE id IN')) {
            return [values.map((id) => adminProjects.find((project) => project.id === String(id))).filter(Boolean)
              .map(({ id, status }) => ({ id, status })), []]
          }
          if (sql.includes('UPDATE projects SET is_featured = 0')) {
            for (const project of adminProjects) { project.isFeatured = 0; project.featuredOrder = null }
          }
          if (sql.includes('UPDATE projects SET is_featured = 1')) {
            const [featuredOrder, id] = values
            const project = adminProjects.find((item) => item.id === String(id))
            if (project) { project.isFeatured = 1; project.featuredOrder = featuredOrder }
          }
          if (sql.includes('SET slug =') && values[0] === 'duplicate-slug') {
            const error = new Error('duplicate key')
            error.code = 'ER_DUP_ENTRY'
            throw error
          }
          return [{ affectedRows: 1 }, []]
        },
      }
      pool.lastConnection = connection
      return connection
    },
  }
  return pool
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

function otherProjectRow(locale) {
  return [{
    id: 9, number: '01', caseStudySlug: 'cimach-eu', href: 'https://cimach.eu', mainImage: null,
    name: 'cimach.eu', category: 'Portfolio', description: locale === 'pl' ? 'Portfolio.' : 'Portfolio.',
    seoTitle: null, seoDescription: null,
  }]
}

async function startApi(t, role = 'admin') {
  const pool = fakePool(role)
  const app = await createApp({
    pool,
    config,
    dummyPasswordHash: await bcrypt.hash('test-only-dummy-password', 4),
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  const token = jwt.sign({ sid: randomUUID(), role }, config.jwtSecret, {
    algorithm: 'HS256', subject: '1', issuer: config.jwtIssuer, audience: config.jwtAudience,
    expiresIn: 60, jwtid: randomUUID(),
  })
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    cookie: `cimach_admin=${token}`,
    pool,
  }
}

test('public project list returns the locale mapping without internal database IDs', async (t) => {
  const { base } = await startApi(t)
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

test('homepage catalog contains featured projects only while all published projects stay available', async (t) => {
  const { base } = await startApi(t)
  const featured = await (await fetch(`${base}/api/projects?locale=pl`)).json()
  const all = await (await fetch(`${base}/api/projects?locale=pl&scope=all`)).json()
  assert.deepEqual(featured.projects.map(({ caseStudySlug }) => caseStudySlug), ['studio-bodyart'])
  assert.deepEqual(all.projects.map(({ caseStudySlug }) => caseStudySlug), ['studio-bodyart', 'cimach-eu'])
  assert.equal(all.projects.some(({ caseStudySlug }) => caseStudySlug === 'draft-project'), false)
  assert.equal((await fetch(`${base}/api/projects/cimach-eu?locale=pl`)).status, 200)
})

test('public detail endpoint includes the translated gallery and rejects unknown or invalid routes', async (t) => {
  const { base } = await startApi(t)
  const response = await fetch(`${base}/api/projects/studio-bodyart?locale=pl`)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.project.description, 'Strona usługowa.')
  assert.deepEqual(body.project.gallery, [{ src: 'https://images.example/photo.jpg', alt: 'Wnętrze studia' }])
  assert.equal('id' in body.project, false)
  assert.equal((await fetch(`${base}/api/projects/missing?locale=pl`)).status, 404)
  assert.equal((await fetch(`${base}/api/projects?locale=de`)).status, 400)
})

test('admin project list requires an admin session and includes bilingual titles, status, slug and order', async (t) => {
  const { base, cookie } = await startApi(t)
  assert.equal((await fetch(`${base}/api/admin/projects`)).status, 401)

  const response = await fetch(`${base}/api/admin/projects`, { headers: { Cookie: cookie } })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.projects, [
    { id: '9', titlePl: 'cimach.eu', titleEn: 'cimach.eu', slug: 'cimach-eu', status: 'published', sortOrder: 1, isFeatured: false, featuredOrder: null },
    { id: '7', titlePl: 'Studio BodyArt', titleEn: 'Studio BodyArt', slug: 'studio-bodyart', status: 'published', sortOrder: 2, isFeatured: true, featuredOrder: 1 },
    { id: '8', titlePl: 'Projekt roboczy', titleEn: null, slug: 'draft-project', status: 'draft', sortOrder: 3, isFeatured: false, featuredOrder: null },
  ])
  assert.equal(body.featuredLimit, 3)
})

test('admin project list rejects authenticated users without the admin role', async (t) => {
  const { base, cookie } = await startApi(t, 'editor')
  assert.equal((await fetch(`${base}/api/admin/projects`, { headers: { Cookie: cookie } })).status, 403)
})

function editPayload(overrides = {}) {
  return {
    slug: 'studio-bodyart',
    projectUrl: 'https://michalowice.studio-bodyart.pl',
    mainImageUrl: null,
    status: 'published',
    sortOrder: 2,
    translations: {
      pl: { title: 'Studio BodyArt', category: 'Business website', description: 'Strona usługowa.', seoTitle: null, seoDescription: null, technologies: ['PHP', 'SCSS', 'JS'] },
      en: { title: 'Studio BodyArt', category: 'Business website', description: 'A service website.', seoTitle: null, seoDescription: null, technologies: ['PHP', 'SCSS', 'JS'] },
    },
    gallery: [{ src: 'https://images.example/photo.jpg', altPl: 'Wnętrze studia', altEn: 'Studio interior' }],
    ...overrides,
  }
}

async function putJson(base, path, body, cookie) {
  return fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { Origin: origin, 'X-CIMACH-CSRF': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
}

test('project editing is admin-only, validates bilingual data and keeps unchanged gallery rows', async (t) => {
  const admin = await startApi(t)
  assert.equal((await putJson(admin.base, '/api/admin/projects/7', editPayload())).status, 401)
  assert.equal((await putJson(admin.base, '/api/admin/projects/7', editPayload(), admin.cookie)).status, 200)
  assert.equal(admin.pool.lastConnection.statements.at(-2), 'COMMIT')
  assert.equal(admin.pool.lastConnection.statements.some((sql) => sql.includes('DELETE FROM project_images')), false)

  const missingTranslation = editPayload({ translations: { pl: editPayload().translations.pl } })
  assert.equal((await putJson(admin.base, '/api/admin/projects/7', missingTranslation, admin.cookie)).status, 422)
  assert.equal((await putJson(admin.base, '/api/admin/projects/7', editPayload({ slug: 'duplicate-slug' }), admin.cookie)).status, 409)

  const editor = await startApi(t, 'editor')
  assert.equal((await putJson(editor.base, '/api/admin/projects/7', editPayload(), editor.cookie)).status, 403)
})

test('featured selection is admin-only, bounded, transactional and independent from project sort order', async (t) => {
  const admin = await startApi(t)
  const path = `${admin.base}/api/admin/projects/featured`
  assert.equal((await putJson(admin.base, '/api/admin/projects/featured', { projectIds: ['9'] })).status, 401)
  assert.equal((await putJson(admin.base, '/api/admin/projects/featured', { projectIds: ['7', '7'] }, admin.cookie)).status, 422)
  assert.equal((await putJson(admin.base, '/api/admin/projects/featured', { projectIds: ['7', '9', '8', '11'] }, admin.cookie)).status, 422)
  assert.equal((await putJson(admin.base, '/api/admin/projects/featured', { projectIds: ['8'] }, admin.cookie)).status, 409)

  const saved = await putJson(admin.base, '/api/admin/projects/featured', { projectIds: ['9', '7'] }, admin.cookie)
  assert.equal(saved.status, 200)
  const result = await saved.json()
  assert.deepEqual(result.projects.filter(({ isFeatured }) => isFeatured).map(({ id, featuredOrder, sortOrder }) => ({ id, featuredOrder, sortOrder })), [
    { id: '9', featuredOrder: 1, sortOrder: 1 },
    { id: '7', featuredOrder: 2, sortOrder: 2 },
  ])
  assert.deepEqual((await (await fetch(`${admin.base}/api/projects?locale=pl`)).json()).projects.map(({ caseStudySlug }) => caseStudySlug), ['cimach-eu', 'studio-bodyart'])

  const editor = await startApi(t, 'editor')
  assert.equal((await putJson(editor.base, '/api/admin/projects/featured', { projectIds: ['7'] }, editor.cookie)).status, 403)
})
