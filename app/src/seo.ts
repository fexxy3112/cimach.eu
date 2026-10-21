import type { Locale } from './i18n/LocaleContext'
import type { PublicProject } from './data/projectApi'

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

export type SeoPage = 'home' | 'projects' | 'project' | 'login' | 'admin'

export function getSeo(
  locale: Locale,
  page: SeoPage = 'home',
  project?: PublicProject,
  projectSlug?: string,
  projectLocales?: Locale[],
) {
  if (page === 'projects') {
    return {
      title: locale === 'pl' ? 'Wszystkie projekty | CIMACH' : 'All projects | CIMACH',
      description: locale === 'pl' ? 'Projekty Mateusza Cimachowskiego - strony internetowe i aplikacje webowe.' : 'Projects by Mateusz Cimachowski - websites and web applications.',
      path: `/${locale}/projects/`,
      ogLocale: seo[locale].ogLocale,
      canonical: `https://cimach.eu/${locale}/projects/`,
      alternatePl: 'https://cimach.eu/pl/projects/',
      alternateEn: 'https://cimach.eu/en/projects/',
      xDefault: 'https://cimach.eu/pl/projects/',
    }
  }
  if (page === 'project') {
    const slug = projectSlug || ''
    const path = `/${locale}/projects/${slug}/`
    const fallback = seo[locale]
    const availableLocales = projectLocales || [locale]
    return {
      title: project?.seoTitle || (project
        ? `${project.name} - ${locale === 'pl' ? 'projekt' : 'project'} | CIMACH`
        : fallback.title),
      description: project?.seoDescription || project?.description || fallback.description,
      path,
      ogLocale: fallback.ogLocale,
      canonical: `https://cimach.eu${path}`,
      alternatePl: availableLocales.includes('pl') ? `https://cimach.eu/pl/projects/${slug}/` : null,
      alternateEn: availableLocales.includes('en') ? `https://cimach.eu/en/projects/${slug}/` : null,
      xDefault: availableLocales.includes('pl') ? `https://cimach.eu/pl/projects/${slug}/` : null,
    }
  }
  const pageSeo = page === 'login' ? loginSeo : page === 'admin' ? adminSeo : seo
  const fallback = pageSeo[locale]
  const translatedPage = pageSeo
  const entry = fallback
  return {
    ...entry,
    canonical: `https://cimach.eu${entry.path}`,
    alternatePl: `https://cimach.eu${translatedPage.pl.path}`,
    alternateEn: `https://cimach.eu${translatedPage.en.path}`,
    xDefault: `https://cimach.eu${translatedPage.pl.path}`,
  }
}
