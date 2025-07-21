import { coreUtils, dsls, ns, jb } from '@jb6/core'
import '@jb6/llm-api/skills.js'
import '@jb6/llm-api/tests/llm-api-tester.js'

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
  'llm-guide': { Booklet,
    booklet: { tgpPrimer, howToWriteTests}
  },
  mcp: {
    tool: { getFilesContent }
  },
  test: { Test, 
    test: { llmTest }
  }
} = dsls
const { llm } = ns

Test('llmTest.howToWriteTests', {
  HeavyTest: true,
  impl: llmTest({
    prompt: prompt(
      includeBooklet('tgpPrimer,howToWriteTests'),
      includeFiles('packages/social-db/data-store.js'),
      user('please tell a joke')
    ),
    expectedResult: contains(''),
    llmModel: claude_code_sonnet_4()
  })
})

