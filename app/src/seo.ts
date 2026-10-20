import type { Locale } from './i18n/LocaleContext'

const seo = {
  pl: {
    title: 'Cimach - Mateusz Cimachowski | Web developer i fotografia',
    description: 'Cimach — portfolio Mateusza Cimachowskiego. Tworzę strony internetowe i aplikacje webowe; zajmuję się też fotografią.',
    path: '/pl/',
    ogLocale: 'pl_PL',
  },
  en: {
    title: 'Cimach - Mateusz Cimachowski | Web Developer & Photography',
    description: 'Cimach is the portfolio of Mateusz Cimachowski, a web developer creating websites and web applications, with photography among his creative interests.',
    path: '/en/',
    ogLocale: 'en_US',
  },
} as const

const studioBodyArtSeo = {
  pl: {
    title: 'Studio BodyArt - projekt | CIMACH',
    description: 'Strona usługowa Studio BodyArt, przygotowana z naciskiem na responsywność i widoczność w wyszukiwarkach.',
    path: '/pl/projects/studio-bodyart/',
    ogLocale: 'pl_PL',
  },
  en: {
    title: 'Studio BodyArt - project | CIMACH',
    description: 'A Studio BodyArt service website focused on responsive design and search visibility.',
    path: '/en/projects/studio-bodyart/',
    ogLocale: 'en_US',
  },
} as const

const loginSeo = {
  pl: {
    title: 'Logowanie do panelu | CIMACH',
    description: 'Logowanie do panelu administracyjnego CIMACH.',
    path: '/pl/login/',
    ogLocale: 'pl_PL',
  },
  en: {
    title: 'Admin Login | CIMACH',
    description: 'Sign in to the CIMACH administration panel.',
    path: '/en/login/',
    ogLocale: 'en_US',
  },
} as const

const adminSeo = {
  pl: {
    title: 'Panel administracyjny | CIMACH',
    description: 'Panel administracyjny portfolio CIMACH.',
    path: '/pl/admin/',
    ogLocale: 'pl_PL',
  },
  en: {
    title: 'Admin Dashboard | CIMACH',
    description: 'CIMACH portfolio administration panel.',
    path: '/en/admin/',
    ogLocale: 'en_US',
  },
} as const

export type SeoPage = 'home' | 'studioBodyArt' | 'login' | 'admin'

export function getSeo(locale: Locale, page: SeoPage = 'home') {
  const pageSeo = page === 'studioBodyArt'
    ? studioBodyArtSeo
    : page === 'login' ? loginSeo : page === 'admin' ? adminSeo : seo
  const entry = pageSeo[locale]
  const translatedPage = pageSeo
  return {
    ...entry,
    canonical: `https://cimach.eu${entry.path}`,
    alternatePl: `https://cimach.eu${translatedPage.pl.path}`,
    alternateEn: `https://cimach.eu${translatedPage.en.path}`,
  }
}
