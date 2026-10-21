import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createUploadService } from '../src/services/upload.service.js'

const filename = `${'a'.repeat(40)}.webp`
const secondFilename = `${'b'.repeat(40)}.webp`
const url = `/api/uploads/${filename}`
const bytes = Buffer.from('test-image-content')
const draft = (src = url) => ({ mainImageUrl: src, gallery: [] })

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'cimach-upload-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const references = new Set()
  let locked = false
  let timestamp = Date.now()
  const connection = {
    async execute(sql, values) {
      if (sql.includes('GET_LOCK')) { assert.equal(locked, false); locked = true; return [[{ acquired: 1 }]] }
      if (sql.includes('RELEASE_LOCK')) { locked = false; return [[{ released: 1 }]] }
      assert.equal(locked, true)
      return [values.some((value) => references.has(value)) ? [{ id: 1 }] : []]
    },
    release() { assert.equal(locked, false) },
  }
  const service = createUploadService({
    pool: { async getConnection() { return connection } },
    config: { uploadDir: directory, frontendOrigin: 'https://cimach.eu' },
    now: () => timestamp,
  })
  return { service, directory, references, connection, advance() { timestamp += 25 * 60 * 60 * 1000 } }
}

test('discard removes only unreferenced temporary uploads owned by the administrator', async (t) => {
  const { service, directory, references } = await fixture(t)
  await service.store(filename, bytes, '1')
  assert.deepEqual(await service.discard([url], '2'), { removed: 0 })
  references.add(url)
  assert.deepEqual(await service.discard([url], '1'), { removed: 0 })
  references.clear()
  assert.deepEqual(await service.discard([url], '1'), { removed: 1 })
  await assert.rejects(stat(join(directory, filename)), { code: 'ENOENT' })
  assert.deepEqual(await service.discard([url], '1'), { removed: 0 })
})

test('project save claims uploads, normalizes URLs and protects saved files from cancellation and expiry', async (t) => {
  const { service, directory, references, connection, advance } = await fixture(t)
  await service.store(filename, bytes, '1')
  const result = await service.saveProject(draft(`https://cimach.eu${url}?v=1`), '1', async (project, usedConnection) => {
    assert.equal(project.mainImageUrl, url)
    assert.equal(usedConnection, connection)
    references.add(url)
    return '7'
  })
  assert.equal(result, '7')
  assert.deepEqual(await service.discard([url], '1'), { removed: 0 })
  advance()
  assert.deepEqual(await service.cleanup(), { removed: 0 })
  assert.deepEqual(await readFile(join(directory, filename)), bytes)
})

test('replacement deletes the old managed file only after save and only when no project references it', async (t) => {
  const { service, directory, references } = await fixture(t)
  await service.store(filename, bytes, '1')
  await service.saveProject(draft(), '1', async () => { references.add(url); return '7' })
  await service.store(secondFilename, bytes, '1')
  const secondUrl = `/api/uploads/${secondFilename}`
  await service.saveProject(draft(secondUrl), '1', async () => { references.add(secondUrl); return '7' })
  await stat(join(directory, filename)) // another project still uses it
  references.delete(url)
  assert.deepEqual(await service.cleanup(), { removed: 1 })
  await assert.rejects(stat(join(directory, filename)), { code: 'ENOENT' })
  await stat(join(directory, secondFilename))
})

test('failed saves retain uploads for retry; expiry removes abandoned uploads', async (t) => {
  const { service, directory, advance } = await fixture(t)
  await service.store(filename, bytes, '1')
  await assert.rejects(service.saveProject(draft(), '1', async () => { throw new Error('database_failure') }))
  await stat(join(directory, filename))
  assert.deepEqual(await service.cleanup(), { removed: 0 })
  advance()
  assert.deepEqual(await service.cleanup(), { removed: 1 })
})

test('expired pending metadata after a crash does not delete a committed SQL reference', async (t) => {
  const { service, directory, references, advance } = await fixture(t)
  await service.store(filename, bytes, '1')
  references.add(url) // simulate SQL commit followed by process termination before metadata commit
  advance()
  assert.deepEqual(await service.cleanup(), { removed: 0 })
  const metadata = JSON.parse(await readFile(join(directory, '.metadata', `${filename}.json`), 'utf8'))
  assert.equal(metadata.state, 'committed')
})

test('unknown, removed and other-owner temporary uploads cannot be attached to projects', async (t) => {
  const { service } = await fixture(t)
  const save = () => assert.fail('invalid upload reached project save')
  await assert.rejects(service.saveProject(draft(), '1', save), { code: 'INVALID_UPLOAD' })
  await service.store(filename, bytes, '1')
  await assert.rejects(service.saveProject(draft(), '2', save), { code: 'INVALID_UPLOAD' })
  await service.discard([url], '1')
  await assert.rejects(service.saveProject(draft(), '1', save), { code: 'INVALID_UPLOAD' })
  assert.equal(service.filenameFromUrl('https://example.com/photo.webp'), null)
  assert.throws(() => service.filenameFromUrl('/api/uploads/%2e%2e%2fsecret.webp'), { code: 'INVALID_UPLOAD' })
})
