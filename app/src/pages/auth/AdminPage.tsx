import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import './AdminPage.scss'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

type AdminUser = { id: string; email: string; role: string }

export function AdminPage() {
  const locale = useLocale()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const copy = locale === 'pl'
    ? {
        eyebrow: 'STREFA ADMINISTRACYJNA', title: 'Panel', intro: 'Sesja administratora jest aktywna.',
        logout: 'Wyloguj się', loading: 'Sprawdzam dostęp…', unavailable: 'Nie można połączyć się z serwerem.',
        logoutError: 'Wylogowanie nie powiodło się. Spróbuj ponownie.', pending: 'Zarządzanie treścią pojawi się w kolejnym etapie.',
      }
    : {
        eyebrow: 'ADMIN AREA', title: 'Dashboard', intro: 'Administrator session is active.',
        logout: 'Sign out', loading: 'Checking access…', unavailable: 'Could not connect to the server.',
        logoutError: 'Sign out failed. Please try again.', pending: 'Content management will be added in a later stage.',
      }

  useEffect(() => {
    let cancelled = false
    fetch(`${apiBase}/admin`, { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          window.location.replace(`/${locale}/login/?expired=1`)
          return
        }
        if (!response.ok) throw new Error('admin_api_error')
        const result = await response.json() as { user: AdminUser }
        if (!cancelled) setUser(result.user)
      })
      .catch(() => {
        if (!cancelled) setMessage(copy.unavailable)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [locale, copy.unavailable])

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
                <p className="admin-page__identity">{user.email}</p>
                <p className="admin-page__message">{copy.pending}</p>
                <button className="admin-page__logout" type="button" onClick={logout} disabled={isLoggingOut}>
                  {isLoggingOut ? copy.loading : copy.logout}
                </button>
              </>
            : <p className="admin-page__message" role="alert">{message || copy.unavailable}</p>}
      </section>
    </main>
  )
}
