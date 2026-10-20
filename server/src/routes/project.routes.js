import { Router } from 'express'
import { validateProjectLocale } from '../validators/project.validator.js'

export function createProjectRouter(controller) {
  const router = Router()
  router.get('/', validateProjectLocale, controller.list)
  router.get('/:slug', validateProjectLocale, controller.detail)
  return router
}
