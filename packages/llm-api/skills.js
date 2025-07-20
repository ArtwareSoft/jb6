import { dsls, coreUtils } from '@jb6/core'
import '@jb6/llm-guide'
import '@jb6/llm-api'
import '@jb6/common'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/lang-service'
const { studioAndProjectImportMaps, calcRepoRoot, calcTgpModelData, logError, fetchByEnv} = coreUtils
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
const BookletAndModel = TgpType('booklet-and-model', 'llm-guide') 

BookletAndModel('bookletAndModel', {
  params: [
    {id: 'booklet', type: 'booklet', madatory: true},
    {id: 'llmModel', as: 'string', madatory: true}
  ]
})

Prompt('includeBooklet', {
  params: [
    {id: 'booklet', as: 'text'}
  ],
  impl: async (ctx, {booklet}) => {
      const repoRoot = await calcRepoRoot()
      const { llmGuideFiles, projectImportMap } = await studioAndProjectImportMaps(repoRoot)
      const tgpModel = await calcTgpModelData(llmGuideFiles)
      const notFound = booklet.split(',').filter(d=>!tgpModel.dsls['llm-guide'].booklet[d]).join(', ')
      notFound && logError(`includeBooklet can not find booklet ${notFound}`)
      const booklets = await Promise.all(booklet.split(',').map(b=>tgpModel.dsls['llm-guide'].booklet[b]).filter(Boolean).map(async bookletCmp=>{
        const loc = bookletCmp.$location
        const src = await fetchByEnv(loc.path, projectImportMap.serveEntries)
        const doclets = src.split('\n').slice(loc.line, loc.to.line).join('').match(/booklet\(([^)]*)\)/)[1].split(',').map(x=>x.trim()).map(x=>x.replace("'",'')).filter(Boolean)
        const notFound = doclets.filter(d=>!tgpModel.dsls['llm-guide'].doclet[d]).join(', ')
        notFound && logError(`includeBooklet can not find doclet ${notFound}`)
        const docs = await Promise.all(doclets.map(d=>tgpModel.dsls['llm-guide'].doclet[d]).filter(Boolean).map(async cmp=>{
          const loc = cmp.$location
          const src = await fetchByEnv(loc.path, projectImportMap.serveEntries)
          return src.split('\n').slice(loc.line, loc.to.line).join('\n')
        }))
        return docs
      }))
      return booklets.flatMap(x=>x).join('\n\n')
  }
})

Prompt('includeFiles', {
  params: [
    {id: 'fileNames', as: 'string', description: 'separated by comma'}
  ],
  impl: system(bash(`for f in $(echo '%$fileNames%' | tr ',' ' '); do printf "==> %s <==\n" "$f"; cat "$f"; done`))
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
