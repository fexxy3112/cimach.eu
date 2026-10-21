import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProjectModel } from '../src/database/models/project.model.js'
import { validateProjectStatus } from '../src/validators/project.validator.js'

test('status validation rejects missing, arbitrary and non-string values', () => {
  for (const status of [undefined, null, '', 'archived', {}, ['published']]) {
    let code
    const res = { status(value) { code = value; return this }, json() {} }
    validateProjectStatus({ body: { status } }, res, () => assert.fail('invalid status accepted'))
    assert.equal(code, 422)
  }
  for (const status of ['published', 'draft']) {
    const req = { body: { status } }
    let accepted = false
    validateProjectStatus(req, {}, () => { accepted = true })
    assert.equal(accepted, true)
    assert.equal(req.validatedProjectStatus, status)
  }
})

test('status update limits writes to publication fields and clears featured only for drafts', async () => {
  for (const status of ['draft', 'published']) {
    const pool = { async execute(sql, values) {
      assert.deepEqual(values, [status, status, status, status, '7'])
      assert.match(sql, /is_featured = IF\(\? = 'draft', 0, is_featured\)/)
      assert.match(sql, /featured_order = IF\(\? = 'draft', NULL, featured_order\)/)
      assert.match(sql, /COALESCE\(published_at, UTC_TIMESTAMP\(3\)\)/)
      assert.doesNotMatch(sql, /slug|main_image|project_url|sort_order|DELETE/i)
      return [{ affectedRows: 1 }]
    } }
    assert.equal(await createProjectModel(pool).updateStatus('7', status), true)
  }
})

test('unchanged existing status succeeds while a missing project returns false', async () => {
  for (const exists of [false, true]) {
    const pool = { async execute(sql) {
      return sql.startsWith('SELECT') ? [exists ? [{ id: '7' }] : []] : [{ affectedRows: 0 }]
    } }
    assert.equal(await createProjectModel(pool).updateStatus('7', 'draft'), exists)
  }
})
