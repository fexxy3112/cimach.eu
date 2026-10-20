import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

let hasAdminSession

before(async () => {
  const source = await readFile(resolve(process.cwd(), 'src/auth/adminSession.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  ;({ hasAdminSession } = await import(moduleUrl))
})

test('admin navigation is enabled only for the authenticated admin session', () => {
  assert.equal(hasAdminSession({ user: { id: '7', role: 'admin' } }), true)
  assert.equal(hasAdminSession({ user: { id: '8', role: 'editor' } }), false)
  assert.equal(hasAdminSession({ error: 'unauthorized' }), false)
  assert.equal(hasAdminSession(null), false)
})
