import { useEffect, useState, type FormEvent } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import './LoginPage.scss'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

export function LoginPage() {
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const copy = locale === 'pl'
    ? {
        eyebrow: 'STREFA ADMINISTRACYJNA',
        title: 'Zaloguj się',
        intro: 'Zarządzanie portfolio CIMACH.',
        email: 'Adres e-mail',
        password: 'Hasło',
        submit: 'Zaloguj się',
        checking: 'Sprawdzam sesję…',
        invalid: 'Nieprawidłowy adres e-mail lub hasło.',
        rateLimited: 'Zbyt wiele prób. Spróbuj ponownie za 15 minut.',
        network: 'Nie można połączyć się z serwerem. Spróbuj ponownie.',
        expired: 'Sesja wygasła. Zaloguj się ponownie.',
        failed: 'Logowanie nie powiodło się. Spróbuj ponownie.',
      }
    : {
        eyebrow: 'ADMIN AREA',
        title: 'Sign in',
        intro: 'Manage the CIMACH portfolio.',
        email: 'Email address',
        password: 'Password',
        submit: 'Sign in',
        checking: 'Checking session…',
        invalid: 'The email or password is incorrect.',
        rateLimited: 'Too many attempts. Try again in 15 minutes.',
        network: 'Could not connect to the server. Please try again.',
        expired: 'Your session expired. Please sign in again.',
        failed: 'Sign in failed. Please try again.',
      }

  useEffect(() => {
    const expired = new URLSearchParams(window.location.search).has('expired')
    if (expired) setMessage(copy.expired)

    let cancelled = false
    fetch(`${apiBase}/auth/me`, { credentials: 'include' })
      .then((response) => {
        if (response.ok && !cancelled) window.location.replace(`/${locale}/admin/`)
      })
      .catch(() => {
        if (!cancelled && !expired) setMessage(copy.network)
      })

    return () => { cancelled = true }
  }, [locale, copy.expired, copy.network])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setMessage('')

    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CIMACH-CSRF': '1' },
        body: JSON.stringify({ email, password }),
      })
      if (response.ok) {
        window.location.assign(`/${locale}/admin/`)
        return
      }
      if (response.status === 401) setMessage(copy.invalid)
      else if (response.status === 429) setMessage(copy.rateLimited)
      else setMessage(copy.failed)
    } catch {
      setMessage(copy.network)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-page__content" aria-labelledby="login-title">
        <p className="eyebrow login-page__eyebrow">{copy.eyebrow}</p>
        <h1 id="login-title">{copy.title}<span>.</span></h1>
        <p className="login-page__intro">{copy.intro}</p>

        <form className="login-page__form" onSubmit={submit}>
          <label className="login-page__field">
            <span>{copy.email}</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="login-page__field">
            <span>{copy.password}</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="login-page__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? copy.checking : copy.submit}
          </button>
          <p className="login-page__notice" role="status" aria-live="polite">{message}</p>
        </form>
      </section>
    </main>
  )
}
