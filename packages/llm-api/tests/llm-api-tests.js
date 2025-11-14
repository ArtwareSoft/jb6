import { coreUtils, dsls, ns, jb } from '@jb6/core'
import '@jb6/llm-api/tests/llm-api-tester.js'

const {
  tgp: { TgpType },
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs, pipe, list }, 
    Boolean: { contains, equals, and, notContains },
    Prop: { prop }
  },
  'llm-api': { Prompt,
    prompt: { prompt, user, system, includeBooklet, includeFiles },
    model: {llama_33_70b_versatile, claude_code_sonnet_4, sonnet_4, opus_4, claude3Haiku, gemini_2_5_flash, gemini_2_5_pro, gemini_2_5_flash_lite_preview, gemini_2_0_flash, gemini_1_5_flash, gemini_1_5_flash_8b, gemini_1_5_pro, o1, o1_mini, o4_mini, gpt_4o, gpt_4o_mini, gpt_35_turbo_0125, gpt_35_turbo_16k}
  },
  test: { Test, 
    test: { llmTest, dataTest }
  }
} = dsls
const { llm } = ns

Test('llmTest.hello', {
  HeavyTest: true,
  impl: llmTest(prompt(system('please answer very shortly'), user('say "israel"')), contains('srael'), {
    maxTokens: '2'
  })
})

Test('llmTest.hello.withCache', {
  HeavyTest: true,
  impl: llmTest(prompt(system('please answer very shortly'), user('say "USA"')), contains('USA'), {
    maxTokens: '10',
    useLocalStorageCache: true
  })
})

const profitableProducts = Prompt('profitableProducts', {
  impl: prompt(
    system(`DATABASE SCHEMA:
{
"products": [{"name": "iPhone", "price": 999, "cost": 600, "rating": 4.8, "units_sold": 1250}],
"customers": [{"name": "John", "total_spent": 5420, "tier": "gold", "orders_count": 8}],
"orders": [{"customer_name": "John", "total_amount": 1299, "status": "shipped", "order_date": "2024-11-01"}]
}`),
    system(`Generate React components using jq + h function. Use + for strings, no backticks.

EXAMPLE 1 - Simple list:
(db) => {
const data = jq.compileJb(".products | sort_by(.price)")(db)
return h("div:grid gap-4", {},
  ...data.map(item => h("div:bg-white p-4 rounded", {},
    h("h3:font-bold", {}, item.name),
    h("p", {}, "$" + item.price)
  ))
)
}

EXAMPLE 2 - With filtering:
(db) => {
const data = jq.compileJb(".customers | map(select(.tier == \"gold\"))")(db)
return h("div:flex flex-wrap gap-3", {},
  ...data.map(c => h("div:border p-3", {},
    h("h4", {}, c.name),
    h("span:text-sm", {}, "Spent: $" + c.total_spent)
  ))
)
}

EXAMPLE 3 - Complex query:
(db) => {
const data = jq.compileJb(".orders | map(select(.status == \"shipped\")) | sort_by(.total_amount) | reverse")(db)
return h("div:space-y-2", {},
  ...data.map(order => h("div:bg-gray-100 p-2 hover:bg-gray-200", {},
    h("p:font-medium", {}, order.customer_name),
    h("p:text-green-600", {}, "Amount: $" + order.total_amount)
  ))
)
}

Follow these patterns exactly. do not exceed 300 tokens do not use js section`),
    user('Create a dashboard showing our most profitable products with good ratings.')
  )
})

Test('llm.jqReactGeneration.profitableProducts', {
  HeavyTest: true,
  impl: llmTest({
    prompt: profitableProducts(),
    expectedResult: and(
      contains('(db) =>', 'jq.compileJb', 'price', '-', 'cost', 'rating', 'h("div', {
        anyOrder: true
      }),
      notContains('`'),
      notContains('${'),
      notContains('import'),
      notContains('React')
    ),
    maxTokens: 300,
    useLocalStorageCache: true
  })
})

Test('tailwindCard', {
  HeavyTest: true,
  impl: dataTest({
    calculate: llm.completions(profitableProducts(), { maxTokens: 300 }),
    expectedResult: contains('aa'),
    timeout: 50000,
    includeTestRes: true
  })
})

// Test('llmTest.hello.geminiCli', {
//   HeavyTest: true,
//   impl: llmTest(prompt(system('please answer clearly'), user('how large is USA')), contains('3.8'), {
//     llmModel: gemini_2_5_flash(),
//     useLocalStorageCache: true
//   })
// })

// notContains('`'), notContains('${'), notContains('import'), notContains('React')