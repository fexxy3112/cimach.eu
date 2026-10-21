import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProjectModel } from '../src/database/models/project.model.js'
import { validateProjectContent } from '../src/validators/project.validator.js'

function response() {
  return {
    code: null,
    body: null,
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
  }
}

function validContent(overrides = {}) {
  return {
    locale: 'pl', title: '  Tytuł  ', category: '  Kategoria  ', description: '  Opis  ',
    technologies: ['  Node.js  ', 'SQL'], ...overrides,
  }
}

test('project content accepts only PL or EN and copies only editable locale content', () => {
  for (const locale of ['pl', 'en']) {
    const req = { body: validContent({ locale, slug: 'must-not-pass', status: 'draft', gallery: [] }) }
    let called = false
    assert.equal(validateProjectContent(req, {}, () => { called = true }), undefined)
    assert.equal(called, true)
    assert.deepEqual(req.validatedContent, {
      locale, title: 'Tytuł', category: 'Kategoria', description: 'Opis', technologies: ['Node.js', 'SQL'],
    })
    assert.equal('slug' in req.validatedContent, false)
    assert.equal('status' in req.validatedContent, false)
    assert.equal('gallery' in req.validatedContent, false)
  }
})

test('project content rejects missing, invalid, blank and oversized required values and technologies', () => {
  const invalidBodies = [
    {},
    ...['', 'fr', null, 1].map((locale) => validContent({ locale })),
    ...['title', 'category', 'description'].flatMap((key) => [
      validContent({ [key]: undefined }), validContent({ [key]: '   ' }),
      validContent({ [key]: 'x'.repeat(key === 'description' ? 20001 : 256) }),
    ]),
    ...[undefined, 'Node.js', ['  '], [1], ['x'.repeat(101)], Array(31).fill('x')]
      .map((technologies) => validContent({ technologies })),
  ]
  for (const body of invalidBodies) {
    const res = response()
    let called = false
    validateProjectContent({ body }, res, () => { called = true })
    assert.equal(called, false)
    assert.equal(res.code, 422)
    assert.equal(res.body.error, 'validation_failed')
    assert.ok(Object.keys(res.body.fields).length > 0)
  }
})

function fakePool({ translationExists = true, failAt = null } = {}) {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push(['begin']) },
    async execute(sql, values = []) {
      calls.push([sql, values])
      if (failAt && sql.startsWith(failAt)) throw new Error('database failure')
      if (sql.startsWith('SELECT project_id')) return [translationExists ? [{ project_id: 12 }] : []]
      return [{ affectedRows: 1 }]
    },
    async commit() { calls.push(['commit']) },
    async rollback() { calls.push(['rollback']) },
    release() { calls.push(['release']) },
  }
  return { calls, pool: { async getConnection() { return connection } } }
}

test('content update writes only the requested translation and replaces its technologies transactionally', async () => {
  const { calls, pool } = fakePool()
  assert.equal(await createProjectModel(pool).updateContent('12', {
    locale: 'en', title: 'Title', category: 'Category', description: 'Description', technologies: ['Node.js', 'SQL'],
  }), true)
  assert.deepEqual(calls[0], ['begin'])
  assert.deepEqual(calls.at(-2), ['commit'])
  assert.deepEqual(calls.at(-1), ['release'])
  assert.deepEqual(calls[1], ['SELECT project_id FROM project_translations WHERE project_id = ? AND locale = ? FOR UPDATE', ['12', 'en']])
  assert.deepEqual(calls[2][1], ['Title', 'Category', 'Description', '12', 'en'])
  assert.deepEqual(calls[3][1], ['12', 'en'])
  assert.deepEqual(calls.slice(4, 6).map((call) => call[1]), [['12', 'en', 0, 'Node.js'], ['12', 'en', 1, 'SQL']])
  assert.ok(calls.every(([sql]) => typeof sql !== 'string' || !/UPDATE projects\b|project_images|locale = 'pl'/i.test(sql)))
})

test('content update rolls back and releases when the requested translation is missing', async () => {
  const { calls, pool } = fakePool({ translationExists: false })
  assert.equal(await createProjectModel(pool).updateContent('12', {
    locale: 'pl', title: 'T', category: 'C', description: 'D', technologies: [],
  }), false)
  assert.deepEqual(calls.map(([name]) => name), ['begin', 'SELECT project_id FROM project_translations WHERE project_id = ? AND locale = ? FOR UPDATE', 'rollback', 'release'])
})

test('content update rolls back and releases after a database failure', async () => {
  const { calls, pool } = fakePool({ failAt: 'INSERT INTO project_technologies' })
  await assert.rejects(createProjectModel(pool).updateContent('12', {
    locale: 'pl', title: 'T', category: 'C', description: 'D', technologies: ['Node.js'],
  }), /database failure/)
  assert.equal(calls.at(-2)[0], 'rollback')
  assert.equal(calls.at(-1)[0], 'release')
  assert.equal(calls.some(([name]) => name === 'commit'), false)
})
