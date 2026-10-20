import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../app/node_modules/typescript/lib/typescript.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const appRoot = resolve(root, 'app/src')

async function loadTypeScriptModule(relativePath, append = '', replacements = []) {
  let source = await readFile(resolve(appRoot, relativePath), 'utf8')
  for (const [before, after] of replacements) source = source.replace(before, after)
  const javascript = ts.transpileModule(`${source}\n${append}`, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
}

const english = await loadTypeScriptModule('data/portfolio-en.ts')
const englishUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(
  await readFile(resolve(appRoot, 'data/portfolio-en.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText).toString('base64')}`
const [polish, previews, seo] = await Promise.all([
  loadTypeScriptModule('data/portfolio.ts', '', [["from './portfolio-en'", `from '${englishUrl}'`]]),
  loadTypeScriptModule('data/project-previews.ts'),
  loadTypeScriptModule('seo.ts', 'export { studioBodyArtSeo }'),
])
const englishByNumber = new Map(english.portfolioEn.projects.map((project) => [project.number, project]))
const studioSeo = seo.studioBodyArtSeo
const sourceFiles = {}
for (const relativePath of [
  'app/src/data/portfolio.ts',
  'app/src/data/portfolio-en.ts',
  'app/src/data/project-previews.ts',
  'app/src/seo.ts',
]) {
  const contents = await readFile(resolve(root, relativePath))
  sourceFiles[relativePath] = createHash('sha256').update(contents).digest('hex').toUpperCase()
}

const projects = polish.portfolio.projects.map((project) => {
  const translated = englishByNumber.get(project.number)
  if (!translated) throw new Error(`Missing English project ${project.number}`)
  const isStudio = project.caseStudySlug === 'studio-bodyart'
  return {
    number: project.number,
    slug: project.caseStudySlug || null,
    href: project.href,
    mainImage: null,
    translations: {
      pl: {
        name: project.name,
        category: project.category,
        description: project.description,
        technologies: project.technologies,
        seoTitle: isStudio ? studioSeo.pl.title : null,
        seoDescription: isStudio ? studioSeo.pl.description : null,
      },
      en: {
        name: translated.name,
        category: translated.category,
        description: translated.description,
        technologies: translated.technologies,
        seoTitle: isStudio ? studioSeo.en.title : null,
        seoDescription: isStudio ? studioSeo.en.description : null,
      },
    },
    images: isStudio ? previews.studioBodyArtPreviews.map(({ src, alt }) => ({ src, alt })) : [],
  }
})

const output = `${JSON.stringify({ sourceFiles, projects }, null, 2)}\n`
await writeFile(resolve(root, 'server/data/legacy-projects.json'), output, 'utf8')
process.stdout.write(`Refreshed snapshot from source: ${projects.length} projects, ${projects.reduce((count, project) => count + project.images.length, 0)} images.\n`)
