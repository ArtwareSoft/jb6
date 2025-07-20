import { dsls } from '@jb6/core'
import '@jb6/llm-guide'
import '@jb6/llm-api'
import '@jb6/common'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/lang-service'

const { 
  common: { Data, data : { pipe, bash } },
  tgp: { TgpType },
  'llm-api' : { Prompt,
    prompt: { user, system, prompt } 
  },
  'llm-guide' : { Booklet, 
    booklet: { booklet }
  }
} = dsls

const Skill = TgpType('skill', 'llm-guide')
const SkillSet = TgpType('skill-set', 'llm-guide')
const Benchmark = TgpType('benchmark', 'llm-guide')
const BenchmarkResult = TgpType('benchmark-result', 'llm-guide')

// impl: (ctx,{doclets, guidance}) => {
//   const comps = doclets.split(',').map(d=>d.trim()).filter(Boolean).map(d=>prettyPrintComp(dsls.test.test[d], {tgpModel: jb} ))
//   return comps
// }

BookletAndModel('bookletAndModel', {
  params: [
    {id: 'booklet', type: 'booklet', madatory: true},
    {id: 'llmModel', as: 'string', madatory: true}
  ]
})

Prompt('includeBooklet', {
  params: [
    {id: 'booklet', type: 'booklet<llm-guide>[]'}
  ],
  impl: async (ctx, {booklet}) => {
      const repoRoot = await coreUtils.calcRepoRoot()
      const { llmGuideFiles } = await studioAndProjectImportMaps(repoRoot)
      debugger
      const tgpModel = await coreutils.calcTgpModelData(llmGuideFiles)
  }
})

Prompt('includeFiles', {
  params: [
    {id: 'fileNames', as: 'string', description: 'separated by comma'}
  ],
  impl: system(bash(`echo '%$fileNames%' | tr ',' '\n' | xargs -I{} sh -c 'printf "==> file content %s <==\n" "{}"; cat "{}"'"`))
})

Skill('skill', {
  params: [
    {id: 'name', as: 'string', madatory: true},
    {id: 'description', as: 'text', madatory: true}
  ]
})

SkillSet('skillSet', {
  params: [
    {id: 'name', as: 'string', madatory: true},
    {id: 'description', as: 'text', madatory: true},
    {id: 'skills', type: 'skill[]', madatory: true},
    {id: 'bestInQuality', type: 'booklet-and-model', madatory: true},
    {id: 'bestInSpeed', type: 'booklet-and-model', madatory: true},
    {id: 'bestInPrice', type: 'booklet-and-model', madatory: true},
    {id: 'guidance', type: 'guidance[]'}
  ]
})

Benchmark('benchmark', {
    params: [
        {id: 'validation', type: 'vaildation', madatory: true},
        {id: 'tested-guidance', type: 'guidance[]', byName: true },
        {id: 'tester-guidance', type: 'guidance[]' },
    ]
})

BenchmarkResult('benchmarkResult', {
    params: [
        {id: 'benchmark', type: 'benchmark', madatory: true},
        {id: 'tested', type: 'booklet-and-model', madatory: true},
        {id: 'answerSheet', as: 'text', madatory: true},
        {id: 'mark', as: 'string', madatory: true},
        {id: 'date', as: 'number', madatory: true},
    ]
})
