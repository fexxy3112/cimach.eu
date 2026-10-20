/**
 * Teksty i linki przepisane z prototypu cimach-portfolio-v2.
 */
import { portfolioEn } from './portfolio-en'

export type PortfolioLocale = 'pl' | 'en'

export type PortfolioProject = {
  number: string
  name: string
  category: string
  description: string
  technologies: string[]
  href: string
  caseStudySlug?: string
}

export const portfolio = {
  owner: 'Mateusz Cimachowski',
  monogram: 'CIMACH',
  location: 'POLAND / 2026',
  availability: {
    label: 'Open to work',
  },
  social: {
    github: 'https://github.com/fexxy3112',
    instagram: 'https://www.instagram.com/_cimach_/',
  },
  hero: {
    metaLabel: 'WEB DEVELOPER',
    kicker: 'Cześć, jestem Mateusz.',
    firstLine: 'Built',
    secondLine: 'for the',
    accent: 'web.',
    description:
      'Strony internetowe, aplikacje i małe eksperymenty. Lubię, kiedy technologia działa dobrze - i wygląda tak, jak powinna.',
  },
  technologyTicker: ['FRONTEND', 'BACKEND', 'PROBLEM SOLVING', 'PHOTOGRAPHY'],
  projectsIntro: {
    note: 'Kod, który rozwiązuje problemy.',
    title: 'Wybrane',
    accent: 'projekty.',
    description:
      'Od samodzielnych realizacji po narzędzia rozwijane w pracy. Każdy projekt to inny problem do rozgryzienia.',
  },
  projects: [
    {
      number: '01',
      name: 'cimach.eu',
      category: 'Personal portfolio / Full-stack',
      description: 'Własna strona z panelem do zarządzania projektami, zdjęciami i treścią.',
      technologies: ['REACT', 'NODE.JS', 'MARIADB'],
      href: 'https://cimach.eu',
    },
    {
      number: '02',
      name: 'Studio BodyArt',
      category: 'Business website',
      description: 'Strona usługowa z naciskiem na responsywność i widoczność w wyszukiwarkach.',
      technologies: ['PHP', 'SCSS', 'JS'],
      href: 'https://michalowice.studio-bodyart.pl',
      caseStudySlug: 'studio-bodyart',
    },
    // {
    //   number: '03',
    //   name: 'Content distribution tool',
    //   category: 'Internal application',
    //   description: 'Narzędzie do zbierania, porządkowania i dystrybucji danych do wielu instalacji WordPressa.',
    //   technologies: ['REACT', 'FASTAPI', 'WORDPRESS API'],
    //   href: '#contact',
    // },
    {
      number: '04',
      name: 'Experiments',
      category: 'GitHub / Side projects',
      description: 'Mniejsze projekty, automatyzacje i pomysły, które sprawdzam w praktyce.',
      technologies: ['REACT', 'JAVASCRIPT'],
      href: 'https://github.com/fexxy3112',
    },
  ] satisfies PortfolioProject[],
  about: {
    note: 'Nie tylko interfejs.',
    titleFirstLine: 'Lubię wiedzieć,',
    titleSecondLine: 'co dzieje się',
    titleAccent: 'pod spodem.',
    paragraphs: [
      'Jestem web developerem i lubię ogarniać cały przepływ - od interfejsu, przez API, aż po bazę danych. Mam doświadczenie z rozwijaniem istniejących aplikacji, integracjami i budowaniem własnych rzeczy od zera.',
      'Po godzinach łapię aparat. Fotografia uczy mnie patrzeć na kompozycję, światło i detale - rzeczy, które przydają się też przy projektowaniu cyfrowych produktów.',
    ],
    skills: ['React', 'JavaScript', 'PHP', 'Node.js', 'SQL', 'WordPress', 'REST API', 'Python', 'SCSS'],
    stats: [
      { value: '</>', label: 'WEB DEVELOPER' },
      { value: '9', suffix: 'mo.', label: 'COMMERCIAL EXPERIENCE' },
      { value: '∞', label: 'THINGS TO LEARN' },
    ],
  },
  photography: {
    note: 'Fotografia / @_cimach_',
    titleFirstLine: 'Inny sposób',
    titleSecondLine: 'patrzenia',
    titleAccent: 'na świat.',
    description:
      'Fotografia to mój drugi kreatywny świat - od ulic i podróży po samoloty i ludzi. Tu liczy się moment, światło i to, czego nie da się zaprogramować.',
    linkLabel: 'Zobacz fotografie',
    href: 'https://www.instagram.com/_cimach_/',
    frameLabel: 'GOLDEN HOUR / FIND THE LIGHT',
    caption: 'Photography is paying attention.',
  },
  contact: {
    note: 'Masz pomysł? Pogadajmy.',
    titleFirstLine: 'Zróbmy coś',
    titleAccent: 'dobrego.',
    description:
      'Szukasz kogoś do projektu, potrzebujesz strony albo chcesz po prostu wymienić się pomysłami?',
    email: 'kontakt@cimach.eu',
  },
} as const

export function getPortfolio(locale: PortfolioLocale) {
  return locale === 'en' ? portfolioEn : portfolio
}
