import { isProjectStatus } from '../../validators/project.validator.js'

function mapProject(row, technologies = []) {
  return {
    id: String(row.id),
    number: row.number,
    name: row.name,
    category: row.category,
    description: row.description,
    technologies,
    href: row.href,
    caseStudySlug: row.caseStudySlug || undefined,
    mainImage: row.mainImage || null,
    seoTitle: row.seoTitle || null,
    seoDescription: row.seoDescription || null,
  }
}

export function createProjectModel(pool) {
  return {
    async findPublished(locale) {
      const [rows] = await pool.execute(
        `SELECT p.id, p.display_number AS number, p.slug AS caseStudySlug,
                p.project_url AS href, p.main_image_url AS mainImage,
                t.title AS name, t.category, t.description,
                t.seo_title AS seoTitle, t.seo_description AS seoDescription
         FROM projects p
         INNER JOIN project_translations t ON t.project_id = p.id AND t.locale = ?
         WHERE p.status = 'published'
         ORDER BY p.sort_order ASC, p.id ASC`,
        [locale],
      )
      if (rows.length === 0) return []
      const ids = rows.map(({ id }) => id)
      const placeholders = ids.map(() => '?').join(', ')
      const [technologyRows] = await pool.execute(
        `SELECT project_id AS projectId, label
         FROM project_technologies
         WHERE locale = ? AND project_id IN (${placeholders})
         ORDER BY project_id ASC, sort_order ASC`,
        [locale, ...ids],
      )
      const technologiesByProject = new Map()
      for (const row of technologyRows) {
        const key = String(row.projectId)
        const list = technologiesByProject.get(key) || []
        list.push(row.label)
        technologiesByProject.set(key, list)
      }
      return rows.map((row) => mapProject(row, technologiesByProject.get(String(row.id)) || []))
    },

    async findPublishedBySlug(slug, locale) {
      const [rows] = await pool.execute(
        `SELECT p.id, p.display_number AS number, p.slug AS caseStudySlug,
                p.project_url AS href, p.main_image_url AS mainImage,
                t.title AS name, t.category, t.description,
                t.seo_title AS seoTitle, t.seo_description AS seoDescription
         FROM projects p
         INNER JOIN project_translations t ON t.project_id = p.id AND t.locale = ?
         WHERE p.status = 'published' AND p.slug = ?
         LIMIT 1`,
        [locale, slug],
      )
      const row = rows[0]
      if (!row) return null

      const [[technologyRows], [imageRows]] = await Promise.all([
        pool.execute(
          `SELECT label FROM project_technologies
           WHERE project_id = ? AND locale = ? ORDER BY sort_order ASC`,
          [row.id, locale],
        ),
        pool.execute(
          `SELECT source_url AS src, alt_pl AS altPl, alt_en AS altEn
           FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, id ASC`,
          [row.id],
        ),
      ])
      const project = mapProject(row, technologyRows.map(({ label }) => label))
      project.gallery = imageRows.map((image) => ({ src: image.src, alt: locale === 'pl' ? image.altPl : image.altEn }))
      return project
    },

    async findLegacyKey(sourceKey, connection = pool) {
      const [rows] = await connection.execute('SELECT id FROM projects WHERE source_key = ? LIMIT 1', [sourceKey])
      return rows[0]?.id ?? null
    },

    async findSlug(slug, connection = pool) {
      const [rows] = await connection.execute('SELECT id, source_key AS sourceKey FROM projects WHERE slug = ? LIMIT 1', [slug])
      return rows[0] || null
    },

    async createLegacyProject(project, connection, status = 'published') {
      if (!isProjectStatus(status)) throw new Error('Invalid project status.')
      const [result] = await connection.execute(
        `INSERT INTO projects
          (source_key, display_number, slug, project_url, main_image_url, status, sort_order, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [project.sourceKey, project.number, project.slug, project.href, project.mainImage, status, project.order],
      )
      const projectId = result.insertId

      for (const translation of project.translations) {
        await connection.execute(
          `INSERT INTO project_translations
            (project_id, locale, title, category, description, seo_title, seo_description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [projectId, translation.locale, translation.name, translation.category, translation.description,
            translation.seoTitle, translation.seoDescription],
        )
        for (const [sortOrder, label] of translation.technologies.entries()) {
          await connection.execute(
            `INSERT INTO project_technologies (project_id, locale, sort_order, label)
             VALUES (?, ?, ?, ?)`,
            [projectId, translation.locale, sortOrder, label],
          )
        }
      }

      for (const [sortOrder, image] of project.images.entries()) {
        await connection.execute(
          `INSERT INTO project_images (project_id, source_url, alt_pl, alt_en, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [projectId, image.src, image.alt.pl, image.alt.en, sortOrder],
        )
      }
      return projectId
    },
  }
}

