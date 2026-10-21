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
    mainImageAlt: row.mainImageAlt || null,
    seoTitle: row.seoTitle || null,
    seoDescription: row.seoDescription || null,
  }
}

async function findPublishedProjects(pool, locale, featuredOnly) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.display_number AS number, p.slug AS caseStudySlug,
            p.project_url AS href, p.main_image_url AS mainImage,
            CASE WHEN t.locale = 'pl' THEN p.main_image_alt_pl ELSE p.main_image_alt_en END AS mainImageAlt,
            t.title AS name, t.category, t.description,
            t.seo_title AS seoTitle, t.seo_description AS seoDescription
     FROM projects p
     INNER JOIN project_translations t ON t.project_id = p.id AND t.locale = ?
     WHERE p.status = 'published'${featuredOnly ? ' AND p.is_featured = 1' : ''}
     ORDER BY ${featuredOnly ? 'p.featured_order ASC, ' : ''}p.sort_order ASC, p.id ASC`,
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
}

function duplicateSlugError(error) {
  if (error?.code !== 'ER_DUP_ENTRY') return error
  const conflict = new Error('A project with this slug already exists.')
  conflict.code = 'DUPLICATE_PROJECT_SLUG'
  return conflict
}

export function createProjectModel(pool) {
  return {
    async updateStatus(id, status) {
      const [result] = await pool.execute(
        `UPDATE projects SET status = ?,
           is_featured = IF(? = 'draft', 0, is_featured),
           featured_order = IF(? = 'draft', NULL, featured_order),
           published_at = IF(? = 'published', COALESCE(published_at, UTC_TIMESTAMP(3)), published_at)
         WHERE id = ?`,
        [status, status, status, status, id],
      )
      if (result.affectedRows > 0) return true
      const [rows] = await pool.execute('SELECT id FROM projects WHERE id = ? LIMIT 1', [id])
      return rows.length > 0
    },

    async findAllForAdmin() {
      const [rows] = await pool.execute(
        `SELECT p.id, p.slug, p.status, p.sort_order AS sortOrder,
                p.is_featured AS isFeatured, p.featured_order AS featuredOrder,
                MAX(CASE WHEN t.locale = 'pl' THEN t.title END) AS titlePl,
                MAX(CASE WHEN t.locale = 'en' THEN t.title END) AS titleEn
         FROM projects p
         LEFT JOIN project_translations t ON t.project_id = p.id
         GROUP BY p.id, p.slug, p.status, p.sort_order, p.is_featured, p.featured_order
         ORDER BY p.sort_order ASC, p.id ASC`,
      )
      return rows.map((row) => ({
        id: String(row.id),
        titlePl: row.titlePl || null,
        titleEn: row.titleEn || null,
        slug: row.slug || null,
        status: row.status,
        sortOrder: Number(row.sortOrder),
        isFeatured: Number(row.isFeatured) === 1,
        featuredOrder: row.featuredOrder === null ? null : Number(row.featuredOrder),
      }))
    },

    async findAdminById(id) {
      const [rows] = await pool.execute(
        `SELECT id, slug, project_url AS projectUrl, main_image_url AS mainImageUrl,
                main_image_alt_pl AS mainImageAltPl, main_image_alt_en AS mainImageAltEn,
                status, sort_order AS sortOrder
         FROM projects WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) return null
      const [translationRows] = await pool.execute(
        `SELECT locale, title, category, description, seo_title AS seoTitle,
                seo_description AS seoDescription
         FROM project_translations WHERE project_id = ?`,
        [id],
      )
      const [technologyRows] = await pool.execute(
        `SELECT locale, sort_order AS sortOrder, label
         FROM project_technologies WHERE project_id = ? ORDER BY locale, sort_order`,
        [id],
      )
      const [imageRows] = await pool.execute(
        `SELECT source_url AS src, alt_pl AS altPl, alt_en AS altEn, sort_order AS sortOrder
         FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, id ASC`,
        [id],
      )
      const translations = { pl: null, en: null }
      for (const row of translationRows) {
        if (row.locale !== 'pl' && row.locale !== 'en') continue
        translations[row.locale] = {
          title: row.title,
          category: row.category,
          description: row.description,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
          technologies: technologyRows.filter((technology) => technology.locale === row.locale).map(({ label }) => label),
        }
      }
      return {
        id: String(rows[0].id),
        slug: rows[0].slug,
        projectUrl: rows[0].projectUrl,
        mainImageUrl: rows[0].mainImageUrl,
        mainImageAltPl: rows[0].mainImageAltPl || '',
        mainImageAltEn: rows[0].mainImageAltEn || '',
        status: rows[0].status,
        sortOrder: Number(rows[0].sortOrder),
        translations,
        gallery: imageRows.map(({ src, altPl, altEn }) => ({ src, altPl, altEn })),
      }
    },

    async createAdmin(project, existingConnection) {
      const connection = existingConnection || await pool.getConnection()
      try {
        await connection.beginTransaction()
        const [[numberRow]] = await connection.execute(
          'SELECT COALESCE(MAX(CAST(display_number AS UNSIGNED)), 0) + 1 AS nextNumber FROM projects FOR UPDATE',
        )
        const [[orderRow]] = await connection.execute(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM projects FOR UPDATE',
        )
        const displayNumber = String(numberRow.nextNumber).padStart(2, '0')
        const sortOrder = Number(orderRow.nextOrder)
        const [result] = await connection.execute(
          `INSERT INTO projects
            (source_key, display_number, slug, project_url, main_image_url, main_image_alt_pl, main_image_alt_en, status, sort_order, published_at)
           VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'published', UTC_TIMESTAMP(3), NULL))`,
          [displayNumber, project.slug, project.projectUrl, project.mainImageUrl || null, project.mainImageAltPl || null, project.mainImageAltEn || null, project.status, sortOrder, project.status],
        )
        const projectId = result.insertId

        for (const locale of ['pl', 'en']) {
          const translation = project.translations[locale]
          await connection.execute(
            `INSERT INTO project_translations
              (project_id, locale, title, category, description, seo_title, seo_description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [projectId, locale, translation.title.trim(), translation.category.trim(), translation.description.trim(),
              translation.seoTitle || null, translation.seoDescription || null],
          )
          for (const [technologyOrder, label] of translation.technologies.entries()) {
            await connection.execute(
              'INSERT INTO project_technologies (project_id, locale, sort_order, label) VALUES (?, ?, ?, ?)',
              [projectId, locale, technologyOrder, label.trim()],
            )
          }
        }

        for (const [imageOrder, image] of project.gallery.entries()) {
          await connection.execute(
            `INSERT INTO project_images (project_id, source_url, alt_pl, alt_en, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [projectId, image.src, image.altPl, image.altEn, imageOrder],
          )
        }
        await connection.commit()
        return String(projectId)
      } catch (error) {
        await connection.rollback()
        throw duplicateSlugError(error)
      } finally {
        if (!existingConnection) connection.release()
      }
    },

    async updateAdminById(id, project, existingConnection) {
      const connection = existingConnection || await pool.getConnection()
      try {
        await connection.beginTransaction()
        const [existingRows] = await connection.execute('SELECT id FROM projects WHERE id = ? FOR UPDATE', [id])
        if (!existingRows.length) {
          await connection.rollback()
          return false
        }
        await connection.execute(
          `UPDATE projects
           SET slug = ?, project_url = ?, main_image_url = ?, main_image_alt_pl = ?, main_image_alt_en = ?, status = ?, sort_order = ?,
               is_featured = IF(? = 'draft', 0, is_featured),
               featured_order = IF(? = 'draft', NULL, featured_order),
               published_at = IF(? = 'published', COALESCE(published_at, UTC_TIMESTAMP(3)), published_at)
           WHERE id = ?`,
          [project.slug, project.projectUrl, project.mainImageUrl || null, project.mainImageAltPl || null, project.mainImageAltEn || null, project.status, project.sortOrder,
            project.status, project.status, project.status, id],
        )

        for (const locale of ['pl', 'en']) {
          const translation = project.translations[locale]
          await connection.execute(
            `INSERT INTO project_translations
              (project_id, locale, title, category, description, seo_title, seo_description)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), category = VALUES(category),
               description = VALUES(description), seo_title = VALUES(seo_title), seo_description = VALUES(seo_description)`,
            [id, locale, translation.title.trim(), translation.category.trim(), translation.description.trim(),
              translation.seoTitle || null, translation.seoDescription || null],
          )
          await connection.execute('DELETE FROM project_technologies WHERE project_id = ? AND locale = ?', [id, locale])
          for (const [sortOrder, label] of translation.technologies.entries()) {
            await connection.execute(
              'INSERT INTO project_technologies (project_id, locale, sort_order, label) VALUES (?, ?, ?, ?)',
              [id, locale, sortOrder, label.trim()],
            )
          }
        }

        const [currentImages] = await connection.execute(
          `SELECT source_url AS src, alt_pl AS altPl, alt_en AS altEn
           FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, id ASC FOR UPDATE`,
          [id],
        )
        const sameImages = currentImages.length === project.gallery.length && currentImages.every((image, index) =>
          image.src === project.gallery[index].src && image.altPl === project.gallery[index].altPl && image.altEn === project.gallery[index].altEn,
        )
        if (!sameImages) {
          await connection.execute('DELETE FROM project_images WHERE project_id = ?', [id])
          for (const [sortOrder, image] of project.gallery.entries()) {
            await connection.execute(
              `INSERT INTO project_images (project_id, source_url, alt_pl, alt_en, sort_order)
               VALUES (?, ?, ?, ?, ?)`,
              [id, image.src, image.altPl, image.altEn, sortOrder],
            )
          }
        }
        await connection.commit()
        return true
      } catch (error) {
        await connection.rollback()
        throw duplicateSlugError(error)
      } finally {
        if (!existingConnection) connection.release()
      }
    },

    async updateFeatured(projectIds) {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        if (projectIds.length) {
          const placeholders = projectIds.map(() => '?').join(', ')
          const [rows] = await connection.execute(
            `SELECT id, status FROM projects WHERE id IN (${placeholders}) FOR UPDATE`,
            projectIds,
          )
          if (rows.length !== projectIds.length || rows.some((row) => row.status !== 'published')) {
            const error = new Error('Featured projects must exist and be published.')
            error.code = 'INVALID_FEATURED_PROJECTS'
            throw error
          }
        }
        await connection.execute('UPDATE projects SET is_featured = 0, featured_order = NULL WHERE is_featured = 1')
        for (const [index, id] of projectIds.entries()) {
          await connection.execute(
            `UPDATE projects SET is_featured = 1, featured_order = ?
             WHERE id = ? AND status = 'published'`,
            [index + 1, id],
          )
        }
        await connection.commit()
        return true
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    },

    async findFeatured(locale) {
      return findPublishedProjects(pool, locale, true)
    },

    async findAllPublished(locale) {
      return findPublishedProjects(pool, locale, false)
    },

    async findPublishedBySlug(slug, locale) {
      const [rows] = await pool.execute(
        `SELECT p.id, p.display_number AS number, p.slug AS caseStudySlug,
                p.project_url AS href, p.main_image_url AS mainImage,
                CASE WHEN t.locale = 'pl' THEN p.main_image_alt_pl ELSE p.main_image_alt_en END AS mainImageAlt,
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

