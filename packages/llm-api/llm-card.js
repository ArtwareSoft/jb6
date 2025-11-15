import { dsls, coreUtils, jb, ns } from '@jb6/core'

import '@jb6/react/tailwind-card.js'
import './llm-api.js'
import './llm-models.js'
import '@jb6/jq'
import '@jb6/rx'
import '@jb6/rx/rx-common.js'

const { jq } = coreUtils

const {
    tgp: {var: {Var}}, 
    'llm-api': { Prompt,
        prompt: { prompt, user, system},
        model: {llama_33_70b_versatile}
      },
    
    common: { Data,
        data: { pipe, tailwindHtmlToPng, obj, asIs, first },
        prop: { prop }
     },
     rx: { ReactiveSource,ReactiveOperator, Subject,
        subject: { topic },
        'reactive-source' : { interval, subjectSource, merge, mergeConcat },
        'reactive-operator' : {}
      },    
} = dsls

const { rx, llm, subject } = ns

Prompt('llm.card', {
  params: [
    {id: 'prompt', as: 'text'},
    {id: 'DBSchema', as: 'text'}
  ],
  impl: prompt(
    system('DATABASE SCHEMA: %$DBSchema%'),
    system(`Generate React components using jq + h function. Use + for strings, no backticks.

EXAMPLE 1 - Simple list:
(ctx) => {
const data = jq('.products | sort_by(.price)', ctx)
return h('div:grid gap-4', {},
  ...data.map(item => h('div:bg-white p-4 rounded', {},
    h('h3:font-bold', {}, item.name),
    h('p', {}, '$' + item.price)
  ))
)
}

EXAMPLE 2 - With filtering:
(ctx) => {
const data = jq('.customers | map(select(.tier == "gold"))', ctx)
return h('div:flex flex-wrap gap-3', {},
  ...data.map(c => h('div:border p-3', {},
    h('h4', {}, c.name),
    h('span:text-sm', {}, 'Spent: $' + c.total_spent)
  ))
)
}

EXAMPLE 3 - Complex query:
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
    user('%$prompt%')
  )
})

const userRequests= Subject('userRequests', {
  impl: topic('userRequests')
})

const errors= Subject('errors', {
  impl: topic('errors')
})
  
Data('llmCard.compileAndRunCard', {
  params: [
    {id: 'db', as: 'object'},
    {id: 'onError', type: 'action'}
  ],
  impl: (ctx,{},{db,onError}) => {
        const code = ctx.data
        const h = jb.tailwindCardUtils.h
        try {
            const func = (new Function('h', 'jq', `return ${code}`))(h,jq)
            const vdom = func(ctx.setData(db))
            const html = vdom.toHtml()
            //console.log(html)
            return html
        } catch (error) {
            onError(ctx.setData(error.message))
        }
    }
})
const { llmCard } = ns

ReactiveSource('rx.cardToPng', {
  circuit: 'llmCardTest.profitableProductsPng',
  params: [
    {id: 'prompt', as: 'text'},
    {id: 'DBSchema', as: 'text'},
    {id: 'db', as: 'object'}
  ],
  impl: rx.pipe(
    Var('errors', () => []),
    merge(
      rx.data('start'),
      subjectSource(userRequests()),
      rx.pipe(subjectSource(errors()), rx.do(({data}, {errors}) => errors.push(data)), rx.take(5))
    ),
    rx.mapPromise(llm.completions(llm.card('%$prompt%', '%$DBSchema%'), llama_33_70b_versatile(), { maxTokens: 300 })),
    rx.map(llmCard.compileAndRunCard('%$db%', subject.notify(errors()))),
    rx.mapPromise(tailwindHtmlToPng()),
    rx.map(obj(prop('imageUrl', '%%'), prop('err', '%$errors%')))
  )
})

Data('llm.cardToPng', {
  params: [
    {id: 'prompt', as: 'text'},
    {id: 'DBSchema', as: 'text'},
    {id: 'db', as: 'object'}
  ],
  impl: rx.pipe(rx.cardToPng('%$prompt%', '%$DBSchema%', { db: '%$db%' }), rx.take(1))
})

/*
    rx.mapPromise(
        If('%$errors.length < 5%', 
            pipe(llm.completions(llm.card('%$prompt%', '%$DBSchema%'), llama_33_70b_versatile(), { maxTokens: 300 }))
    , pipe() )),

*/