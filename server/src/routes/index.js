import { Router } from 'express'
import { createAuthController } from '../controllers/auth.controller.js'
import { createAuthenticate, requireRole } from '../middleware/auth.middleware.js'
import { createLoginRateLimiter } from '../middleware/rate-limit.middleware.js'
import { createProjectController } from '../controllers/project.controller.js'
import { createImageUploadController } from '../controllers/image-upload.controller.js'
import { receiveImageUpload } from '../middleware/image-upload.middleware.js'
import { createProjectService } from '../services/project.service.js'
import { validateFeaturedSelection, validateProjectCreate, validateProjectId, validateProjectUpdate } from '../validators/project.validator.js'
import { createAuthRouter } from './auth.routes.js'
import { createProjectRouter } from './project.routes.js'

export function createApiRouter({ authService, config, pool }) {
  const router = Router()
  const authenticate = createAuthenticate(authService, config)
  const controller = createAuthController({ authService, config })
  const projectController = createProjectController(createProjectService(pool))
  const imageUploadController = createImageUploadController(config.uploadDir)

  router.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }))
  router.use('/auth', createAuthRouter({ controller, loginRateLimiter: createLoginRateLimiter(), authenticate }))
  router.use('/projects', createProjectRouter(projectController))
  router.get('/uploads/:filename', imageUploadController.serve)
  router.get('/admin', authenticate, requireRole('admin'), (req, res) => {
    res.json({ user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role } })
  })
  router.get('/admin/projects', authenticate, requireRole('admin'), projectController.adminList)
  router.post('/admin/uploads', authenticate, requireRole('admin'), receiveImageUpload, imageUploadController.upload)
  router.post('/admin/projects', authenticate, requireRole('admin'), validateProjectCreate, projectController.adminCreate)
  router.put('/admin/projects/featured', authenticate, requireRole('admin'), validateFeaturedSelection, projectController.adminUpdateFeatured)
  router.get('/admin/projects/:id', authenticate, requireRole('admin'), validateProjectId, projectController.adminDetail)
  router.put('/admin/projects/:id', authenticate, requireRole('admin'), validateProjectId, validateProjectUpdate, projectController.adminUpdate)
  return router
}
