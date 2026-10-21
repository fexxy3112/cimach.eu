import { createProjectModel } from '../database/models/project.model.js'
import { FEATURED_PROJECT_LIMIT } from '../validators/project.validator.js'

export function createProjectService(pool, uploads) {
  const projects = createProjectModel(pool)
  return {
    async catalogForAdmin(locale) {
      const records = await projects.findAdminCatalog(locale)
      return { projects: records.map(({ id: _id, ...project }) => project) }
    },
    async previewForAdmin(slug, locale) {
      const record = await projects.findSlug(slug)
      if (!record) return null
      const detail = await projects.findAdminById(record.id)
      const translation = detail?.translations[locale]
      if (!translation) return null
      return {
        kind: 'project', locale, slug, preview: true,
        availableLocales: ['pl', 'en'].filter((language) => detail.translations[language]),
        project: {
          number: detail.number, status: detail.status,
          name: translation.title, category: translation.category, description: translation.description,
          technologies: translation.technologies, href: detail.projectUrl, caseStudySlug: detail.slug,
          mainImage: detail.mainImageUrl,
          mainImageAlt: locale === 'pl' ? detail.mainImageAltPl : detail.mainImageAltEn,
          seoTitle: translation.seoTitle, seoDescription: translation.seoDescription,
          gallery: detail.gallery.map((image) => ({ src: image.src, alt: locale === 'pl' ? image.altPl : image.altEn })),
        },
      }
    },
    async findForAdminBySlug(slug) {
      const project = await projects.findSlug(slug)
      return project ? projects.findAdminById(project.id) : null
    },
    async updateContentForAdmin(id, content) {
      return projects.updateContent(id, content)
    },
    async listForAdmin() {
      return { projects: await projects.findAllForAdmin(), featuredLimit: FEATURED_PROJECT_LIMIT }
    },
    async findForAdmin(id) {
      return projects.findAdminById(id)
    },
    async createForAdmin(project, userId) {
      return uploads.saveProject(project, userId, (normalized, connection) => projects.createAdmin(normalized, connection))
    },
    async updateForAdmin(id, project, userId) {
      const updated = await uploads.saveProject(project, userId, (normalized, connection) => projects.updateAdminById(id, normalized, connection))
      if (!updated) return null
      return projects.findAdminById(id)
    },
    async updateStatusForAdmin(id, status) {
      return projects.updateStatus(id, status)
    },
    async updateFeatured(projectIds) {
      await projects.updateFeatured(projectIds)
      return projects.findAllForAdmin()
    },
    async listPublished(locale) {
      const records = await projects.findFeatured(locale)
      return records.map(({ id: _id, ...project }) => project)
    },
    async listAllPublished(locale) {
      const records = await projects.findAllPublished(locale)
      return records.map(({ id: _id, ...project }) => project)
    },
    async findPublishedBySlug(slug, locale) {
      const record = await projects.findPublishedBySlug(slug, locale)
      if (!record) return null
      const { id: _id, ...project } = record
      return project
    },
  }
}
