import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url))
const sourcePath = new URL('../data/legacy-projects.json', import.meta.url)

async function readSource() {
  const source = JSON.parse(await readFile(sourcePath, 'utf8'))
  for (const [relativePath, expectedHash] of Object.entries(source.sourceFiles || {})) {
    const contents = await readFile(resolve(workspaceRoot, relativePath))
    const actualHash = createHash('sha256').update(contents).digest('hex').toUpperCase()
    if (actualHash !== expectedHash) {
      throw new Error(`Source changed since snapshot capture: ${relativePath}. Review and refresh server/data/legacy-projects.json before importing.`)
    }
  }
  return source
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

function hasMojibake(value) {
  return /(?:Ĺ[‚›Ľ]|Ä(?:…|„|™|‡)|â€|ï¿½)/u.test(value)
}

function makeImportPlan(source) {
  const projects = []
  const skipped = []
  const encodingIssues = []
  const seenNumbers = new Set()
  const seenSlugs = new Set()

  for (const [order, project] of (source.projects || []).entries()) {
    const sourceKey = `static-home-${project.number || 'unknown'}`
    if (!isText(project.number) || project.number.length > 12 || seenNumbers.has(project.number)) {
      skipped.push({ key: sourceKey, reason: 'missing or duplicate project number' })
      continue
    }
    seenNumbers.add(project.number)
    if (hasMojibake(JSON.stringify({ translations: project.translations, images: project.images }))) {
      const issue = { key: sourceKey, reason: 'text appears to contain mojibake' }
      encodingIssues.push(issue)
      skipped.push(issue)
      continue
    }
    if (!isHttpsUrl(project.href) || (project.mainImage !== null && !isHttpsUrl(project.mainImage))) {
      skipped.push({ key: sourceKey, reason: 'invalid project or main image URL' })
      continue
    }
    const slug = project.slug ?? null
    if (slug !== null && (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seenSlugs.has(slug))) {
      skipped.push({ key: sourceKey, reason: 'invalid or duplicate case study slug' })
      continue
    }

    const translations = []
    let invalid = false
    for (const locale of ['pl', 'en']) {
      const translation = project.translations?.[locale]
      if (!translation || !isText(translation.name) || !isText(translation.category) ||
          !isText(translation.description) || !Array.isArray(translation.technologies) ||
          !translation.technologies.length || translation.technologies.some((label) => !isText(label) || label.length > 100)) {
        invalid = true
        break
      }
      translations.push({ locale, ...translation })
    }
    if (invalid) {
      skipped.push({ key: sourceKey, reason: 'missing or invalid Polish/English project content' })
      continue
    }

    const images = project.images ?? []
    if (!Array.isArray(images) || images.some((image) => !image || !isHttpsUrl(image.src) ||
        !isText(image.alt?.pl) || image.alt.pl.length > 512 || !isText(image.alt?.en) || image.alt.en.length > 512)) {
      skipped.push({ key: sourceKey, reason: 'invalid gallery source or missing localized alt text' })
      continue
    }
    if (slug) seenSlugs.add(slug)
    projects.push({
      sourceKey,
      number: project.number,
      slug,
      href: project.href,
      mainImage: project.mainImage,
      order,
      translations,
      images,
    })
  }
  return { projects, skipped, encodingIssues }
}

function report(plan, mode) {
  const imageCount = plan.projects.reduce((total, project) => total + project.images.length, 0)
  process.stdout.write(`Mode: ${mode}\nValid projects: ${plan.projects.length}\nGallery images: ${imageCount}\nEncoding problems: ${plan.encodingIssues.length}\nInvalid/skipped source records: ${plan.skipped.length}\n`)
  for (const record of plan.skipped) process.stdout.write(`Skipped ${record.key}: ${record.reason}\n`)
}

const args = new Set(process.argv.slice(2))
if ([...args].some((arg) => !['--apply', '--dry-run', '--source-only'].includes(arg)) ||
    (args.has('--apply') && args.has('--dry-run')) || (args.has('--source-only') && args.has('--apply'))) {
  process.stderr.write('Usage: node scripts/import-projects.js [--dry-run|--apply|--source-only]\n')
  process.exitCode = 2
} else {
  const mode = args.has('--source-only') ? 'source-only' : args.has('--apply') ? 'apply' : 'dry-run'
  let pool
  try {
    const plan = makeImportPlan(await readSource())
    if (mode === 'source-only') {
      report(plan, mode)
      if (plan.skipped.length) process.exitCode = 1
    } else {
      const [database, { createProjectModel }] = await Promise.all([
        import('../src/database/client.js'),
        import('../src/database/models/project.model.js'),
      ])
      pool = database.pool
      const [migrationRows] = await pool.execute(
        'SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1',
        ['002-project-catalog'],
      )
      if (!migrationRows.length) {
        const [catalogTables] = await pool.execute(
          `SELECT TABLE_NAME AS name FROM information_schema.tables
           WHERE table_schema = DATABASE()
             AND table_name IN ('projects', 'project_translations', 'project_technologies', 'project_images')`,
        )
        if (catalogTables.length) throw new Error('Catalog migration is unrecorded but project tables exist; inspect schema_migrations and the partial schema before continuing.')
        if (mode === 'apply') throw new Error('Run npm run db:migrate before importing projects.')
        report(plan, mode)
        process.stdout.write('Catalog schema: not installed; no project records can exist yet.\nAlready imported: 0\nWould import: ' + plan.projects.length + '\nPotential slug conflicts: 0\n')
      } else {
      if (plan.skipped.length && mode === 'apply') throw new Error('Import aborted because source records were skipped.')

      const model = createProjectModel(pool)
      const connection = await pool.getConnection()
      try {
        const imported = []
        const alreadyPresent = []
        const slugConflicts = []
        if (mode === 'apply') await connection.beginTransaction()
        try {
          for (const project of plan.projects) {
            if (await model.findLegacyKey(project.sourceKey, connection)) {
              alreadyPresent.push(project.sourceKey)
              continue
            }
            const slugMatch = project.slug ? await model.findSlug(project.slug, connection) : null
            if (slugMatch) {
              slugConflicts.push({ sourceKey: project.sourceKey, existingSourceKey: slugMatch.sourceKey })
              continue
            }
            if (mode === 'apply') await model.createLegacyProject(project, connection)
            imported.push(project.sourceKey)
          }
          if (slugConflicts.length && mode === 'apply') throw new Error('Import aborted because a case study slug is already used by another project.')
          if (mode === 'apply') await connection.commit()
        } catch (error) {
          if (mode === 'apply') await connection.rollback()
          throw error
        }
        report(plan, mode)
        process.stdout.write(`Already imported: ${alreadyPresent.length}\n${mode === 'apply' ? 'Imported' : 'Would import'}: ${imported.length}\n`)
        if (alreadyPresent.length) process.stdout.write(`Skipped existing records: ${alreadyPresent.join(', ')}\n`)
        process.stdout.write(`Potential slug conflicts: ${slugConflicts.length}\n`)
        for (const conflict of slugConflicts) process.stdout.write(`Slug conflict ${conflict.sourceKey}: already used by ${conflict.existingSourceKey || 'a non-legacy project'}\n`)
        if (slugConflicts.length) process.exitCode = 1
      } finally {
        connection.release()
      }
      if (plan.skipped.length) process.exitCode = 1
      }
    }
  } catch (error) {
    process.stderr.write(`Project import failed: ${error.message}\n`)
    process.exitCode = 1
  } finally {
    await pool?.end()
  }
}
