import { dsls, coreUtils } from '@jb6/core'
import '@jb6/llm-guide'
import '@jb6/common'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/lang-service'

const { 
  common: { Data,
    data: { pipeline, split, join, first, list, pipe, bash }
  },
  tgp: { TgpType, any: {}, var: {Var } },
} = dsls
const { projectInfo, filePathsForDsls, calcTgpModelData, logError, fetchByEnv, deepMapValues, omitProps} = coreUtils

const calcRepoRoot = Data('calcRepoRoot', {
  impl: () => coreUtils.calcRepoRoot()
})

Data('filesContent', {
  impl: pipe(
    Var('repoRoot', calcRepoRoot(), { async: true }),
    bash(`for f in $(echo '%$fileNames%' | tr ',' ' '); do printf "==> %s <==\n" "$f"; cat "%$repoRoot%/$f"; done`)
  )
})

const bookletsContent = Data('bookletsContent', {
  params: [
    {id: 'booklets', as: 'text', description: 'comma delimited names'},
    {id: 'repoRoot', as: 'string', dynamic: true, defaultValue: calcRepoRoot() }
  ],
  impl: async (ctx, {booklets, repoRoot: _repoRoot}) => {
      const repoRoot = await _repoRoot()
      const { llmGuideFiles, projectImportMap } = await projectInfo(repoRoot)
      const tgpModel = await calcTgpModelData(llmGuideFiles)
      const notFound = booklets.split(',').filter(d=>!tgpModel.dsls['llm-guide'].booklet[d]).join(', ')
      notFound && logError(`includeBooklet can not find booklet ${notFound}`)
      const bookletsText = await Promise.all(booklets.split(',').map(b=>tgpModel.dsls['llm-guide'].booklet[b]).filter(Boolean).map(async bookletCmp=>{
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
      return bookletsText.flatMap(x=>x).join('\n\n')
  }
})

const tgpModel = Data('tgpModel', {
  params: [
    {id: 'forDsls', as: 'string', mandatory: true},
    {id: 'repoRoot', as: 'string', dynamic: true, defaultValue: calcRepoRoot() }
  ],
  impl: async (ctx, { forDsls, repoRoot: _repoRoot }) => {
    try {
//      const repoRoot = await _repoRoot()
      const filePaths = await filePathsForDsls(forDsls)
      const res = await coreUtils.calcTgpModelData(filePaths)
      const {dsls, ns} = deepMapValues(res,minifyComp,filter)
      return {dsls,ns}
    } catch (error) {
      return `Error calculating TGP model: ${error.message}`
    }

    function filter(obj, key, parent,path) {
      return (key == 'ns' && !path || key[0] == key[0]?.toUpperCase() && path.split('~').length == 3 || obj.$location) 
    }

    function minifyComp(obj, key,parent,path) {
      if (key == 'ns' && !path)
        return Object.keys(obj).join(',')
      if (key[0] == key[0]?.toUpperCase() && path.split('~').length == 3)
        return 'compDef'

      const {description,params} = obj
      const res = {}
      if (description) res.description = description
      if (params?.length > 0)
        res.params = params.map(p=>{
          const resP = omitProps(p,['$location','dsl','$dslType'])
          if (resP.type == 'data<common>') delete resP.type
          return resP
      })
      return res
    }
  }
})

Data('dslDocs', {
  description: 'get TGP (Type-generic component-profile) model relevant for dsls',
  params: [
    {id: 'dsl', as: 'string', defaultValue: 'common', options: 'common,rx,llm-api,testing'},
    {id: 'repoRoot', as: 'string', dynamic: true, defaultValue: calcRepoRoot()}
  ],
  impl: pipe(
    Var('tgpModel', tgpModel('%$dsl%', '%$repoRoot()%'), { async: true }),
    Var('booklet', bookletsContent('%$dsl%', '%$repoRoot()%'), { async: true }),
    ({},{tgpModel, booklet}) => ({tgpModel,booklet})
  )
})

Data('squeezeText', {
  description: 'squeeze text by deleting parts in the middle',
  params: [
    {id: 'text', defaultValue: '%%' },
    {id: 'maxLength', as: 'number', defaultValue: 20000},
    {id: 'keepPrefixSize', as: 'number', defaultValue: 1000 },
  ],
  impl: async (ctx, {text: _text, maxLength, keepPrefixSize}) => {
    const text = await Promise.resolve(_text).then(x=>x||'').then(x=>typeof x == 'object' ? JSON.stringify(x) : x)
    return (text.length > maxLength) ? [text.slice(0,keepPrefixSize),
      `===text was originally ${text.length}. sorry, we had to squeeze it to ${maxLength} chars. ${text.length - maxLength} missing chars here====`,
      text.slice(text.length-maxLength+keepPrefixSize)
    ].join('') : text
  }
})