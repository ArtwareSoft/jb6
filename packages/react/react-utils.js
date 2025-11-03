import { jb, coreUtils } from '@jb6/core'
export const reactUtils = jb.reactUtils = { h, L, loadLucid05 }

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
const unknow = [["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]]
function L(iconName) {
  const icon = jb.reactUtils.icons && jb.reactUtils.icons[toPascal(iconName)] || unknow
  return function LucideIcon(props) {
    const { size, width, height, color, stroke, strokeWidth, ...restProps } = props
    return reactUtils.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg', width: width || size || '24', height: height || size || '24', viewBox: '0 0 24 24', fill: 'none',
        stroke: stroke || color || 'currentColor', strokeWidth: strokeWidth || '2', strokeLinecap: 'round', strokeLinejoin: 'round', ...restProps },
      icon.map((item, index) => reactUtils.createElement(item[0],{ key: index, ...item[1]}))
    )
  }
}

async function loadLucid05() {
  return jb.reactUtils.icons = await import('./lib/lucide-0.5.mjs')
}

console.log('react-utils')

let initReact = () => {}
if (!globalThis.window) {
  initReact = async () => {
    console.log('initReact node')
    const cli = Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>a.slice(2).split('=')))
    const url = globalThis.builtIn?.window?.url || cli.url || 'http://localhost'
    const html = globalThis.html || '<!DOCTYPE html><body></body>'
    const JSDOM = globalThis.builtIn?.JSDOM?.JSDOM || (await import('jsdom')).JSDOM
    const dom = new JSDOM(html, { url, pretendToBeVisual: true, resources: 'usable', features: { ProcessExternalResources: false } })
    const win = globalThis.window = dom.window
    const isLocalHost = win.location.hostname === 'localhost'

    await import('./lib/mutationobserver.min.js')

    win.matchMedia = () => ({})
    win.scrollTo     = () => {}
    win.Element.prototype.scrollTo = () => {}
    win.Element.prototype.scrollIntoView = () => {}
    globalThis.requestAnimationFrame = cb => setTimeout(cb, 0)
    globalThis.cancelAnimationFrame  = id => clearTimeout(id)
    globalThis.nodeTesting = true

    globalThis.localStorage = {
      db: {},
      getItem(k)    { return this.db[k] },
      setItem(k,v)  { this.db[k] = v },
      removeItem(k) { delete this.db[k] }
    }

// Also mock scrollIntoView if needed
    ;['Image','Node','Element','HTMLElement','Document','MutationObserver','document'].forEach(k => globalThis[k] = win[k])
    ;['navigator','location'].forEach(k => Object.defineProperty(globalThis, k, { value: win[k], writable: true, configurable: true, enumerable: true }))
    const ver = isLocalHost ? '19.2.0-dev' : '19.2.0-prod'
    const {React,ReactDomClient,ReactDom} = await import(`./lib/react-all-${ver}.mjs`)
    Object.assign(reactUtils, { ...React, ...ReactDomClient, ...ReactDom, React, ReactDOM: ReactDomClient })
  }
} else { // browser
  initReact = async () => {
    console.log('initReact browser')
    const isLocalHost = false // typeof location !== 'undefined' && location.hostname === 'localhost'
    const ver = isLocalHost ? '19.2.0-dev' : '19.2.0-prod'

    if (typeof process === 'undefined')
      globalThis.process = { env: { NODE_ENV: 'development' }, platform: 'browser', version: '', versions: {} }
    if (!reactUtils.reactPromise)
      reactUtils.reactPromise = (async () => {
        const { React, ReactDomClient, ReactDom } = await import(`./lib/react-all-${ver}.mjs`)
        await import('./lib/tailwindcss.js')
        Object.assign(reactUtils, { ...React, ...ReactDomClient, ...ReactDom, React, ReactDOM: ReactDomClient  })
      })()
    return reactUtils.reactPromise
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
