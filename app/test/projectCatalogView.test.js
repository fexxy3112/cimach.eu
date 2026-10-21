import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

let projectCatalogView

before(async () => {
  const source = await readFile(resolve(process.cwd(), 'src/data/projectCatalogView.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  ;({ projectCatalogView } = await import(moduleUrl))
})

function project(index, overrides = {}) {
  return {
    number: String(index), name: `Project ${index}`, category: 'Website', description: 'A project.',
    technologies: ['React'], href: 'https://example.com', caseStudySlug: `project-${index}`,
    mainImage: null, seoTitle: null, seoDescription: null, ...overrides,
  }
}

test('catalog view clamps requested pages and returns ten projects per page', () => {
  const projects = Array.from({ length: 23 }, (_, index) => project(index + 1))
  assert.deepEqual(projectCatalogView(projects, '', 0), {
    projects: projects.slice(0, 10), total: 23, pages: 3, page: 1, offset: 0,
  })
  assert.deepEqual(projectCatalogView(projects, '', 99), {
    projects: projects.slice(20), total: 23, pages: 3, page: 3, offset: 20,
  })
  assert.deepEqual(projectCatalogView(projects, '', 2.9), {
    projects: projects.slice(10, 20), total: 23, pages: 3, page: 2, offset: 10,
  })
})

test('catalog search normalizes Polish accents and matches technologies', () => {
  const projects = [
    project(1, { name: 'Żółć Studio', category: 'Design', technologies: ['React'] }),
    project(2, { name: 'Other', technologies: ['TypeScript'] }),
  ]
  assert.deepEqual(projectCatalogView(projects, 'zolc', 1).projects.map(({ number }) => number), ['1'])
  assert.deepEqual(projectCatalogView(projects, 'typescript', 1).projects.map(({ number }) => number), ['2'])
})

test('catalog search requires every term across searchable project fields', () => {
  const projects = [
    project(1, { name: 'Studio BodyArt', category: 'Business website', technologies: ['PHP', 'SCSS'] }),
    project(2, { name: 'Studio BodyArt', category: 'Business website', technologies: ['React'] }),
  ]
  assert.deepEqual(projectCatalogView(projects, '  bodyart   php ', 1).projects.map(({ number }) => number), ['1'])
  assert.deepEqual(projectCatalogView(projects, 'bodyart missing', 1).projects, [])
})

test('empty search results still expose one valid page', () => {
  assert.deepEqual(projectCatalogView([], 'no matches', 7), {
    projects: [], total: 0, pages: 1, page: 1, offset: 0,
  })
})
