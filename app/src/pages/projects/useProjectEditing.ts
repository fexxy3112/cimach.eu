import { useEffect, useRef, useState } from 'react'
import { hasAdminSession } from '../../auth/adminSession'
import { loadAdminProjectPreview, type PublicProjectDetail } from '../../data/projectApi'
import type { Locale } from '../../i18n/LocaleContext'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
type Content = { title: string; category: string; description: string; technologies: string[] }
type AdminDetail = { id: string; slug: string; status: 'draft' | 'published'; translations: Partial<Record<Locale, Content>> }

export function useProjectEditing(project: PublicProjectDetail | null, locale: Locale, onUpdated: (project: PublicProjectDetail) => void, preview = false) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [mode, setMode] = useState<'inline' | 'settings' | null>(null)
  const [draft, setDraft] = useState<Content | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<'draft' | 'published' | null>(project?.status ?? null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const shouldWarn = useRef(false)
  const editingInProgress = useRef(false)
  editingInProgress.current = mode !== null || settingsBusy
  const lock = useRef(false)
  const statusRevision = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => {
      const revision = statusRevision.current
      fetch(`${apiBase}/auth/me`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
        .then(async (response) => response.ok ? response.json() : null)
        .then(async (data) => {
          if (controller.signal.aborted) return
          const admin = hasAdminSession(data)
          setIsAdmin(admin)
          if (!admin) {
            if (editingInProgress.current) {
              setSessionExpired(true)
              setError(locale === 'pl' ? 'Sesja wygasła. Zmiany pozostają w edytorze. Zaloguj się w nowej karcie i ponów zapis.' : 'Your session expired. Your edits remain in the editor. Sign in in a new tab and try saving again.')
            } else if (preview) { setAccessDenied(true); window.location.replace(`/${locale}/login/?expired=1`) }
            return
          }
          setSessionExpired(false)
          setAccessDenied(false)
          if (project?.caseStudySlug) {
            const response = await fetch(`${apiBase}/admin/projects/by-slug/${encodeURIComponent(project.caseStudySlug)}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
            if (!response.ok) return
            const { project: detail } = await response.json() as { project: AdminDetail }
            if (!controller.signal.aborted && !lock.current && revision === statusRevision.current) { setStatus(detail.status); setProjectId(detail.id) }
          }
        })
        .catch(() => { if (!controller.signal.aborted) setIsAdmin(false) })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { controller.abort(); window.removeEventListener('focus', refresh) }
  }, [project?.caseStudySlug, locale, preview])

  useEffect(() => {
    if (!mode) return
    const warn = (event: BeforeUnloadEvent) => { if (shouldWarn.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [mode])

  function checkSession(response: Response) {
    if (response.status === 401) {
      setSessionExpired(true)
      throw new Error('session_expired')
    }
    setSessionExpired(false)
    if (response.status === 403) throw new Error('permission_denied')
  }

  function sessionError(cause: unknown) {
    if (!(cause instanceof Error)) return null
    if (cause.message === 'session_expired') return locale === 'pl'
      ? 'Sesja wygasła. Zmiany pozostają w edytorze. Zaloguj się w nowej karcie i ponów zapis.'
      : 'Your session expired. Your edits remain in the editor. Sign in in a new tab and try saving again.'
    if (cause.message === 'permission_denied') return locale === 'pl' ? 'Serwer odmówił dostępu. Sprawdź uprawnienia administratora.' : 'Access denied. Check your administrator permissions.'
    return null
  }

  async function begin(nextMode: 'inline' | 'settings') {
    if (lock.current || settingsBusy || !isAdmin || !project?.caseStudySlug) return
    lock.current = true
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const response = await fetch(`${apiBase}/admin/projects/by-slug/${encodeURIComponent(project.caseStudySlug)}`, { credentials: 'include', cache: 'no-store' })
      checkSession(response)
      if (!response.ok) throw new Error('load_failed')
      const { project: detail } = await response.json() as { project: AdminDetail }
      const content = detail.translations[locale]
      if (!content) throw new Error('missing_translation')
      setProjectId(detail.id)
      setStatus(detail.status)
      setDraft({ title: content.title, category: content.category, description: content.description, technologies: [...content.technologies] })
      shouldWarn.current = true
      setMode(nextMode)
    } catch (cause) {
      setError(sessionError(cause) ?? (locale === 'pl' ? 'Nie udało się otworzyć edycji projektu.' : 'Could not open the project editor.'))
    } finally { lock.current = false; setBusy(false) }
  }

  async function save() {
    if (lock.current || !draft || !project || !projectId) return
    lock.current = true
    setBusy(true)
    setError('')
    const content = {
      title: draft.title.trim(), category: draft.category.trim(), description: draft.description.trim(),
      technologies: draft.technologies.map((value) => value.trim()).filter(Boolean),
    }
    try {
      const response = await fetch(`${apiBase}/admin/projects/${encodeURIComponent(projectId)}/content`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CIMACH-CSRF': '1' },
        body: JSON.stringify({ locale, ...content }),
      })
      checkSession(response)
      if (response.status === 422) throw new Error('validation')
      if (!response.ok) throw new Error('save_failed')
      shouldWarn.current = false
      onUpdated({ ...project, name: content.title, category: content.category, description: content.description, technologies: content.technologies })
      setMode(null)
      setDraft(null)
      setSaved(true)
    } catch (cause) {
      setError(sessionError(cause) ?? (cause instanceof Error && cause.message === 'validation'
        ? locale === 'pl' ? 'Uzupełnij tytuł, kategorię i opis. Technologie: maks. 30 pozycji po 100 znaków.' : 'Enter a title, category and description. Technologies: up to 30 entries of 100 characters.'
        : locale === 'pl' ? 'Nie udało się zapisać zmian. Treść pozostała w edytorze.' : 'Could not save changes. Your edits are still available.'))
    } finally { lock.current = false; setBusy(false) }
  }

  async function settingsSaved() {
    if (!projectId || !project) return
    shouldWarn.current = false
    statusRevision.current++
    setMode(null)
    setBusy(true)
    lock.current = true
    try {
      const response = await fetch(`${apiBase}/admin/projects/${encodeURIComponent(projectId)}`, { credentials: 'include', cache: 'no-store' })
      checkSession(response)
      if (!response.ok) throw new Error('refresh_failed')
      const { project: detail } = await response.json() as { project: AdminDetail }
      setStatus(detail.status)
      if (detail.slug !== project.caseStudySlug || (!preview && detail.status === 'draft')) {
        window.location.assign(`/${locale}/admin/projects/${encodeURIComponent(detail.slug)}/preview/`)
        return
      }
      const data = await loadAdminProjectPreview(locale, detail.slug, apiBase)
      if (!data) throw new Error('refresh_failed')
      onUpdated(data.project)
      setSaved(true)
    } catch (cause) {
      setError(sessionError(cause) ?? (locale === 'pl' ? 'Zapisano projekt, ale nie udało się odświeżyć podglądu. Odśwież stronę.' : 'Project saved, but the preview could not be refreshed. Reload the page.'))
    } finally { lock.current = false; setBusy(false) }
  }

  async function changeStatus(next: 'draft' | 'published') {
    if (lock.current || settingsBusy || mode || !projectId || !project || next === status) return
    statusRevision.current++
    lock.current = true
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const response = await fetch(`${apiBase}/admin/projects/${encodeURIComponent(projectId)}/status`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CIMACH-CSRF': '1' },
        body: JSON.stringify({ status: next }),
      })
      checkSession(response)
      if (!response.ok) throw new Error('status_failed')
      setStatus(next)
      if (next === 'draft' && !preview) {
        window.location.assign(`/${locale}/admin/projects/${encodeURIComponent(project.caseStudySlug!)}/preview/`)
        return
      }
      onUpdated({ ...project, status: next })
      setSaved(true)
    } catch (cause) {
      setError(sessionError(cause) ?? (locale === 'pl' ? 'Nie udało się zmienić statusu projektu.' : 'Could not update project status.'))
    } finally { lock.current = false; setBusy(false) }
  }

  return { isAdmin, mode, draft, setDraft, projectId, busy, settingsBusy, setSettingsBusy, error, saved, begin, save, settingsSaved, status, changeStatus, accessDenied, sessionExpired,
    clearError() { setError('') },
    closeSettings() { shouldWarn.current = false; setMode(null); setDraft(null); setError(''); setSettingsBusy(false) },
    cancel() { if (!lock.current && !settingsBusy) { shouldWarn.current = false; setMode(null); setDraft(null); setError('') } },
  }
}
