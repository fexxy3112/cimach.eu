import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import sharp from 'sharp'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
      if (sql.includes("p.status IN ('published', 'draft')")) {
        const locale = values[0]
        const rows = adminProjects
          .filter((project) => project.status === 'published' || project.id === '8')
          .filter((project) => project.id !== '8' || locale === 'pl')
          .map((project) => ({
            id: Number(project.id), number: project.id === '9' ? '01' : project.id === '7' ? '02' : '03',
            caseStudySlug: project.slug, href: 'https://example.com', mainImage: null,
            mainImageAlt: null, status: project.status,
            name: locale === 'en' ? project.titleEn : project.titlePl,
            category: project.id === '8' ? 'Strona' : 'Business website',
            description: project.id === '8' ? 'Treść szkicu.' : 'Project description.',
            seoTitle: null, seoDescription: null,
          }))
        return [rows, []]
      }
      if (sql.includes('FROM projects WHERE slug = ? LIMIT 1')) {
        const project = adminProjects.find((candidate) => candidate.slug === values[0])
        return [project ? [{ id: Number(project.id) }] : [], []]
      }
      if (sql.includes('FROM projects WHERE id = ? LIMIT 1')) {
        const project = adminProjects.find((candidate) => candidate.id === String(values[0]))
        return [project ? [{
          ...project, number: '02', projectUrl: 'https://michalowice.studio-bodyart.pl', mainImageUrl: null,
        }] : [], []]
      }
      if (sql.includes('FROM project_translations WHERE project_id = ?')) {
        if (String(values[0]) === '8') return [[{ locale: 'pl', title: 'Projekt roboczy', category: 'Strona', description: 'Treść szkicu.', seoTitle: null, seoDescription: null }], []]
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
          if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []]
          if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }], []]
          if (sql.includes('UNION ALL SELECT project_id')) return [[], []]
          if (sql.includes('SELECT project_id FROM project_translations')) return values[0] === '7' ? [[{ project_id: 7 }], []] : [[], []]
          if (sql.includes('MAX(CAST(display_number AS UNSIGNED))')) return [[{ nextNumber: 5 }], []]
          if (sql.includes('MAX(sort_order)')) return [[{ nextOrder: 3 }], []]
          if (sql.includes('INSERT INTO projects')) {
            this.createdProjectValues = values
            if (values[1] === 'duplicate-slug') {
              const error = new Error('duplicate key')
              error.code = 'ER_DUP_ENTRY'
              throw error
            }
            return [{ insertId: 10 }, []]
          }
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
  const uploadDir = await mkdtemp(join(tmpdir(), 'cimach-project-api-'))
  t.after(() => rm(uploadDir, { recursive: true, force: true }))
  const app = await createApp({
    pool,
    config: { ...config, uploadDir },
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
    uploadDir,
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

test('admin catalog returns only the requested locale, including drafts when translated', async (t) => {
  const anonymous = await startApi(t)
  assert.equal((await fetch(`${anonymous.base}/api/admin/projects/catalog?locale=pl`)).status, 401)

  const editor = await startApi(t, 'editor')
  assert.equal((await fetch(`${editor.base}/api/admin/projects/catalog?locale=en`, { headers: { Cookie: editor.cookie } })).status, 403)

  const { base, cookie } = await startApi(t)
  for (const locale of ['pl', 'en']) {
    const response = await fetch(`${base}/api/admin/projects/catalog?locale=${locale}`, { headers: { Cookie: cookie } })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.ok(body.projects.some((project) => project.caseStudySlug === 'studio-bodyart' && project.name === 'Studio BodyArt'))
    assert.ok(body.projects.some((project) => project.caseStudySlug === 'cimach-eu' && project.name === 'cimach.eu'))
    assert.equal(body.projects.some((project) => project.caseStudySlug === 'draft-project'), locale === 'pl')
    assert.ok(body.projects.every((project) => !('id' in project) && !('slug' in project) && !('projectUrl' in project)))
    assert.ok(body.projects.every((project) => !('translations' in project) && !('gallery' in project)))
  }
  const publicResponse = await fetch(`${base}/api/projects?locale=pl`)
  const publicBody = await publicResponse.json()
  assert.equal(publicResponse.status, 200)
  assert.equal(publicBody.projects.some((project) => project.caseStudySlug === 'draft-project'), false)
  assert.ok(publicBody.projects.every((project) => !('id' in project) && !('status' in project)))
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

async function postJson(base, path, body, cookie) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Origin: origin, 'X-CIMACH-CSRF': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
}

test('inline status endpoint enforces session, admin role, CSRF and status validation', async (t) => {
  const admin = await startApi(t)
  const path = '/api/admin/projects/7/status'
  assert.equal((await putJson(admin.base, path, { status: 'draft' })).status, 401)
  const editor = await startApi(t, 'editor')
  assert.equal((await putJson(editor.base, path, { status: 'draft' }, editor.cookie)).status, 403)
  assert.equal((await fetch(`${admin.base}${path}`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'draft' }),
  })).status, 403)
  assert.equal((await putJson(admin.base, path, { status: 'archived' }, admin.cookie)).status, 422)
  const originalExecute = admin.pool.execute.bind(admin.pool)
  admin.pool.execute = async (sql, values) => {
    if (sql.startsWith('UPDATE projects SET status')) {
      assert.deepEqual(values, ['draft', 'draft', 'draft', 'draft', '7'])
      return [{ affectedRows: 1 }]
    }
    return originalExecute(sql, values)
  }
  const response = await putJson(admin.base, path, { status: 'draft' }, admin.cookie)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'draft' })
})

function createPayload(overrides = {}) {
  return {
    slug: 'new-project',
    projectUrl: 'https://example.com/project',
    mainImageUrl: null,
    status: 'draft',
    sortOrder: 4,
    translations: {
      pl: { title: 'Nowy projekt', category: 'Strona internetowa', description: 'Opis projektu.', seoTitle: null, seoDescription: null, technologies: ['React'] },
      en: { title: 'New project', category: 'Website', description: 'Project description.', seoTitle: null, seoDescription: null, technologies: ['React'] },
    },
    gallery: [{ src: 'https://images.example/new.jpg', altPl: 'Zdjęcie projektu', altEn: 'Project image' }],
    ...overrides,
  }
}

test('draft preview requires an administrator, keeps gallery and locale data, and stays outside public API', async (t) => {
  const admin = await startApi(t)
  const editor = await startApi(t, 'editor')
  const path = '/api/admin/projects/by-slug/draft-project/preview?locale=pl'
  assert.equal((await fetch(`${admin.base}${path}`)).status, 401)
  assert.equal((await fetch(`${editor.base}${path}`, { headers: { Cookie: editor.cookie } })).status, 403)
  const response = await fetch(`${admin.base}${path}`, { headers: { Cookie: admin.cookie } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('x-robots-tag'), /noindex/)
  const preview = await response.json()
  assert.equal(preview.preview, true)
  assert.equal(preview.project.status, 'draft')
  assert.equal(preview.project.name, 'Projekt roboczy')
  assert.equal(preview.project.caseStudySlug, 'draft-project')
  assert.deepEqual(preview.availableLocales, ['pl'])
  assert.equal(preview.project.gallery.length, 1)
  assert.ok(preview.project.gallery[0].alt)
  assert.equal((await fetch(`${admin.base}/api/projects/draft-project?locale=pl`)).status, 404)
  assert.equal((await fetch(`${admin.base}/api/admin/projects/by-slug/draft-project/preview?locale=en`, { headers: { Cookie: admin.cookie } })).status, 404)
  assert.equal((await fetch(`${admin.base}/api/admin/projects/by-slug/unknown/preview?locale=pl`, { headers: { Cookie: admin.cookie } })).status, 404)
})

test('on-page project editing requires admin, validates locale content and uses a scoped transaction', async (t) => {
  const admin = await startApi(t)
  const editor = await startApi(t, 'editor')
  const lookup = '/api/admin/projects/by-slug/studio-bodyart'
  assert.equal((await fetch(`${admin.base}${lookup}`)).status, 401)
  assert.equal((await fetch(`${editor.base}${lookup}`, { headers: { Cookie: editor.cookie } })).status, 403)
  const detail = await fetch(`${admin.base}${lookup}`, { headers: { Cookie: admin.cookie } })
  assert.equal(detail.status, 200)
  assert.equal((await detail.json()).project.id, '7')
  assert.equal((await fetch(`${admin.base}/api/admin/projects/by-slug/missing`, { headers: { Cookie: admin.cookie } })).status, 404)
  const path = '/api/admin/projects/7/content'
  const content = { locale: 'pl', title: 'Tytuł projektu', category: 'Strona', description: 'Opis projektu.', technologies: ['React'] }
  assert.equal((await putJson(admin.base, path, content)).status, 401)
  assert.equal((await putJson(editor.base, path, content, editor.cookie)).status, 403)
  assert.equal((await fetch(`${admin.base}${path}`, { method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(content) })).status, 403)
  assert.equal((await putJson(admin.base, path, { ...content, locale: 'de' }, admin.cookie)).status, 422)
  assert.equal((await putJson(admin.base, '/api/admin/projects/99/content', content, admin.cookie)).status, 404)
  assert.equal((await putJson(admin.base, path, content, admin.cookie)).status, 200)
  assert.ok(admin.pool.lastConnection.statements.includes('COMMIT'))
  assert.equal(admin.pool.lastConnection.statements.some((sql) => sql.includes('UPDATE projects') || sql.includes('project_images')), false)
})

test('image upload and discard require admin and CSRF, optimize images and remove temporary files', async (t) => {
  const admin = await startApi(t)
  const editor = await startApi(t, 'editor')
  const png = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#668844' } }).png().toBuffer()
  const upload = (base, cookie, csrf = true) => {
    const form = new FormData()
    form.append('image', new Blob([png], { type: 'image/png' }), 'portrait.png')
    return fetch(`${base}/api/admin/uploads`, {
      method: 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { Origin: origin, 'X-CIMACH-CSRF': '1' } : {}) }, body: form,
    })
  }
  assert.equal((await upload(admin.base)).status, 401)
  assert.equal((await upload(editor.base, editor.cookie)).status, 403)
  assert.equal((await upload(admin.base, admin.cookie, false)).status, 403)
  const response = await upload(admin.base, admin.cookie)
  assert.equal(response.status, 201)
  const image = await response.json()
  assert.match(image.url, /^\/api\/uploads\/[a-f0-9]{40}\.webp$/)
  assert.equal(image.width, 600)
  assert.equal(image.height, 900)
  assert.equal(image.contentType, 'image/webp')
  const path = join(admin.uploadDir, image.url.split('/').at(-1))
  const metadata = await sharp(await readFile(path)).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.width / metadata.height, 2 / 3)
  assert.equal((await fetch(`${admin.base}${image.url}`)).status, 200)
  const discardPath = '/api/admin/uploads/discard'
  assert.equal((await postJson(admin.base, discardPath, { urls: [image.url] })).status, 401)
  assert.equal((await postJson(editor.base, discardPath, { urls: [image.url] }, editor.cookie)).status, 403)
  const discarded = await postJson(admin.base, discardPath, { urls: [image.url] }, admin.cookie)
  assert.equal(discarded.status, 200)
  assert.deepEqual(await discarded.json(), { removed: 1 })
  await assert.rejects(stat(path), { code: 'ENOENT' })
})

test('creating a project requires an admin and saves its translations, technologies and gallery transactionally', async (t) => {
  const admin = await startApi(t)
  const path = '/api/admin/projects'
  assert.equal((await postJson(admin.base, path, createPayload())).status, 401)

  const response = await postJson(admin.base, path, createPayload(), admin.cookie)
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { project: { id: '10' } })
  assert.deepEqual(admin.pool.lastConnection.createdProjectValues, [
    '05', 'new-project', 'https://example.com/project', null, null, null, 'draft', 3, 'draft',
  ])
  assert.equal(admin.pool.lastConnection.statements.filter((sql) => sql.includes('INSERT INTO project_translations')).length, 2)
  assert.equal(admin.pool.lastConnection.statements.filter((sql) => sql.includes('INSERT INTO project_technologies')).length, 2)
  assert.equal(admin.pool.lastConnection.statements.filter((sql) => sql.includes('INSERT INTO project_images')).length, 1)
  assert.ok(admin.pool.lastConnection.statements.includes('COMMIT'))

  assert.equal((await postJson(admin.base, path, createPayload({ slug: 'INVALID slug' }), admin.cookie)).status, 422)
  assert.equal((await postJson(admin.base, path, createPayload({ slug: 'duplicate-slug' }), admin.cookie)).status, 409)
  assert.equal((await postJson(admin.base, path, createPayload({ translations: { pl: createPayload().translations.pl } }), admin.cookie)).status, 422)
  const editor = await startApi(t, 'editor')
  assert.equal((await postJson(editor.base, path, createPayload(), editor.cookie)).status, 403)
})

test('project editing is admin-only, validates bilingual data and keeps unchanged gallery rows', async (t) => {
  const admin = await startApi(t)
  assert.equal((await putJson(admin.base, '/api/admin/projects/7', editPayload())).status, 401)
  assert.equal((await putJson(admin.base, '/api/admin/projects/7', editPayload(), admin.cookie)).status, 200)
  assert.ok(admin.pool.lastConnection.statements.includes('COMMIT'))
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
