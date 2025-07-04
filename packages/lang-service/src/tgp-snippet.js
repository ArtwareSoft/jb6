import { coreUtils, dsls } from '@jb6/core'
import { langServiceUtils } from './lang-service-parsing-utils.js'
import '@jb6/core/misc/calc-import-map.js'
const { calcProfileActionMap } = langServiceUtils

const { unique, calcTgpModelData, studioAndProjectImportMaps, runCliInContext } = coreUtils
Object.assign(coreUtils,{runSnippetCli})

async function runSnippetCli({compText: _compText, filePath, setupCode = '', packages = [], probe } = {}) {
    const { projectImportMap } = await studioAndProjectImportMaps(filePath)

    const tgpModel = await calcTgpModelData({filePath}) // todo: support packages
    const origCompText = (_compText[0]||'').match(/[A-Z]/) ? _compText : `Data('noName',{impl: ${_compText}})`
    let compText = origCompText, parts
    if (probe && origCompText.split('__').length) {
      parts = origCompText.split('__')
      if (parts.length === 2)
        parts[0] = parts[0].replace(/,\s*$/, '')
      compText = parts.join('')
    }
    const {dslTypeId, path: probePath, comp, error} = parseProfile({compText, tgpModel, inCompOffset : parts?.[0].length})
    if (error)
      return { error, compText, probe, origCompText }
    if (!comp.id)
      return { error : 'runSnippet: compText must be wrapped with compDef of its type. e.g. Test("my comp", {impl: dataTest(...)}) ' }
    const dslsSection = calcDslsSection([comp])
    const compPath = `dsls['${dslTypeId[0]}']['${dslTypeId[1]}']['${dslTypeId[2]}']`

    const imports = unique([filePath, ...packages]).map(f=>`\timport '${f}'`).join('\n')
    const script = `
import { jb, dsls, coreUtils } from '@jb6/core'
import '@jb6/core/misc/probe.js'

${imports}
${dslsSection}
      ;(async () => {
        try {
          ${setupCode}
          ${compText}
          if (${probe}) {
              const result = await jb.coreUtils.runProbe(${JSON.stringify(probePath)})
              process.stdout.write(JSON.stringify(result, null, 2))
          } else {
              const result = await ${compPath}.$run()
              process.stdout.write(JSON.stringify({result: coreUtils.stripData(result)}, null, 2))
          }
        } catch (e) {
          process.stdout.write(JSON.stringify(coreUtils.stripData(e), null, 2))
        }
        process.exit(0)
      })()
    `

    try {
      const result = await runCliInContext(script, {importMap: projectImportMap, requireNode: true})
      return { ...result, probePath, script }
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

    const dsls = unique(items.map(x=>x[1])).sort().map(dsl=>{
        const types = unique(items.filter(x=>x[1] == dsl).map(x=>x[0])).sort().map(type=> {
            const comps = unique(items.filter(x=>x[1] == dsl && x[0] == type).map(x=>x[2])).sort().join(', ')
            return `${type}: { ${comps} }`
        }).join(',\n\t\t')

        const compDefsIds = unique(compDefs.map(compDef => compDef.dsl == dsl && compDef.id).filter(Boolean))
        const compDefsStr = compDefsIds.length ? compDefsIds.map(compDef=>`${compDef} ,`).join() : ''
        return `\t${dsl}:{ ${compDefsStr}\n\t\t${types}\n\t}`
    }).join(',\n')
    return `const {\n${dsls}\n} = dsls`


    function calcItems(node) {
        if (node.$$) _items.push(node.$$.match(/([^<]+)<([^>]+)>(.+)/).slice(1))
        if (typeof node == 'object') Object.values(node).filter(x=>x).forEach(x=>calcItems(x))
    }
}

