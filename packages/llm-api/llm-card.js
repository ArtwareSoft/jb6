import { dsls, coreUtils, jb, ns } from '@jb6/core'

import '@jb6/react/tailwind-card.js'
import './llm-api.js'
import './llm-models.js'
import '@jb6/jq'
// import '@jb6/rx'
// import '@jb6/rx/rx-common.js'
import '@jb6/common'

//import { parse } from '@jb6/lang-service/lib/acorn-loose.mjs'


const { jq } = coreUtils

const {
    tgp: {var: {Var}, any : {If }}, 
    'llm-api': { Prompt,
        prompt: { prompt, user, system},
        model: {llama_33_70b_versatile, gpt_oss_120b, claude_code_sonnet_4}
    },
    
    common: { Data,
        data: { pipe, tailwindHtmlToPng, obj, asIs, first },
        prop: { prop }
     },
} = dsls

const { rx, llm, subject } = ns

Prompt('llm.card', {
  circuit: 'llmCardTest.profitableProductsPng',
  params: [
    {id: 'prompt', as: 'text'},
    {id: 'DBSchema', as: 'text'}
  ],
  impl: prompt(
    system(`You are an API. you can not speak to the user. Generate React components using jq + h function. Use + for strings, no backticks.

EXAMPLE 1 - With filtering:
(ctx) => {
const data = jq('.customers | map(select(.tier == "gold"))', ctx)
return h('div:flex flex-wrap gap-3', {},
  ...data.map(c => h('div:border p-3', {},
    h('h4', {}, c.name),
    h('span:text-sm', {}, 'Spent: $' + c.total_spent)
  ))
)
}

EXAMPLE 2 - Complex query:
(ctx) => {
const data = jq('.orders | map(select(.status == "shipped")) | sort_by(.total_amount) | reverse', ctx)
return h('div:space-y-2', {},
  ...data.map(order => h('div:bg-gray-100 p-2 hover:bg-gray-200', {},
    h('p:font-medium', {}, order.customer_name),
    h('p:text-green-600', {}, 'Amount: $' + order.total_amount)
  ))
)
}

Follow these patterns exactly.
ensure the jq code uses the same table and field names as in the schema!! 
do not exceed 300 tokens. 
do not use js section, start with "(ctx) => {".
`),
    user('DATABASE SCHEMA by example: %$DBSchema%'),
    user('%$prompt%')
  )
})
  
const compileAndRunCard = Data('compileAndRunCard', {
  params: [
    {id: 'db', as: 'object'}
  ],
  impl: (ctx,{},{db}) => {
        const code = ctx.data
        let html
        const h = jb.tailwindCardUtils.h
        try {
            const func = (new Function('h', 'jq', `return ${code}`))(h,jq)
            const vdom = func(ctx.setData(db))
            html = vdom.toHtml()
            //console.log(html)
            return { code, html }
        } catch (error) {
            return {error: {code, html, message: error.stack || error} }
            //onError(ctx.setData(error.message))
        }
    }
})

const retryOnError= Data('retryOnError', {
  params: [
    {id: 'calc', dynamic: true},
    {id: 'retries', as: 'number', defaultValue: 3}
  ],
  impl: async (ctx,{},{calc, retries}) => {
    let error, res, tries = 0
    while ((!res || res?.error) && tries < retries) {
        tries++
        res = await calc(ctx)
        if (res.error) {
            error = error || { errors: [] }
            error.errors.push(res.error)
        }
    }
    return { res, error }
  }
})

Data('llm.cardToPng', {
  circuit: 'llmCardTest.profitableProductsPng',
  params: [
    {id: 'prompt', as: 'text'},
    {id: 'DBSchema', as: 'text'},
    {id: 'db', as: 'object'}
  ],
  impl: pipe(
    retryOnError(pipe(
      llm.completions(llm.card('%$prompt%', '%$DBSchema%'), gpt_oss_120b(), { maxTokens: 3000 }),
      compileAndRunCard('%$db%'),
      first()
    )),
    If('%error%', '%%', tailwindHtmlToPng('%html%')),
    first()
  )
})
