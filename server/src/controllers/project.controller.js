export function createProjectController(projectService) {
  return {
    async adminCatalog(req, res, next) {
      try { return res.json(await projectService.catalogForAdmin(req.projectLocale)) }
      catch (error) { return next(error) }
    },
    async adminPreview(req, res, next) {
      res.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      try {
        const preview = await projectService.previewForAdmin(req.params.slug, req.projectLocale)
        if (!preview) return res.status(404).json({ error: 'not_found' })
        return res.json(preview)
      } catch (error) { return next(error) }
    },
    async adminDetailBySlug(req, res, next) {
      try {
        const project = await projectService.findForAdminBySlug(req.params.slug)
        if (!project) return res.status(404).json({ error: 'not_found' })
        return res.json({ project })
      } catch (error) { return next(error) }
    },
    async adminUpdateContent(req, res, next) {
      try {
        const updated = await projectService.updateContentForAdmin(req.params.id, req.validatedContent)
        if (!updated) return res.status(404).json({ error: 'not_found' })
        return res.json({ saved: true })
      } catch (error) { return next(error) }
    },
    async adminUpdateStatus(req, res, next) {
      try {
        const updated = await projectService.updateStatusForAdmin(req.params.id, req.validatedProjectStatus)
        if (!updated) return res.status(404).json({ error: 'not_found' })
        return res.json({ status: req.validatedProjectStatus })
      } catch (error) {
        return next(error)
      }
    },

    async adminList(_req, res, next) {
      try {
        return res.json(await projectService.listForAdmin())
      } catch (error) {
        return next(error)
      }
    },

    async adminDetail(req, res, next) {
      try {
        const project = await projectService.findForAdmin(req.params.id)
        if (!project) return res.status(404).json({ error: 'not_found' })
        return res.json({ project })
      } catch (error) {
        return next(error)
      }
    },

    async adminCreate(req, res, next) {
      try {
        const id = await projectService.createForAdmin(req.validatedProject, req.auth.userId)
        return res.status(201).json({ project: { id } })
      } catch (error) {
        if (error?.code === 'DUPLICATE_PROJECT_SLUG') return res.status(409).json({ error: 'slug_conflict' })
        return next(error)
      }
    },

    async adminUpdate(req, res, next) {
      try {
        const project = await projectService.updateForAdmin(req.params.id, req.validatedProject, req.auth.userId)
        if (!project) return res.status(404).json({ error: 'not_found' })
        return res.json({ project })
      } catch (error) {
        if (error?.code === 'DUPLICATE_PROJECT_SLUG') return res.status(409).json({ error: 'slug_conflict' })
        return next(error)
      }
    },

    async adminUpdateFeatured(req, res, next) {
      try {
        const projects = await projectService.updateFeatured(req.validatedProjectIds)
        return res.json({ projects })
      } catch (error) {
        if (error?.code === 'INVALID_FEATURED_PROJECTS') return res.status(409).json({ error: 'featured_projects_must_be_published' })
        return next(error)
      }
    },

    async list(req, res, next) {
      try {
        const projects = req.projectScope === 'all'
          ? await projectService.listAllPublished(req.projectLocale)
          : await projectService.listPublished(req.projectLocale)
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
