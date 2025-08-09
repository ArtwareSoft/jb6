import { dsls, ns, coreUtils, jb } from '@jb6/core'
import { reactUtils } from '@jb6/react' 
import '@jb6/testing'
const { asArray } = coreUtils

Object.assign(jb.reactUtils, {registerMutObs})
const { createRoot, initDom } = reactUtils
const { 
  tgp: { TgpType },
  test: { Test, 
    test: { dataTest }
  }, 
  common: { Data }
} = dsls

const UIAction = TgpType('ui-action', 'test', { modifierId: 'UIAction' })

Test('reactTest', {
    params: [
      {id: 'reactComp', type: 'react-comp<react>', dynamic: true },
      {id: 'expectedResult', type: 'boolean', dynamic: true},
      {id: 'userActions', type: 'ui-action[]'}
    ],
    impl: dataTest({
        calculate: async (ctx,{singleTest},{reactComp,userActions}) => { 
          const win = await initDom()
          const testSimulation = win.document.createElement('div')
          testSimulation.id = 'test-simulation'
          const hasActions = asArray(userActions).length > 0
          if (singleTest || hasActions)
              win.document.body.appendChild(testSimulation)
          createRoot(testSimulation).render(reactComp())

          await win.waitForMutations()
          const ctxA = ctx.setVars({ win })
          for (const a of asArray(userActions)) await a.exec(ctxA)
          const res = prettyPrintNode(win.document.getElementById('test-simulation'))
          if (!singleTest)
            testSimulation.remove()
          return res
        },
        expectedResult: '%$expectedResult()%',
        timeout: 2000,
        includeTestRes: true
    })
})

function registerMutObs(win) {
  win.groupCounter = 0
  win.mutationGroups = []
  let batch = [], startRel = null, timer = null, nextGroupResolver = null
  const t0 = Date.now()
  const observer = new win.MutationObserver(muts => {
    const now = Date.now(), rel = now - t0
    if (startRel == null) startRel = rel
    muts.forEach(m => {
      batch.push({
        timestamp: rel,
        type: m.type,
        target: m.target.nodeName,
        path: getPathFromRoot(m.target),
        attributeName: m.attributeName,
        oldValue: m.oldValue,
        added: [...m.addedNodes].map(nodeToJSON),
        removed: [...m.removedNodes].map(nodeToJSON)
      })
    })
    clearTimeout(timer)
    timer = setTimeout(() => {
      const endRel = Date.now() - t0
      const sec = new Date(t0 + endRel).getSeconds()
      const group = { time: `${startRel}-${endRel}:${sec}`, mutations: batch }
      win.mutationGroups.push(group)
      win.groupCounter++
      batch = []
      startRel = null
      if (nextGroupResolver) nextGroupResolver(group)
      nextGroupResolver = null
    }, 50)
  })
  
  observer.observe(win.document.body, { childList: true, subtree: true, attributes: true, characterData: true })

  win.waitForMutations = (timeout = 500) => new Promise(resolve => {
    let timer
    const resolver = group => {
      clearTimeout(timer)
      nextGroupResolver = null
      resolve(group)
    }
    nextGroupResolver = resolver
    timer = setTimeout(() => {
      if (nextGroupResolver === resolver) {
        nextGroupResolver = null
        resolve('timeout')
      }
    }, timeout)
  })
}

function nodeToJSON(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: 'text', text: node.textContent }
  }
  return {
    type: node.nodeName,
    attributes: Object.fromEntries(
      Array.from(node.attributes || []).map(a => [a.name, a.value])
    ),
    innerHTML: node.innerHTML
  }
}

function getPathFromRoot(node) {
  const path = []
  let el = node
  while (el && el.id !== 'root') {
    const parent = el.parentNode
    if (!parent || !parent.children) break
    const idx = Array.prototype.indexOf.call(parent.children, el) + 1
    path.unshift(`${el.tagName.toLowerCase()}:nth-child(${idx})`)
    el = parent
  }
  if (el && el.id === 'root') path.unshift('#root')
  return path.join(' > ')
} 

function prettyPrintNode(node, indent = 0) {
  if (!node) return ''
  const pad = ' '.repeat(indent)
  let out = ''

  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const txt = child.textContent.trim()
      if (txt) out += pad + txt + '\n'
    }
    else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase()
      const attrs = [...child.attributes].map(a => ` ${a.name}="${a.value}"`).join('')
      const children = Array.from(child.childNodes).filter(n => n.nodeType !== Node.TEXT_NODE || n.textContent.trim().length > 0)

      if (children.length === 0) {
        out += pad + `<${tag}${attrs}></${tag}>\n`
      } else if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
        const text = children[0].textContent.trim()
        out += pad + `<${tag}${attrs}>${text}</${tag}>\n`
      } else {
        out += pad + `<${tag}${attrs}>\n`
        out += prettyPrintNode(child, indent + 2)
        out += pad + `</${tag}>\n`
      }
    }
  })
  return out.replace(/\n+$/, '\n')
}

