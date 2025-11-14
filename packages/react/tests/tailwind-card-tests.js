import { dsls, ns, coreUtils, jb } from '@jb6/core'
import '@jb6/react/tailwind-card.js' 
import '@jb6/testing'
import { peopleTransactionsDb as db } from './peopleTransactionsDb-test.js'
const { tailwindHtmlToPng, h } = jb.tailwindCardUtils

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
    expectedResult: contains('data')
  })
})


