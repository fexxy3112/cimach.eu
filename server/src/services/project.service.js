import { createProjectModel } from '../database/models/project.model.js'
import { FEATURED_PROJECT_LIMIT } from '../validators/project.validator.js'

export function createProjectService(pool) {
  const projects = createProjectModel(pool)
  return {
    async listForAdmin() {
      return { projects: await projects.findAllForAdmin(), featuredLimit: FEATURED_PROJECT_LIMIT }
    },
    async findForAdmin(id) {
      return projects.findAdminById(id)
    },
    async createForAdmin(project) {
      return projects.createAdmin(project)
    },
    async updateForAdmin(id, project) {
      const updated = await projects.updateAdminById(id, project)
      if (!updated) return null
      return projects.findAdminById(id)
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
