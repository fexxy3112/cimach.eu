import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

let getSeo

before(async () => {
  const source = await readFile(resolve(process.cwd(), 'src/seo.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  ;({ getSeo } = await import(moduleUrl))
})

test('uses dynamic slug SEO and only emits hreflang for available translations', () => {
  const project = {
    number: '17', name: 'New project', description: 'Project description.',
    seoTitle: 'Project SEO title', seoDescription: 'Project SEO description.',
  }
  const pl = getSeo('pl', 'project', project, 'new-project-17', ['pl', 'en'])
  assert.equal(pl.canonical, 'https://cimach.eu/pl/projects/new-project-17/')
  assert.equal(pl.alternatePl, 'https://cimach.eu/pl/projects/new-project-17/')
  assert.equal(pl.alternateEn, 'https://cimach.eu/en/projects/new-project-17/')
  assert.equal(pl.xDefault, 'https://cimach.eu/pl/projects/new-project-17/')
  assert.equal(pl.title, 'Project SEO title')
  assert.equal(pl.description, 'Project SEO description.')

  const enOnly = getSeo('en', 'project', project, 'new-project-17', ['en'])
  assert.equal(enOnly.canonical, 'https://cimach.eu/en/projects/new-project-17/')
  assert.equal(enOnly.alternatePl, null)
  assert.equal(enOnly.alternateEn, 'https://cimach.eu/en/projects/new-project-17/')
  assert.equal(enOnly.xDefault, null)
})

test('preserves the Studio BodyArt SEO and canonical URLs', () => {
  const studio = getSeo('pl', 'project', {
    number: '02', name: 'Studio BodyArt', description: 'Description.',
    seoTitle: 'Studio BodyArt - projekt | CIMACH', seoDescription: 'Studio SEO description.',
  }, 'studio-bodyart', ['pl', 'en'])
  assert.equal(studio.canonical, 'https://cimach.eu/pl/projects/studio-bodyart/')
  assert.equal(studio.alternateEn, 'https://cimach.eu/en/projects/studio-bodyart/')
  assert.equal(studio.title, 'Studio BodyArt - projekt | CIMACH')
  assert.equal(studio.description, 'Studio SEO description.')
})
