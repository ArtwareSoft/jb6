import { coreUtils, dsls, ns, jb } from '@jb6/core'
import '@jb6/llm-api'
import '@jb6/testing'
const {
  test: { Test, test: { dataTest} },
  'llm-api': { model: { gpt_35_turbo_0125 } },
} = dsls
const { llm } = ns

Test('llmTest', {
  params: [
    {id: 'prompt', type: 'prompt<llm-api>', dynamic: true},
    {id: 'expectedResult', type: 'boolean', dynamic: true},
    {id: 'llmModel', type: 'model<llm-api>', defaultValue: gpt_35_turbo_0125()},
    {id: 'useLocalStorageCache', as: 'boolean'}
  ],
  impl: dataTest({
    calculate: llm.completions('%$prompt()%', '%$llmModel%', { useLocalStorageCache: '%$useLocalStorageCache%' }),
    expectedResult: '%$expectedResult()%',
    timeout: 50000,
    includeTestRes: true
  })
})