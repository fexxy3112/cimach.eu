import type { PublicProject } from './projectApi'

export const PROJECTS_PER_PAGE = 10

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ł', 'l')
}

export function projectCatalogView(projects: PublicProject[], query: string, requestedPage: number) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean)
  const filtered = projects.filter((project) => {
    const text = normalize([project.name, project.category, project.description, project.caseStudySlug || '', ...project.technologies].join(' '))
    return terms.every((term) => text.includes(term))
  })
  const pages = Math.max(1, Math.ceil(filtered.length / PROJECTS_PER_PAGE))
  const page = Math.min(pages, Math.max(1, Math.trunc(requestedPage) || 1))
  const offset = (page - 1) * PROJECTS_PER_PAGE
  return { projects: filtered.slice(offset, offset + PROJECTS_PER_PAGE), total: filtered.length, pages, page, offset }
}
