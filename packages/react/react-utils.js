import { jb, coreUtils, dsls } from '@jb6/core'
export const reactUtils = jb.reactUtils = { h, L, loadLucid05, hh, hhStrongRefresh, wrapReactCompWithSampleData }

jb.reactRepository = {
  comps: {},
  promises: {}
}

const { tgp: { TgpType, Component }} = dsls

const ReactComp = TgpType('react-comp','react')
TgpType('vdom','react')
const ReactMetadata = TgpType('react-metadata','react')
TgpType('tool','mcp')

ReactComp('comp', {
  params: [
    {id: 'hFunc', type: 'vdom', dynamic: true, byName: true},
    {id: 'enrichCtx', dynamic: true, byName: true},
    {id: 'sampleCtxData', dynamic: true, description: '{ data , vars {} }'},
    {id: 'samplePropsData', dynamic: true, description: '{ status: "hello" }'},
    {id: 'assert', type: 'react-assert[]', dynamic: true},
    {id: 'metadata', type: 'react-metadata[]', dynamic: true},
  ],
  impl: (_ctx, {strongRefresh, react: {useState, useEffect} }, { hFunc, enrichCtx }) => {
    const ctx = _ctx.setVars({strongRefresh: false})
    const jbid = ctx.jbCtx.creatorStack?.join(';')
    const id = strongRefresh ? '' : jbid
    const ctxOrPromise = enrichCtx(ctx) || ctx
    const isPromise = coreUtils.isPromise(ctxOrPromise)

    const repo = jb.reactRepository
    if (isPromise) {
      const ctxPromise = (id && repo.promises[id]) || ctxOrPromise
      if (id && !repo.promises[id])
        repo.promises[id] = ctxPromise
      if (!id || !repo.comps[id]) {
        const comp = (args) => {
          const [ctx, setCtx] = useState(null)
          const [loading, setLoading] = useState(true)

          useEffect(() => {
            let mounted = true
            ctxPromise.then(resolvedCtx => {
              if (mounted) {
                setCtx(resolvedCtx)
                setLoading(false)
              }
            })
            return () => { mounted = false }
          }, [])

          if (loading)
            return h('div:flex items-center justify-center h-full w-full', {}, h(L('Loader'), { className: 'animate-spin w-4 h-4' }))
          return h(hFunc(ctx), args)
        }
        if (id && !repo.comps[id])
          repo.comps[id] = comp
        Object.defineProperty(comp, 'name', { value: id })
        comp.jbid = jbid
        return comp
      }
    } else {
      if (!id || !repo.comps[id]) {
        const comp = hFunc(ctxOrPromise)
        comp.jbid = jbid
        if (id && !repo.comps[id])
          repo.comps[id] = comp
        Object.defineProperty(comp, 'name', { value: id })
        return comp
      }
    }
    return id ? repo.comps[id] : null
  }
})

function hh(ctx, t, p = {}, ...c) {
  if (!(ctx instanceof coreUtils.Ctx))
    console.error('hh: first param of hh must be ctx')
  t = t[coreUtils.asJbComp] ? t.$runWithCtx(ctx) : t
  return h(t,p,...c)
}

function hhStrongRefresh(ctx, t, p = {}, ...c) {
  if (!(ctx instanceof coreUtils.Ctx))
    console.error('hhStrongRefresh: first param of hh must be ctx')
  if (t[coreUtils.asJbComp]) {
    const id = 'react:' + t[coreUtils.asJbComp].id
    t = t.$runWithCtx(ctx.setVars({strongRefresh: true}))
    // set wrapper function name to jbComp id - so it shows in the debugger
    const f = id ? ({ [id]: () => h(t,p,...c) })[id] : (() => h(t,p,...c))
    return f()
  }
  return h(t,p,...c)
}

function h(t, p = {}, ...c) {
  let [tag,cls]= typeof t==="string" ? t.split(/:(.+)/) : [t]
  if (tag == 'L') {
    tag = L(cls)
    cls = ''
  }
  if (c && c[0] && Array.isArray(c[0]) && c[0][0]?.key == null)
    c = [...c[0],...c.slice(1)]

  const className=[p.className,cls].filter(Boolean).join(' ').trim()
  let vdom = reactUtils.createElement(tag,className ? {...p,className} : p,...c)
  if (typeof t == 'function' && t.jbid)
    return h('div', { jbid: t.jbid, style: { display: 'contents' } }, vdom)
  return vdom
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

let initReact = () => {}
if (!globalThis.window) {
  initReact = async () => {
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
    const isLocalHost = typeof location !== 'undefined' && location.hostname === 'localhost'
    let ver = isLocalHost ? '19.2.0-dev' : '19.2.0-prod'
    //ver = '19.2.0-prod'

    if (typeof process === 'undefined')
      globalThis.process = { env: { NODE_ENV: 'development' }, platform: 'browser', version: '', versions: {} }
    if (!reactUtils.reactPromise)
      reactUtils.reactPromise = (async () => {
        const { React, ReactDomClient, ReactDom } = await import(`./lib/react-all-${ver}.mjs`)
        Object.assign(reactUtils, { ...React, ...ReactDomClient, ...ReactDom, React, ReactDOM: ReactDomClient  })
      })()
    return reactUtils.reactPromise
  }  
}

Component('containerComp', {
  type: 'react-metadata<react>',
  params: [
    {id: 'containerComp', as: 'string'},
    {id: 'importPath', as: 'string'}
  ]
})


async function wrapReactCompWithSampleData(cmpId, _ctx, args) {
  const ctx = (_ctx || new coreUtils.Ctx()).setVars({react: reactUtils})
  try {
    const fullId = cmpId.indexOf('<') == -1 ? `react-comp<react>${cmpId}` : cmpId
    const comp = coreUtils.compByFullId(fullId, jb)
    const jbComp = comp[coreUtils.asJbComp]
    coreUtils.resolveCompArgs(jbComp)
    const metadata = coreUtils.asArray(jbComp.impl.metadata)
    const containerComp = metadata.find(m => m.containerComp)?.containerComp
    const importPath = metadata.find(m => m.importPath)?.importPath
    if (importPath)
      await import(importPath)
    const compToRun = containerComp && dsls.react['react-comp'][containerComp] || comp

    const ctxData = jbComp.impl.sampleCtxData && await ctx.run(jbComp.impl.sampleCtxData)
    const props = jbComp.impl.samplePropsData && await ctx.run(jbComp.impl.samplePropsData)
    let ctxWithData = ctxData ? ctx.setData(ctxData.data).setVars(ctxData.vars) : ctx
    if (containerComp)
      ctxWithData = ctxWithData.setVars({testedComp: cmpId})

    const reactCmp = args != null ? compToRun.$runWithCtx(ctxWithData,args) : compToRun.$runWithCtx(ctxWithData)
    return { ctx: ctxWithData, reactCmp, props }
  } catch(error) {
    return { ctx, reactCmp: () => reactUtils.h('pre',{},error.stack), props: {} }
  }
}

await (async () => initReact())()
