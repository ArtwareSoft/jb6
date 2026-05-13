import { jb, coreUtils, dsls } from '@jb6/core'
import { reactUtils } from './react-utils.js'

const { tgp: { Component } } = dsls
const { h, hh, L } = reactUtils

// progress-indicator<react> built-ins. RT: (ctx) => () => vdom
// Mounted only during the enrichCtx wait of react-comp.comp. Unmounted on resolve.

Component('spinner', {
  type: 'progress-indicator<react>',
  description: 'classic Lucide loader spinning. No events.',
  impl: ctx => () => {
    const {react: {useEffect}, uiLogger} = ctx.vars
    useEffect(() => { uiLogger?.info?.({t: 'progress.mount', indicator: 'spinner'}, {}, {ctx}) }, [])
    return h('div:flex items-center justify-center h-full w-full', {},
      h(L('Loader'), { className: 'animate-spin w-4 h-4' }))
  }
})

Component('dots', {
  type: 'progress-indicator<react>',
  description: 'time-based animated dots, no events required',
  params: [
    {id: 'title', as: 'string', defaultValue: 'Loading'},
    {id: 'dotsPerSec', as: 'number', defaultValue: 2}
  ],
  impl: (ctx, {react: {useState, useEffect}, uiLogger}, {title, dotsPerSec}) => () => {
    const [n, setN] = useState(0)
    useEffect(() => {
      uiLogger?.info?.({t: 'progress.mount', indicator: 'dots', title}, {}, {ctx})
      const id = setInterval(() => setN(x => (x+1) % 4), 1000 / (dotsPerSec || 2))
      return () => clearInterval(id)
    }, [])
    return h('div', {}, title + '.'.repeat(n))
  }
})

const byProgress = Component('byProgress', {
  type: 'progress-indicator<react>',
  description: 'subscribes to coreUtils.eventEmitter and shows progress events',
  params: [
    {id: 'title', as: 'string', defaultValue: 'Loading'},
    {id: 'hFunc', type: 'progress-hfunc<react>', dynamic: true, byName: true, defaultValue: {$: 'progress-hfunc<react>text'}},
    {id: 'filter', dynamic: true, byName: true, defaultValue: true, description: '(progressEvent) => boolean; default: accept all'},
  ],
  impl: (ctx, {react: {useState, useEffect}, uiLogger}, {title, filter, hFunc: hFuncF}) => () => {
    const hFunc = hFuncF(ctx)
    const [progressEvent, setEvent] = useState(null)
    useEffect(() => {
      uiLogger?.info?.({t: 'progress.mount', indicator: 'byProgress', title}, {}, {ctx})
      const fn = e => {
        if (filter && !filter(ctx.setVars({progressEvent: e}))) return
        uiLogger?.info?.({t: 'progress.event', indicator: 'byProgress', event: e}, {}, {ctx})
        setEvent(e)
      }
      coreUtils.eventEmitter.on('progress', fn)
      return () => coreUtils.eventEmitter.off('progress', fn)
    }, [])
    if (progressEvent == null) return h('div', {}, title)
    return hh(ctx, hFunc, {progressEvent})
  }
})

// byStatus is byProgress with a built-in status filter
Component('byStatus', {
  type: 'progress-indicator<react>',
  description: 'byProgress filtered to status-flagged events',
  params: [
    {id: 'title', as: 'string', defaultValue: 'Loading'},
    {id: 'hFunc', type: 'progress-hfunc<react>', dynamic: true, byName: true, defaultValue: {$: 'progress-hfunc<react>text'}}
  ],
  impl: byProgress({
    title: '%$title%',
    filter: '%$progressEvent.status%',
    hFunc: '%$hFunc()%'
  })
})

// progress-hfunc<react> renderers. RT: (ctx) => ({progressEvent}) => vdom

Component('text', {
  type: 'progress-hfunc<react>',
  description: 'renders progressEvent.t',
  impl: ({}, {react: {h}}) => ({progressEvent}) => h('div', {}, progressEvent?.t ?? '')
})

Component('textWithPct', {
  type: 'progress-hfunc<react>',
  description: 'renders "t — pct%"',
  impl: ({}, {react: {h}}) => ({progressEvent}) =>
    h('div', {}, `${progressEvent?.t ?? ''} — ${progressEvent?.pct ?? 0}%`)
})

Component('progressBar', {
  type: 'progress-hfunc<react>',
  description: 'horizontal bar reading progressEvent.pct',
  impl: ({}, {react: {h}}) => ({progressEvent}) =>
    h('div:bg-gray-200 h-2 w-full', {},
      h('div:bg-blue-500 h-2', {style: {width: `${progressEvent?.pct ?? 0}%`}}))
})
