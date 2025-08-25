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
  return reactUtils.createElement(tag,className ? {...p,className} : p,...c)
}

const toPascal = s => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')
function L(iconName) {
  const icon = icons[toPascal(iconName)] || icons.ShieldQuestion
  return function LucideIcon(props) {
    const { size, width, height, color, stroke, strokeWidth, ...restProps } = props
    return reactUtils.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg', width: width || size || '24', height: height || size || '24', viewBox: '0 0 24 24', fill: 'none',
        stroke: stroke || color || 'currentColor', strokeWidth: strokeWidth || '2', strokeLinecap: 'round', strokeLinejoin: 'round', ...restProps },
      icon.map((item, index) => reactUtils.createElement(item[0],{ key: index, ...item[1]}))
    )
  }
}

let initReact = () => {}
if (coreUtils.isNode) {
  initReact = async () => { // node mean include tests
    globalThis.requestAnimationFrame = cb => setTimeout(cb, 0)
    globalThis.cancelAnimationFrame  = id => clearTimeout(id)
    globalThis.nodeTesting = true
    const [React,ReactDomClient,ReactDom] =
      await Promise.all([import('react'), import('react-dom/client'), import('react-dom')].map(x=>x.default || x))
  
    Object.assign(reactUtils, { ...React, ...ReactDomClient, ...ReactDom, React, ReactDOM: ReactDomClient })

    globalThis.localStorage = {
      db: {},
      getItem(k)    { return this.db[k] },
      setItem(k,v)  { this.db[k] = v },
      removeItem(k) { delete this.db[k] }
    }
  }

  jb.reactUtils.initDom = async ({url = 'http://localhost', html = '<!DOCTYPE html><body style="height:100vh"></body>' } = {}) => {
    const { JSDOM } = await import('jsdom')
    const dom = new JSDOM(html, { url, pretendToBeVisual: true, resources: 'usable', features: { ProcessExternalResources: false } })
    const win = globalThis.window = dom.window
    win.matchMedia = () => ({})
    win.scrollTo     = () => {}
    await import('mutationobserver-shim')
    win.Element.prototype.scrollTo = () => {}
    win.Element.prototype.scrollIntoView = () => {}

// Also mock scrollIntoView if needed
    ;['Image','Node','Element','HTMLElement','Document','MutationObserver','document'].forEach(k => globalThis[k] = win[k])
    ;['navigator','location'].forEach(k => Object.defineProperty(globalThis, k, { value: win[k], writable: true, configurable: true, enumerable: true }))
    reactUtils.registerMutObs(win)
    return win
  }
} else { // browser
  initReact = async () => {
    const isLocalHost = typeof location !== 'undefined' && location.hostname === 'localhost'
    const devOrProd = isLocalHost ? '?dev' : ''

    if (typeof process === 'undefined')
      globalThis.process = { env: { NODE_ENV: 'development' }, platform: 'browser', version: '', versions: {} }
    if (!reactUtils.reactPromise)
      reactUtils.reactPromise = (async () => {
        const [_,React, ReactDomClient, ReactDom] = await Promise.all([
          import(`/jb6_packages/react/lib/tailwind-4.js`),
          import(`https://esm.sh/react@19${devOrProd}`),
          import(`https://esm.sh/react-dom@19/client${devOrProd}`),
          import(`https://esm.sh/react-dom@19${devOrProd}`)
        ].map(x=>x.default || x))
        const TestingLib = {}
        Object.assign(reactUtils, { ...React, ...ReactDomClient, ...ReactDom, ...TestingLib, React, ReactDOM: ReactDomClient  })
      })()
    return reactUtils.reactPromise
  }
  
  jb.reactUtils.initDom = async () => {
    const win = window    
    win.testing = true
    reactUtils.registerMutObs(win)
    return win
  }
}

await (async () => initReact())()

if (coreUtils.isNode) {
  const cli = Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>a.slice(2).split('=')))
  globalThis.runNodeTests = () => {
    cli.test && delay(1).then(() =>  // let the other modules finish their loading
        runTests({
          specificTest: cli.test,
          notPattern:   cli.not,
          pattern:      cli.pattern,
          take:         cli.take
        })
      )
  }
}
