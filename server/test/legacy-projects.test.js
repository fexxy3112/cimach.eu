import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const snapshot = JSON.parse(await readFile(resolve(root, 'server/data/legacy-projects.json'), 'utf8'))

test('legacy snapshot has representative Polish characters intact', () => {
  const bodyArt = snapshot.projects.find(({ number }) => number === '02')
  assert.match(bodyArt.translations.pl.description, /usługowa/u)
  assert.match(bodyArt.translations.pl.description, /responsywność/u)
  assert.match(bodyArt.images[0].alt.pl, /Wnętrze/u)
  assert.doesNotMatch(JSON.stringify(snapshot), /(?:Ã.|Ä.|Ĺ.|â€)/u)
})

test('snapshot source hashes still match the static portfolio sources', async () => {
  for (const [relativePath, expectedHash] of Object.entries(snapshot.sourceFiles)) {
    const contents = await readFile(resolve(root, relativePath))
    const actualHash = createHash('sha256').update(contents).digest('hex').toUpperCase()
    assert.equal(actualHash, expectedHash, `${relativePath} changed; refresh the snapshot before importing`)
  }
})
