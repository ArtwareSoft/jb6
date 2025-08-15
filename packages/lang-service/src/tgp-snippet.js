import { coreUtils, dsls } from '@jb6/core'
import { langServiceUtils } from './lang-service-parsing-utils.js'
import '@jb6/core/misc/import-map-services.js'
const { calcProfileActionMap } = langServiceUtils
import { parse } from '../lib/acorn-loose.mjs'

const { unique, calcTgpModelData, runCliInContext,pathJoin,toCapitalType, calcRepoRoot, discoverDslEntryPoints } = coreUtils
Object.assign(coreUtils,{runSnippetCli})

async function runSnippetCli({profileText, setupCode = '' } = {}) {
    const repoRoot = await calcRepoRoot()
    const tgpModel = await calcTgpModelData({forRepo: repoRoot }) // getting a full model
    if (tgpModel.error) return { error: tgpModel.error }
    const projectDir  = tgpModel.projectDir || repoRoot
    const compNames = compNamesInProfile(profileText)
    const comps = Object.values(tgpModel.dsls).flatMap(type=>Object.values(type)).filter(x=>typeof x == 'object').flatMap(x=>Object.values(x))
      .filter(x => compNames.includes(x.id))
    // const notFound = compNames.filter(id => !comps.find(comp => comp.id === id))
    // if (notFound.length > 0)
    //   return { error: `can not find comp for profile ${notFound.join(', ')}` }
    const { type } = comps.find(c=> c.id === compNames[0]) || { type: 'data' }
    const profText = comps.length ? profileText : JSON.stringify(profileText) 
    const origCompText = `${toCapitalType(type)}('noName',{impl: ${profText}})`    
    const isProbeMode = origCompText.split('__').length > 1
        
    let compText = origCompText, parts
    if (isProbeMode) {
      parts = origCompText.split('__')
      if (parts.length === 2)
        parts[0] = parts[0].replace(/,\s*$/, '')
      compText = parts.join('')
    }
    
    const {dslTypeId, path: probePath, comp, error} = parseProfile({compText, tgpModel, inCompOffset : parts?.[0].length})
    if (error)
      return { error, compText, isProbeMode, origCompText }
    if (!comp.id)
      return { error : 'runSnippet: profileText must be prefixed with type<dsl>. e.g. test<test>:dataTest(...)' }
    const dslsSection = calcDslsSection([comp])
    const compPath = `dsls['${dslTypeId[0]}']['${dslTypeId[1]}']['${dslTypeId[2]}']`

    const dsls = unique(comps.map(c=>c.dsl))
    const dslsEntryPoints = await discoverDslEntryPoints(dsls)
    const entryFiles = unique(comps.map(c=>c.$location.path))
    const imports = [...dslsEntryPoints,...entryFiles].map(f=>`\tawait import('${f}')`).join('\n')
    const script = `
    // dir: ${projectDir}
import { jb, dsls, coreUtils, ns } from '@jb6/core'
import '@jb6/core/misc/probe.js'
      ;(async () => {
        ${imports}

        ${dslsSection}

        try {
          ${setupCode}
          ${compText}
          if (${isProbeMode}) {
              const result = await jb.coreUtils.runProbe(${JSON.stringify(probePath || '')})
              await coreUtils.writeToStdout(result)
          } else {
              const result = await ${compPath}.$run()
              await coreUtils.writeToStdout({result: coreUtils.stripData(result)})
          }
        } catch (e) {
          await coreUtils.writeToStdout(coreUtils.stripData(e))
        }
      })()
    `

    try {
      const result = await runCliInContext(script, {projectDir})
      return result
    } catch (error) {
      return { error, script, probePath }
    }

    function parseProfile({compText,tgpModel,inCompOffset}) {
      try {
        return calcProfileActionMap(compText, {tgpType: 'comp<tgp>', tgpModel, inCompOffset})
      } catch(error) {
        return { error }
      }
    }
}


function calcDslsSection(comps) {
    const _items = [['data', 'common', 'asIs']] // should be const
    const defaultCompDefs = [{ dsl: 'tgp', id: 'Const'}, { dsl: 'common', id: 'Data'}]
    const compDefs = [...defaultCompDefs, ...comps.filter(comp=>comp.impl?.$$).map(comp=>({ dsl: comp.impl?.$$?.match(/([^<]+)<([^>]+)>(.+)/)[2], id: comp.$ }))]
    comps.forEach(calcItems)
    const items = unique(_items.filter(x=>x))
    const ns = unique(items.filter(item=>item[2].indexOf('.') != -1).map(item =>item[2].split('.')[0]))
    const ns_str = ns.length ? `const { ${ns.join(', ')} } = ns` : ''

    const dsls = unique(items.map(x=>x[1])).sort().map(dsl=>{
        const types = unique(items.filter(x=>x[1] == dsl).map(x=>x[0])).sort().map(type=> {
            const comps = unique(items.filter(x=>x[1] == dsl && x[0] == type).map(x=>x[2])).filter(x=>x.indexOf('.') == -1).sort().join(', ')
            const typeStr = type.indexOf('-') == -1 ? type : `'${type}'`
            return `${typeStr}: { ${comps} }`
        }).join(',\n\t\t')

        const compDefsIds = unique(compDefs.map(compDef => compDef.dsl == dsl && compDef.id).filter(Boolean))
        const compDefsStr = compDefsIds.length ? compDefsIds.map(compDef=>`${compDef} ,`).join() : ''
        const dslStr = dsl.indexOf('-') == -1 ? dsl : `'${dsl}'`
        return `\t${dslStr}:{ ${compDefsStr}\n\t\t${types}\n\t}`
    }).join(',\n')
    return [`const {\n${dsls}\n} = dsls`, ns_str].filter(Boolean).join('\n')


    function calcItems(node) {
        if (node.$$) _items.push(node.$$.match(/([^<]+)<([^>]+)>(.+)/).slice(1))
        if (typeof node == 'object') Object.values(node).filter(x=>x).forEach(x=>calcItems(x))
    }
}

function compNamesInProfile(profileText) {
  const visitedNodes = new Set()
  const result = []
  search(parse(profileText, { ecmaVersion: 'latest', sourceType: 'module' }).body[0])
  return result

  function search(node) {
    if (typeof node != 'object' || visitedNodes.has(node)) return
    visitedNodes.add(node)

    if (node.callee)
      result.push(nameFromCallee(node.callee))
    Object.values(node).filter(Boolean).forEach(n => search(n))
  }

  function nameFromCallee(callee) {
    if (callee.name) return callee.name
    return nameFromCallee(callee.object) + '.' + callee.property.name
  }
}

