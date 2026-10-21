import { createProjectModel } from '../database/models/project.model.js'
import { FEATURED_PROJECT_LIMIT } from '../validators/project.validator.js'

export function createProjectService(pool, uploads) {
  const projects = createProjectModel(pool)
  return {
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
