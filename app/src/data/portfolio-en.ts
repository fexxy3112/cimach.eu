import type { PortfolioProject } from './portfolio'

export const portfolioEn = {
  owner: 'Mateusz Cimachowski',
  monogram: 'CIMACH',
  location: 'POLAND / 2026',
  availability: { label: 'Open to work' },
  social: {
    github: 'https://github.com/fexxy3112',
    instagram: 'https://www.instagram.com/_cimach_/',
  },
  hero: {
    metaLabel: 'WEB DEVELOPER',
    kicker: "Hi, I'm Mateusz.",
    firstLine: 'Built',
    secondLine: 'for the',
    accent: 'web.',
    description:
      'Websites, applications and small experiments. I like technology that works well and looks the way it should.',
  },
  technologyTicker: ['FRONTEND', 'BACKEND', 'CREATIVE CODE', 'PHOTOGRAPHY'],
  projectsIntro: {
    note: 'Code that solves problems.',
    title: 'Selected',
    accent: 'projects.',
    description:
      'From independent work to tools developed at work. Each project is a different problem to figure out.',
  },
  projects: [
    {
      number: '01',
      name: 'cimach.eu',
      category: 'Personal portfolio / Full-stack',
      description: 'A personal website with a panel for managing projects, photos and content.',
      technologies: ['REACT', 'NODE.JS', 'MARIADB'],
      href: 'https://cimach.eu',
    },
    {
      number: '02',
      name: 'Studio BodyArt',
      category: 'Business website',
      description: 'A service website focused on responsive design and search visibility.',
      technologies: ['PHP', 'SCSS', 'JS'],
      href: 'https://michalowice.studio-bodyart.pl',
      caseStudySlug: 'studio-bodyart',
    },
    {
      number: '04',
      name: 'Experiments',
      category: 'GitHub / Side projects',
      description: 'Small projects, automations and ideas I put into practice.',
      technologies: ['REACT', 'JAVASCRIPT'],
      href: 'https://github.com/fexxy3112',
    },
  ] satisfies PortfolioProject[],
  about: {
    note: 'Beyond the interface.',
    titleFirstLine: 'I like to know',
    titleSecondLine: "what's going on",
    titleAccent: 'under the hood.',
    paragraphs: [
      'I am a web developer who enjoys working across the whole stack - from the interface and APIs to the database. I have experience extending existing applications, building integrations and creating things from scratch.',
      'Outside work, I pick up my camera. Photography teaches me to notice composition, light and detail - things that also matter when designing digital products.',
    ],
    skills: ['React', 'JavaScript', 'PHP', 'Node.js', 'SQL', 'WordPress', 'REST API', 'Python', 'SCSS'],
    stats: [
      { value: '</>', label: 'WEB DEVELOPER' },
      { value: '9', suffix: 'mo.', label: 'COMMERCIAL EXPERIENCE' },
      { value: '∞', label: 'THINGS TO LEARN' },
    ],
  },
  photography: {
    note: 'Photography / @_cimach_',
    titleFirstLine: 'A different way',
    titleSecondLine: 'of looking',
    titleAccent: 'at the world.',
    description:
      "Photography is my other creative world - from streets and travel to planes and people. It's about the moment, the light and what can't be programmed.",
    linkLabel: 'View photographs',
    href: 'https://www.instagram.com/_cimach_/',
    frameLabel: 'GOLDEN HOUR / FIND THE LIGHT',
    caption: 'Photography is paying attention.',
  },
  contact: {
    note: "Let's start with a conversation.",
    titleFirstLine: 'Have an idea?',
    titleAccent: "Let's build it.",
    description:
      "Need a website, want to grow your project, or have an idea worth bringing to life? Write to me - let's talk.",
    email: 'kontakt@cimach.eu',
  },
} as const
