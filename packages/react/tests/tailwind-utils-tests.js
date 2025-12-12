import { dsls, ns, coreUtils, jb } from '@jb6/core'
import '@jb6/react/tailwind-utils.js' 
import '@jb6/testing'
import { peopleTransactionsDb as db } from './peopleTransactionsDb-test.js'
const { tailwindHtmlToPng, h } = jb.tailwindUtils

import '@jb6/jq'
import '@jb6/core/misc/jb-cli.js'

const { jq } = coreUtils

const { 
  common: { boolean: { contains }},
  test: { Test, 
    test: { dataTest }
  }, 
} = dsls

Test('tailwindCardTest.pngUrl', {
  doNotRunInTests: true,
  impl: dataTest({
    calculate: async ctx => {
      const best = jq(".people | sort_by(.rating) | reverse", ctx.setData(db))
      const vdom = h("div:grid grid-cols-1 md:grid-cols-3 gap-4", {},
            ...best.map(person => 
              h("div:bg-white rounded-lg p-4 shadow hover:scale-105 transition-all", {},
                h("h3:font-bold", {}, person.name),
                h("p:text-gray-600", {}, person.job_title),
                h("p:text-sm text-gray-500", {}, person.city + " • " + person.rating + "/5")
      )))
      const html = vdom.toHtml()
      const pngUrl = await tailwindHtmlToPng({html})
      return pngUrl
  },
    expectedResult: contains('data'),
    timeout: '1000'
  })
})

Test('tailwindCardTest.badHtml', {
  doNotRunInTests: true,
  impl: dataTest({
    calculate: async ctx => {
      const html = `<div class="chat-body py-2"><div class="flex justify-end mb-4 mt-4 px-4"><div dir="auto" class="px-4 py-3 max-w-sm whitespace-pre-wrap font-sans text-base leading-6 rounded-2xl font-normal bg-gray-100 text-[undefined]">hey</div></div><div class="w-full px-4"><div style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; font-family: Inter, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, system-ui, sans-serif; font-size: 16px; line-height: 1.5; font-weight: 400; direction: ltr; text-align: left;"><div style="margin-bottom: 0px;"><span>Hello! How can I help you today?</span></div></div><div class="end-of-assistant-finished-response"></div></div></div>`
      const pngUrl = await tailwindHtmlToPng({html})
      return pngUrl
  },
    expectedResult: contains('data'),
    timeout: '1000'
  })
})


