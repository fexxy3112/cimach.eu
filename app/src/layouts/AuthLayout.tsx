import type { ReactNode } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import './AuthLayout.scss'

export function AuthLayout({ children }: { children: ReactNode }) {
  const locale = useLocale()
  const copy = locale === 'pl'
    ? { home: 'Wróć do portfolio', language: 'Zmień język' }
    : { home: 'Back to portfolio', language: 'Change language' }

  return (
    <div className="auth-layout">
      <header className="auth-layout__header">
        <a className="auth-layout__brand" href={`/${locale}/`} aria-label="CIMACH">CIMACH<span>.</span></a>
        <nav className="auth-layout__nav" aria-label={copy.language}>
          <a href="/pl/login/" lang="pl" aria-current={locale === 'pl' ? 'page' : undefined}>PL</a>
          <span aria-hidden="true">/</span>
          <a href="/en/login/" lang="en" aria-current={locale === 'en' ? 'page' : undefined}>EN</a>
          <a className="auth-layout__home" href={`/${locale}/`}>{copy.home}</a>
        </nav>
      </header>
      {children}
    </div>
  )
}
