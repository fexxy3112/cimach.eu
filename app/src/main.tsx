import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import type { PrerenderData } from './data/projectApi'
import './styles/global.scss'

document.documentElement.classList.add('js')

const prerenderDataElement = document.getElementById('cimach-prerender-data')
let initialData: PrerenderData | undefined
if (prerenderDataElement?.textContent) {
  try {
    initialData = JSON.parse(prerenderDataElement.textContent) as PrerenderData
  } catch {
    initialData = undefined
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App initialData={initialData} />
  </React.StrictMode>,
)
