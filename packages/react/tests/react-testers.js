import { dsls, ns, coreUtils } from '@jb6/core'
import { h, L, useState, useEffect, useRef, useContext, reactUtils, waitForReact } from '@jb6/react' 
import '@jb6/testing'
const { asArray } = coreUtils

const { 
  tgp: { TgpType },
  test: { Test, 
    test: { dataTest }
  }, 
  common: { Data }
} = dsls

const UIAction = TgpType('ui-action', 'test', { modifierId: 'UIAction' })

Test('reactInBrowserTest', {
    params: [
      {id: 'reactComp', dynamic: true },
      {id: 'userActions', type: 'ui-action[]'},
      {id: 'expectedResult', type: 'boolean', dynamic: true},
    ],
    impl: dataTest({
        calculate: async (ctx,{},{reactComp,userActions}) => { 
            await waitForReact()
            const testSimulation = document.createElement('div')
            testSimulation.id = 'test-simulation'
            const hasActions = asArray(userActions).length > 0
            //testSimulation.style.display = 'none'
            hasActions && document.body.appendChild(testSimulation)
   
            ReactDOM.createRoot(testSimulation).render(reactComp())
            await waitForFrameStable()
            for (const action of asArray(userActions))
              await action.exec(ctx)
            await waitForFrameStable()
            const htmlContent = prettyPrint(testSimulation)
            hasActions && testSimulation.remove()
            return htmlContent
        },
        expectedResult: '%$expectedResult()%',
        timeout: 2000,
        includeTestRes: true
      })
})


async function waitForFrameStable(win = window, debounceTime = 0) {
  if (win.document.readyState !== 'complete') {
    await new Promise(resolve => win.addEventListener('load', resolve, { once: true }) )
  }
  
  await new Promise(resolve => {
    let silenceTimer
    const observer = new win.MutationObserver(() => {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        observer.disconnect()
        resolve()
      }, debounceTime)
    })

    observer.observe(win.document.body, { childList: true, subtree: true, attributes: true, characterData: true })
    silenceTimer = setTimeout(() => {
      observer.disconnect()
      resolve()
    }, debounceTime)
  })
}

function prettyPrint(node, indent = 0) {
  if (!node) return ''
  let out = ''
  const pad = ' '.repeat(indent)

  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const txt = child.textContent.trim()
      if (txt) out += pad + txt + '\n'
    }
    else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase()
      const attrs = [...child.attributes]
        .map(a => ` ${a.name}="${a.value}"`)
        .join('')
      out += `${pad}<${tag}${attrs}>\n`
      out += prettyPrint(child, indent + 2)
      out += `${pad}</${tag}>\n`
    }
  })

  return out
}