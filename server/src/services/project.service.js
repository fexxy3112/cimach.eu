import { createProjectModel } from '../database/models/project.model.js'

export function createProjectService(pool) {
  const projects = createProjectModel(pool)
  return {
    async listPublished(locale) {
      const records = await projects.findPublished(locale)
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
