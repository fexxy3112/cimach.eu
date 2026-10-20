import { createContext, useContext } from 'react'

export type Locale = 'pl' | 'en'

export const LocaleContext = createContext<Locale>('pl')

export function useLocale() {
  return useContext(LocaleContext)
}
