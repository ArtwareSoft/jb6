import { dsls, coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
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
const { calcImportData, calcTgpModelData, logError, fetchByEnv, deepMapValues, omitProps, calcRepoRoot} = coreUtils

Data('filesContent', {
  impl: pipe(
    bash(`for f in $(echo '%$fileNames%' | tr ',' ' '); do printf "==> %s <==\n" "$f"; cat "${jb.coreRegistry.repoRoot}/$f"; done`)
  )
})

const bookletsContent = Data('bookletsContent', {
  params: [
    {id: 'booklets', as: 'text', description: 'comma delimited names'}
  ],
  impl: async (ctx, {booklets, }) => {
      const repoRoot = jb.coreRegistry.repoRoot || await calcRepoRoot()
      const { llmGuideFiles, staticMappings } = await calcImportData({forRepo: repoRoot})
      const tgpModel = await calcTgpModelData({entryPointPaths: llmGuideFiles})
      const notFound = booklets.split(',').filter(d=>!tgpModel.dsls['llm-guide'].booklet[d]).join(', ')
      notFound && logError(`includeBooklet can not find booklet ${notFound}`)
      const bookletsText = await Promise.all(booklets.split(',').map(b=>tgpModel.dsls['llm-guide'].booklet[b]).filter(Boolean).map(async bookletCmp=>{
        const loc = bookletCmp.$location
        const src = await fetchByEnv(loc.path, staticMappings)
        const doclets = src.split('\n').slice(loc.line, loc.to.line).join('').match(/booklet\(([^)]*)\)/)[1].split(',').map(x=>x.trim()).map(x=>x.replace("'",'')).filter(Boolean)
        const notFound = doclets.filter(d=>!tgpModel.dsls['llm-guide'].doclet[d]).join(', ')
        notFound && logError(`includeBooklet can not find doclet ${notFound}`)
        const docs = await Promise.all(doclets.map(d=>tgpModel.dsls['llm-guide'].doclet[d]).filter(Boolean).map(async cmp=>{
          const loc = cmp.$location
          const src = await fetchByEnv(loc.path, staticMappings)
          return src.split('\n').slice(loc.line, loc.to.line).join('\n')
        }))
        return docs
      }))
      return bookletsText.flatMap(x=>x).join('\n\n')
  }
})

const tgpModel = Data('tgpModel', {
  params: [
    {id: 'forDsls', as: 'string', mandatory: true, description: 'e.g: llm-guide,test,common,llm-api'},
    {id: 'includeLocation', as: 'boolean', byName: true}
  ],
  impl: async (ctx, { forDsls, includeLocation }) => {
    const repoRoot = jb.coreRegistry.repoRoot || await calcRepoRoot()
    try {
      const res = await coreUtils.calcTgpModelData({forRepo: repoRoot }) // await coreUtils.calcTgpModelData({forDsls})
      const {dsls: _dsls} = deepMapValues(res,minifyComp,filter)
      const filterDsls = Array.isArray(forDsls) ? forDsls : (forDsls||'').split(',').map(x=>x.trim()).filter(Boolean)
      const dsls = forDsls ? Object.fromEntries(filterDsls.map(dsl=>[dsl,_dsls[dsl]])) : _dsls
      const tests = Object.fromEntries(Object.entries(_dsls.test.test)               .filter(e =>filterDsls.find(dsl=>(e[1]?.location || '').indexOf(dsl) != -1)))
      const booklets = Object.fromEntries(Object.entries(_dsls['llm-guide'].booklet).filter(e =>filterDsls.find(dsl=>(e[1]?.location || '').indexOf(dsl) != -1)))
      return {dsls, tests, booklets}
    } catch (error) {
      return `Error calculating TGP model: ${error.message}`
    }

    function filter(obj, key, parent,path) {
      return (key == 'ns' && !path || key[0] == key[0]?.toUpperCase() && path.split('~').length == 3 || obj?.$location) 
    }


    function minifyComp(obj, key,parent,path) {
      if (key == 'ns' && !path)
        return Object.keys(obj).join(',')
      if (key[0] == key[0]?.toUpperCase() && path.split('~').length == 3)
        return 'compDef'

      const {description,params} = obj
      const res = {}
      if (includeLocation) res.location = obj.$location ? `${obj.$location.path.replace(repoRoot,'').replace('/packages/','')}:${obj.$location.line}-${obj.$location.to?.line}` : ''
      if (description) res.description = description
      if (params?.length > 0)
        res.params = params.map(p=>{
          const resP = omitProps(p,['dsl','$dslType'])
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
  ],
  impl: pipe(
    Var('tgpModel', tgpModel('%$dsl%'), { async: true }),
    Var('booklet', bookletsContent('%$dsl%'), { async: true }),
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