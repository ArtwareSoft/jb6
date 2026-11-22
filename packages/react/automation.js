import { dsls, coreUtils } from '@jb6/core'
import { reactUtils } from './react-utils.js'

const { delay, logException } = coreUtils
const { tgp: { TgpType } } = dsls
const UiAction = TgpType('ui-action', 'react', {
  typescript: '{ exec: (ctx) => void | Promise<void> }',
  coerce: uiActions => Array.isArray(uiActions) ? dsls.react['ui-action'].actions(...uiActions) : uiActions
})
Object.assign(reactUtils, {installMutationObserver, startAutomation})

UiAction('actions', {
  params: [ 
    {id: 'uiActions', type: 'ui-action<react>[]', composite: true}
  ],
  impl: ({}, {}, {uiActions}) => ({
    async exec(ctx) {
      for (const action of uiActions) await action.exec(ctx)
    }
  })
})

UiAction('waitForMutations', {
  params: [ { id:'timeout', as:'number' } ],
  impl: ({}, {}, {timeout}) => ({ exec: ctx => ctx.vars.win.waitForMutations(timeout) })
})

UiAction('delay', {
  params: [ { id:'ms', as:'number', defaultValue: 1000 } ],
  impl: ({}, {}, {ms}) => ({ exec: () => delay(ms) })
})

UiAction('waitForSelector', {
  params: [
    { id: 'selector', as: 'string' },
    { id: 'timeout', as: 'number', defaultValue: 2000 }
  ],
  impl: ({}, {}, {selector, timeout}) => ({exec: ctx => waitFor(ctx, selector, timeout, () => ctx.vars.win.document.querySelector(selector))})
})

UiAction('waitForText', {
  params: [
    { id: 'text', as: 'string' },
    { id: 'timeout', as: 'number', defaultValue: 8000 }
  ],
  impl: ({}, {}, {text, timeout}) => ({exec: ctx => waitFor(ctx, text, timeout, () => ctx.vars.win.document.body.outerHTML.includes(text))})
})

UiAction('click', {
  params: [{id: 'buttonText', as: 'string'}],
  impl: ({}, {}, {buttonText}) => ({exec: ({vars: {win}}) =>
    clickable(win, buttonText)?.dispatchEvent(new win.MouseEvent('click', {bubbles: true, cancelable: true}))})
})

UiAction('enterText', {
  description: 'type into an input/textarea, found by placeholder, name, aria-label or id',
  params: [
    { id: 'text', as: 'string' },
    { id: 'intoField', as: 'string' }
  ],
  impl: ({}, {}, {text, intoField}) => ({exec: ({vars: {win}}) => {
    const element = textInput(win, intoField)
    if (!element) return
    const prototype = element.tagName == 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, text)   // react tracks the dom value, a plain assignment is swallowed
    element.dispatchEvent(new win.Event('input', {bubbles: true}))
  }})
})

UiAction('pickOption', {
  description: 'choose an option in a select, found by name, aria-label or id',
  params: [
    { id: 'option', as: 'string' },
    { id: 'intoField', as: 'string' }
  ],
  impl: ({}, {}, {option, intoField}) => ({exec: ({vars: {win}}) => {
    const element = [...win.document.querySelectorAll('select')]
      .find(select => !intoField || [select.name, select.getAttribute('aria-label'), select.id].includes(intoField))
    if (!element) return
    Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value').set.call(element, option)
    element.dispatchEvent(new win.Event('change', {bubbles: true}))
  }})
})

UiAction('longPress', {
  params: [
    { id: 'buttonText', as: 'string' },
    { id: 'timeToPress', as: 'number', defaultValue: 350, byName: true },
  ],
  impl: ({}, {}, {buttonText, timeToPress}) => ({exec: async ({vars: {win}}) => {
    const element = clickable(win, buttonText)
    const mouse = (type, buttons) => new win.MouseEvent(type, {bubbles: true, cancelable: true, button: 0, buttons, view: win})
    element?.dispatchEvent(mouse('mousedown', 1))
    await delay(timeToPress)
    element?.dispatchEvent(mouse('mouseup', 0))
  }})
})

async function startAutomation(ctx, win, limit = 10000) {
  const params = new URLSearchParams(win.location.search)
  const automation = params.get('automation')
  limit = +params.get('automationTimeout') || limit
  const state = win.jbAutomation = { ready: true, done: false }
  try {
    ctx.vars.uiLogger?.info?.({t: 'automation start', automation: automation?.slice(0, 200), limit}, {}, {ctx})
    if (automation) {
      installMutationObserver(win)
      const profile = JSON.parse(automation)
      coreUtils.restoreProfile$(profile)
      const action = await ctx.run(profile)
      await win.waitForMutations(10)
      const timedOut = await Promise.race([Promise.resolve(action.exec(ctx.setVars({win}))).then(() => false), delay(limit).then(() => true)])
      if (timedOut) throw new Error(`automation timeout ${limit}mSec`)
    }
  } catch (error) {
    logException(error, 'startAutomation', {ctx})
    state.error = error.stack || String(error)
  }
  return Object.assign(state, {done: true, logs: coreUtils.harvestLogs({vars: win.jbLoggers || ctx.vars})})
}

function installMutationObserver(win) {
  let quietTimer, pending
  new win.MutationObserver(() => {
    clearTimeout(quietTimer)
    quietTimer = setTimeout(() => (pending?.(), pending = null), 50)
  }).observe(win.document.body, {childList: true, subtree: true, attributes: true, characterData: true})
  win.waitForMutations = (timeout = 500) => new Promise(resolve => {
    pending = resolve
    setTimeout(() => (pending == resolve && (pending = null), resolve()), timeout)
  })
}

function waitFor(ctx, subject, timeout, check) {
  const {win, uiLogger} = ctx.vars, started = Date.now()
  return new Promise(resolve => {
    const observer = new win.MutationObserver(checkNow)
    const timer = setTimeout(() => finish(false), timeout)
    observer.observe(win.document, {childList: true, subtree: true, characterData: true})
    checkNow()
    function checkNow() { if (check()) finish(true) }
    function finish(found) {
      observer.disconnect()
      clearTimeout(timer)
      uiLogger?.info?.({t: 'automation wait', subject, found, ms: Date.now() - started}, {}, {ctx})
      resolve()
    }
  })
}

function textInput(win, field) {
  const elements = [...win.document.querySelectorAll('input, textarea')]
  return field ? elements.find(element => [element.placeholder, element.name, element.getAttribute('aria-label'), element.id].includes(field)) : elements[0]
}

function clickable(win, text) {
  const elements = [...win.document.querySelectorAll('button, .cursor-pointer')]
  return text ? elements.find(element => element.outerHTML.includes(text)) : elements[0]
}
