import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import { AdminProjectEditor } from './AdminProjectEditor'
import './AdminPage.scss'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

type AdminUser = { id: string; email: string; role: string }
type AdminProject = {
  id: string
  titlePl: string | null
  titleEn: string | null
  slug: string | null
  status: 'draft' | 'published'
  sortOrder: number
  isFeatured: boolean
  featuredOrder: number | null
}

export function AdminPage() {
  const locale = useLocale()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [message, setMessage] = useState('')
  const [projects, setProjects] = useState<AdminProject[] | null>(null)
  const [projectsError, setProjectsError] = useState('')
  const [featuredError, setFeaturedError] = useState('')
  const [featuredSaved, setFeaturedSaved] = useState(false)
  const [savedFeaturedIds, setSavedFeaturedIds] = useState<string[]>([])
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const pointerDraggedProjectId = useRef<string | null>(null)
  const [featuredLimit, setFeaturedLimit] = useState(3)
  const [isSavingFeatured, setIsSavingFeatured] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const copy = locale === 'pl'
    ? {
        eyebrow: 'STREFA ADMINISTRACYJNA', title: 'Panel', intro: 'Sesja administratora jest aktywna.',
        logout: 'Wyloguj się', loading: 'Sprawdzam dostęp…', unavailable: 'Nie można połączyć się z serwerem.',
        logoutError: 'Wylogowanie nie powiodło się. Spróbuj ponownie.', projects: 'Projekty', featuredProjects: 'Wyróżnione projekty', allProjects: 'Wszystkie projekty',
        project: 'Tytuł PL', englishTitle: 'Tytuł EN', slug: 'Slug', status: 'Status', order: 'Kolejność',
        published: 'Opublikowany', draft: 'Szkic', noProjects: 'Brak projektów.',
        projectsUnavailable: 'Nie udało się pobrać listy projektów.',
        featuredHelp: 'Możesz oznaczyć maksymalnie {limit} opublikowanych projektów. Przeciągnij zaznaczone projekty, aby ustawić ich kolejność.',
        saveFeatured: 'Zapisz wyróżnione projekty', featuredSaved: 'Zapisano kolejność projektów na stronie głównej.',
        featuredError: 'Nie udało się zapisać wyróżnionych projektów.', unsaved: 'Masz niezapisane zmiany w wyróżnionych projektach.', discardUnsaved: 'Odrzucić niezapisane zmiany wyróżnionych projektów i przejść do edycji?', emptyFeatured: 'Nie wybrano jeszcze wyróżnionych projektów.', addFeatured: 'Dodaj do wyróżnionych', removeFeatured: 'Usuń z wyróżnionych', edit: 'Edytuj', drag: 'Przeciągnij, aby zmienić kolejność',
        actions: 'Akcje', newProject: 'Dodaj projekt',
      }
    : {
        eyebrow: 'ADMIN AREA', title: 'Dashboard', intro: 'Administrator session is active.',
        logout: 'Sign out', loading: 'Checking access…', unavailable: 'Could not connect to the server.',
        logoutError: 'Sign out failed. Please try again.', projects: 'Projects', featuredProjects: 'Featured projects', allProjects: 'All projects',
        project: 'Title PL', englishTitle: 'Title EN', slug: 'Slug', status: 'Status', order: 'Order',
        published: 'Published', draft: 'Draft', noProjects: 'No projects found.',
        projectsUnavailable: 'Could not load the project list.',
        featuredHelp: 'Choose up to {limit} published projects. Drag selected projects to change their order.',
        saveFeatured: 'Save featured projects', featuredSaved: 'Homepage project order saved.',
        featuredError: 'Could not save featured projects.', unsaved: 'You have unsaved changes to featured projects.', discardUnsaved: 'Discard unsaved featured project changes and continue to editing?', emptyFeatured: 'No featured projects selected yet.', addFeatured: 'Add to featured', removeFeatured: 'Remove from featured', edit: 'Edit', drag: 'Drag to change order',
        actions: 'Actions', newProject: 'Add project',
      }

  useEffect(() => {
    let cancelled = false
    let authenticated = false
    fetch(`${apiBase}/admin`, { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          window.location.replace(`/${locale}/login/?expired=1`)
          return
        }
        if (!response.ok) throw new Error('admin_api_error')
        const result = await response.json() as { user: AdminUser }
        if (cancelled) return
        setUser(result.user)
        authenticated = true

        const projectsResponse = await fetch(`${apiBase}/admin/projects`, { credentials: 'include' })
        if (projectsResponse.status === 401 || projectsResponse.status === 403) {
          window.location.replace(`/${locale}/login/?expired=1`)
          return
        }
        if (!projectsResponse.ok) throw new Error('admin_projects_error')
        const projectResult = await projectsResponse.json() as { projects: AdminProject[]; featuredLimit: number }
        if (!cancelled) {
          setProjects(projectResult.projects)
          setFeaturedLimit(projectResult.featuredLimit)
          setSavedFeaturedIds(getFeaturedIds(projectResult.projects))
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (authenticated) setProjectsError(copy.projectsUnavailable)
          else setMessage(copy.unavailable)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [locale, copy.unavailable, copy.projectsUnavailable])

  const currentFeaturedIds = projects ? getFeaturedIds(projects) : []
  const hasFeaturedChanges = currentFeaturedIds.length !== savedFeaturedIds.length ||
    currentFeaturedIds.some((id, index) => id !== savedFeaturedIds[index])
  const showUnsavedFeaturedChanges = hasFeaturedChanges && draggedProjectId === null
  const featuredProjects = projects
    ? projects.filter((project) => project.isFeatured).sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
    : []

  useEffect(() => {
    if (!showUnsavedFeaturedChanges) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [showUnsavedFeaturedChanges])

  useEffect(() => {
    if (!pointerDraggedProjectId.current) return
    const handleMove = (event: globalThis.PointerEvent) => {
      const sourceId = pointerDraggedProjectId.current
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-featured-project-id]')
      const targetId = target?.dataset.featuredProjectId
      if (sourceId && targetId && sourceId !== targetId) {
        reorderFeatured(sourceId, targetId)
      }
    }
    const handleEnd = () => handlePointerEnd()
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [draggedProjectId, projects])

  async function logout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setMessage('')
    try {
      const response = await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CIMACH-CSRF': '1' },
      })
      if (!response.ok && response.status !== 401) throw new Error('logout_failed')
      window.location.replace(`/${locale}/login/`)
    } catch {
      setMessage(copy.logoutError)
      setIsLoggingOut(false)
    }
  }

  function updateFeatured(projectId: string, selected: boolean) {
    if (!projects) return
    const ordered = projects.filter((project) => project.isFeatured).sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
    const current = projects.find((project) => project.id === projectId)
    if (!current || current.status !== 'published') return
    let next = ordered.filter((project) => project.id !== projectId)
    if (selected) {
      if (next.length >= featuredLimit) {
        setFeaturedError(locale === 'pl' ? `Możesz wybrać maksymalnie ${featuredLimit} projekty.` : `You can select up to ${featuredLimit} projects.`)
        return
      }
      next = [...next, current]
    }
    setFeaturedError('')
    setFeaturedSaved(false)
    setProjects(projects.map((project) => {
      const order = next.findIndex((item) => item.id === project.id)
      return { ...project, isFeatured: order >= 0, featuredOrder: order >= 0 ? order + 1 : null }
    }))
  }

  function reorderFeatured(sourceId: string, targetId: string) {
    if (!projects || sourceId === targetId) return
    const ordered = projects.filter((project) => project.isFeatured).sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
    const sourceIndex = ordered.findIndex((project) => project.id === sourceId)
    const targetIndex = ordered.findIndex((project) => project.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [moved] = ordered.splice(sourceIndex, 1)
    ordered.splice(targetIndex, 0, moved)
    setFeaturedSaved(false)
    setFeaturedError('')
    setProjects(projects.map((project) => {
      const order = ordered.findIndex((item) => item.id === project.id)
      return { ...project, featuredOrder: order >= 0 ? order + 1 : null }
    }))
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, projectId: string) {
    event.preventDefault()
    pointerDraggedProjectId.current = projectId
    setDraggedProjectId(projectId)
  }

  function handlePointerEnd() {
    pointerDraggedProjectId.current = null
    setDraggedProjectId(null)
  }

  function openProjectEditor(projectId: string) {
    if (hasFeaturedChanges && !window.confirm(copy.discardUnsaved)) return
    if (hasFeaturedChanges && projects) {
      setProjects(projects.map((project) => {
        const order = savedFeaturedIds.indexOf(project.id)
        return { ...project, isFeatured: order >= 0, featuredOrder: order >= 0 ? order + 1 : null }
      }))
      setFeaturedError('')
    }
    setIsCreatingProject(false)
    setEditingProjectId(projectId)
  }

  function openProjectCreator() {
    if (hasFeaturedChanges && !window.confirm(copy.discardUnsaved)) return
    if (hasFeaturedChanges && projects) {
      setProjects(projects.map((project) => {
        const order = savedFeaturedIds.indexOf(project.id)
        return { ...project, isFeatured: order >= 0, featuredOrder: order >= 0 ? order + 1 : null }
      }))
      setFeaturedError('')
    }
    setEditingProjectId(null)
    setIsCreatingProject(true)
  }

  async function saveFeatured() {
    if (!projects || isSavingFeatured) return
    setIsSavingFeatured(true)
    setFeaturedError('')
    setFeaturedSaved(false)
    const projectIds = projects
      .filter((project) => project.isFeatured)
      .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
      .map((project) => project.id)
    try {
      const response = await fetch(`${apiBase}/admin/projects/featured`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CIMACH-CSRF': '1' },
        body: JSON.stringify({ projectIds }),
      })
      if (response.status === 401 || response.status === 403) {
        window.location.replace(`/${locale}/login/?expired=1`)
        return
      }
      if (!response.ok) throw new Error('featured_update_failed')
      const result = await response.json() as { projects: AdminProject[] }
      setProjects(result.projects)
      setSavedFeaturedIds(getFeaturedIds(result.projects))
      setFeaturedError('')
      setFeaturedSaved(true)
    } catch {
      setFeaturedError(copy.featuredError)
    } finally {
      setIsSavingFeatured(false)
    }
  }

  async function refreshProjects() {
    setEditingProjectId(null)
    setIsCreatingProject(false)
    setProjectsError('')
    try {
      const response = await fetch(`${apiBase}/admin/projects`, { credentials: 'include', cache: 'no-store' })
      if (response.status === 401 || response.status === 403) {
        window.location.replace(`/${locale}/login/?expired=1`)
        return
      }
      if (!response.ok) throw new Error('projects_error')
      const result = await response.json() as { projects: AdminProject[]; featuredLimit: number }
      setProjects(result.projects)
      setSavedFeaturedIds(getFeaturedIds(result.projects))
      setFeaturedLimit(result.featuredLimit)
    } catch {
      setProjectsError(copy.projectsUnavailable)
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-page__content" aria-labelledby="admin-title">
        <p className="eyebrow admin-page__eyebrow">{copy.eyebrow}</p>
        <h1 id="admin-title">{copy.title}<span>.</span></h1>
        {isLoading
          ? <p className="admin-page__message" role="status">{copy.loading}</p>
          : user
            ? <>
                <p className="admin-page__intro">{copy.intro}</p>
                <div className="admin-page__identity">
                  <span>{user.email}</span>
                  <button className="admin-page__logout admin-page__logout--identity" type="button" onClick={logout} disabled={isLoggingOut}>
                    {isLoggingOut ? copy.loading : copy.logout}
                  </button>
                </div>
                {isCreatingProject || editingProjectId
                  ? <AdminProjectEditor
                      projectId={isCreatingProject ? null : editingProjectId}
                      initialSortOrder={projects ? Math.max(-1, ...projects.map((project) => project.sortOrder)) + 1 : 0}
                      onCancel={() => { setIsCreatingProject(false); setEditingProjectId(null) }}
                      onSaved={refreshProjects}
                    />
                  : <section className="admin-projects" aria-label={copy.projects}>
                  {projectsError && <p className="admin-page__message" role="alert">{projectsError}</p>}
                  <div className="admin-projects__topbar">
                    <button className="admin-page__logout" type="button" onClick={openProjectCreator}>{copy.newProject}</button>
                  </div>
                  <section className="admin-projects__group" aria-labelledby="admin-featured-title">
                    <h2 id="admin-featured-title" className="eyebrow">{copy.featuredProjects}</h2>
                    <p className="admin-projects__help">{copy.featuredHelp.replace('{limit}', String(featuredLimit))}</p>
                    {featuredProjects.length
                      ? <div className="admin-projects__featured-list">
                          {featuredProjects.map((project, index) => (
                            <article
                              key={project.id}
                              data-featured-project-id={project.id}
                              className={`admin-projects__featured-card${draggedProjectId === project.id ? ' admin-projects__featured-card--dragging' : ''}`}
                            >
                              <button
                                type="button"
                                className="admin-projects__drag-handle"
                                onPointerDown={(event) => handlePointerDown(event, project.id)}
                                onClick={(event) => event.preventDefault()}
                                aria-label={copy.drag}
                                title={copy.drag}
                              ><span aria-hidden="true" /></button>
                              <span className="admin-projects__featured-number">{String(index + 1).padStart(2, '0')}</span>
                              <div className="admin-projects__featured-name">
                                <strong>{project.titlePl || project.titleEn || project.slug}</strong>
                                <span>{project.titleEn || project.slug}</span>
                              </div>
                              <code>{project.slug || '—'}</code>
                              <button className="admin-projects__text-action" type="button" onClick={() => updateFeatured(project.id, false)}>{copy.removeFeatured}</button>
                            </article>
                          ))}
                        </div>
                      : <p className="admin-page__message">{copy.emptyFeatured}</p>}
                    <div className="admin-projects__save">
                      {featuredError && <p className="admin-page__message" role="alert">{featuredError}</p>}
                      {showUnsavedFeaturedChanges && <p className="admin-projects__unsaved" role="status">{copy.unsaved}</p>}
                      <button className="admin-page__logout" type="button" onClick={saveFeatured} disabled={isSavingFeatured || draggedProjectId !== null}>
                        {isSavingFeatured ? copy.loading : copy.saveFeatured}
                      </button>
                      {featuredSaved && <span className="admin-projects__saved" aria-live="polite">{copy.featuredSaved}</span>}
                    </div>
                  </section>
                  <section className="admin-projects__group" aria-labelledby="admin-all-projects-title">
                    <h2 id="admin-all-projects-title" className="eyebrow">{copy.allProjects}</h2>
                    {projects?.length
                      ? <table className="admin-projects__table">
                          <thead>
                            <tr>
                              <th scope="col">{copy.project}</th>
                              <th scope="col">{copy.englishTitle}</th>
                              <th scope="col">{copy.slug}</th>
                              <th scope="col">{copy.status}</th>
                              <th scope="col">{copy.order}</th>
                              <th scope="col">{copy.actions}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projects.map((project) => (
                              <tr key={project.id}>
                                <td data-label={copy.project}>{project.titlePl || '—'}</td>
                                <td data-label={copy.englishTitle}>{project.titleEn || '—'}</td>
                                <td data-label={copy.slug}><code>{project.slug || '—'}</code></td>
                                <td data-label={copy.status}>
                                  <span className={`admin-projects__status admin-projects__status--${project.status}`}>
                                    {project.status === 'published' ? copy.published : copy.draft}
                                  </span>
                                </td>
                                <td data-label={copy.order}>{project.sortOrder}</td>
                                <td data-label={copy.actions} className="admin-projects__row-actions">
                                  {project.status === 'published' && <button className="admin-projects__text-action" type="button" onClick={() => updateFeatured(project.id, !project.isFeatured)}>
                                    {project.isFeatured ? copy.removeFeatured : copy.addFeatured}
                                  </button>}
                                  <button className="admin-projects__edit" type="button" onClick={() => openProjectEditor(project.id)}>{copy.edit}</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      : <p className="admin-page__message">{copy.noProjects}</p>}
                  </section>
                </section>}
              </>
            : <p className="admin-page__message" role="alert">{message || copy.unavailable}</p>}
      </section>
    </main>
  )
}

function getFeaturedIds(projects: AdminProject[]) {
  return projects
    .filter((project) => project.isFeatured)
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
    .map((project) => project.id)
}
