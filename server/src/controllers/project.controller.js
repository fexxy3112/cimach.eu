export function createProjectController(projectService) {
  return {
    async list(req, res, next) {
      try {
        const projects = await projectService.listPublished(req.projectLocale)
        return res.json({ projects })
      } catch (error) {
        return next(error)
      }
    },

    async detail(req, res, next) {
      try {
        const project = await projectService.findPublishedBySlug(req.params.slug, req.projectLocale)
        if (!project) return res.status(404).json({ error: 'not_found' })
        return res.json({ project })
      } catch (error) {
        return next(error)
      }
    },
  }
}
