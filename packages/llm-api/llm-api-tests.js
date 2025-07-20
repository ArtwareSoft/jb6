import { coreUtils, dsls, ns, jb } from '@jb6/core'
import '@jb6/llm-api'
import '@jb6/testing'
import '@jb6/llm-guide'
import '@jb6/mcp'
import '@jb6/llm-guide/skills.js'
import '@jb6/testing/llm-guide/how-to-write-tests.js'
import '@jb6/core/llm-guide/tgp-primer.js'
const {
  tgp: { TgpType },
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs, pipe, list }, 
    Boolean: { contains, equals, and },
    Prop: { prop }
  },
  'llm-api': {
    prompt: { prompt, user, system, includeBooklet, includeFiles },
    model: {claude_code_sonnet_4, sonnet_4, opus_4, claude3Haiku, gemini_2_5_flash, gemini_2_5_pro, gemini_2_5_flash_lite_preview, gemini_2_0_flash, gemini_1_5_flash, gemini_1_5_flash_8b, gemini_1_5_pro, o1, o1_mini, o4_mini, gpt_4o, gpt_4o_mini, gpt_35_turbo_0125, gpt_35_turbo_16k}
  },
  'llm-guide': {
    booklet: { tgpPrimer, howToWriteTests}
  },
  mcp: {
    tool: { getFilesContent }
  },
  test: { Test, 
    test: { dataTest}
  }
} = dsls
const { llm } = ns

const llmTest = Test('llmTest', {
  params: [
    {id: 'prompt', type: 'prompt<llm-api>', dynamic: true},
    {id: 'expectedResult', type: 'boolean', dynamic: true},
    {id: 'llmModel', type: 'model<llm-api>', defaultValue: gpt_35_turbo_0125()}
  ],
  impl: dataTest(llm.completions('%$prompt()%', '%$llmModel%'), '%$expectedResult()%', {
    timeout: 50000,
    includeTestRes: true
  })
})

Test('llmTest.hello', {
  HeavyTest: true,
  impl: llmTest(prompt(system('please answer clearly'), user('how large is israel')), contains('srael'))
})

Test('llmTest.hello.withCache', {
  HeavyTest: true,
  impl: dataTest({
    calculate: llm.completions(prompt(system('please answer clearly'), user('how large is USA')), {
      useLocalStorageCache: true
    }),
    expectedResult: contains('3.8'),
    timeout: 50000
  })
})

Test('llmTest.hello.claudeCode', {
  HeavyTest: true,
  impl: dataTest({
    calculate: llm.completions(prompt(user('how large is USA?')), claude_code_sonnet_4()),
    expectedResult: contains('3.8'),
    timeout: 50000
  })
})

Test('llmTest.howToWriteTests', {
  HeavyTest: true,
  impl: llmTest({
    prompt: prompt(
      includeBooklet(tgpPrimer(), howToWriteTests()),
      includeFiles('/packages/social-db/data-store.js'),
      user('please write 3 tests for dataStore')
    ),
    expectedResult: contains(''),
    llmModel: claude_code_sonnet_4()
  })
})

// Test('llmTest.hello.geminiCli', {
//   HeavyTest: true,
//   impl: dataTest(llm.completions(prompt(user('how large is USA area?')), gemini_2_5_flash()), contains('3.8'), {
//     timeout: 50000
//   })
// })

