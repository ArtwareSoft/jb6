import { jb, coreUtils } from '@jb6/core'
import { icons } from './lib/lucide-04.js'
export const reactUtils = jb.reactUtils = { h, L }

function h(t, p = {}, ...c){
  let [tag,cls]= typeof t==="string" ? t.split(/:(.+)/) : [t]
  if (tag == 'L') {
    tag = L(cls)
    cls = ''
  }
  if (c && c[0] && Array.isArray(c[0]) && c[0][0]?.key == null)
    c = [...c[0],...c.slice(1)]

  const className=[p.className,cls].filter(Boolean).join(' ').trim()
  return React.createElement(tag,className ? {...p,className} : p,...c)
}

const toPascal = s => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')
function L(iconName) {
  const icon = icons[toPascal(iconName)] || icons.ShieldQuestion
  return function LucideIcon(props) {
    const { size, width, height, color, stroke, strokeWidth, ...restProps } = props
    return React.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg', width: width || size || '24', height: height || size || '24', viewBox: '0 0 24 24', fill: 'none',
        stroke: stroke || color || 'currentColor', strokeWidth: strokeWidth || '2', strokeLinecap: 'round', strokeLinejoin: 'round', ...restProps },
      icon.map((item, index) => React.createElement(item[0],{ key: index, ...item[1]}))
    )
  }
}

let reactPromise, initReact, cleanDom = () => {}
if (coreUtils.isNode) {
  initReact = async () => {
    globalThis.requestAnimationFrame = cb => setTimeout(cb, 0)
    globalThis.cancelAnimationFrame  = id => clearTimeout(id)
    globalThis.nodeTesting = true
    const React    = (await import('react')).default
    const ReactDOM = (await import('react-dom/client')).default
    const { flushSync } = await import('react-dom')
    const { Simulate }  = await import('react-dom/test-utils')
    globalThis.React    = React
    globalThis.ReactDOM = ReactDOM
    globalThis.flushSync= flushSync
    globalThis.Simulate = Simulate
    globalThis.location = { hostname : 'localhost' }

    const { useState, useEffect, useRef, useContext } = React
    Object.assign(reactUtils, { useState, useEffect, useRef, useContext, ReactDOM })

    const origFetch = globalThis.fetch
    globalThis.fetch = async (url, opts) => {
      return origFetch(full, opts)
    }

    globalThis.localStorage = {
      db: {},
      getItem(k)    { return this.db[k] },
      setItem(k,v)  { this.db[k] = v },
      removeItem(k) { delete this.db[k] }
    }
    //_reactLoaded()
  }

  jb.reactUtils.initDom = async () => {
    const [{ JSDOM }] = await Promise.all([import('jsdom')])
    const dom = new JSDOM(
      `<!DOCTYPE html><body style="height:100vh"></body>`,
      {
        url: 'http://localhost:8083/packages/testing/tests.html',
        pretendToBeVisual: true,
        resources: 'usable',
        features: { ProcessExternalResources: false }
      }
    )
    const win = globalThis.window = dom.window
    win.matchMedia = () => ({})
    win.scrollTo     = () => {}
    await import('mutationobserver-shim')
    ;['Image','Node','Element','HTMLElement','Document','MutationObserver','document','navigator1','location'].forEach(k => globalThis[k] = dom.window[k])
    reactUtils.registerMutObs(win)
    return win
  }
} else { // browser
  initReact = async () => {
    function waitForReact() {
      if (globalThis.React && globalThis.ReactDOM) return Promise.resolve(globalThis.React)
      if (!reactPromise) {
        const urls = [ // todo - use /jb_reactlib prefix to allow working on browsers on other repos with @jb6 in node_modules
          '/packages/react/lib/react.development.js',
          '/packages/react/lib/react-dom.development.js'
        ]
        reactPromise = Promise.all([import('/packages/react/lib/tailwind-4.js'),
          ...urls.map(src => new Promise((resolve, reject) => {
            let s = document.head.querySelector(`script[src="${src}"]`)
            if (s) return resolve()
            s = document.createElement('script')
            s.src = src
            s.onload = resolve
            s.onerror = (e) => reject(new Error(`Failed to load ${src}: ${e.message}`))
            document.head.appendChild(s)
        }))]).then(() => React)
      }
      return reactPromise
    }
    return waitForReact().then(React => {
      const { useState, useEffect, useRef, useContext } = React
      Object.assign(reactUtils, { useState, useEffect, useRef, useContext, ReactDOM: globalThis.ReactDOM })
    })
  }

  jb.reactUtils.initDom = async () => {
    const win = window
    await new Promise(resolve => {
      const s = win.document.createElement('script')
      s.src   = '/packages/react/lib/react-dom-test-utils.development.js'
      s.onload = resolve
      win.document.head.appendChild(s)
    })
    
    win.testing = true
    reactUtils.registerMutObs(win)
    globalThis.flushSync = win.ReactDOM.flushSync
    globalThis.Simulate = win.ReactTestUtils.Simulate
    return win
  }
  cleanDom = () => {
    document.getElementById('test-simulation')?.remove()
  }
}

await initReact()