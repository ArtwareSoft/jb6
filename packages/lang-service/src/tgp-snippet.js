import { parse } from '../lib/acorn-loose.mjs'
import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/calc-import-map.js'

const { unique, resolveProfileTypes, astToTgpObj, calcTgpModelData, studioAndProjectImportMaps, runCliInContext } = coreUtils
Object.assign(coreUtils,{runSnippetCli})

async function runSnippetCli({compText, filePath, setupCode = '', packages = [] } = {}) {
    const { projectImportMap } = await studioAndProjectImportMaps(filePath)

    const tgpModel = await calcTgpModelData({filePath}) // todo: support packages
    const comp = astToTgpObj(parse(compText, { ecmaVersion: 'latest', sourceType: 'module' }).body[0], compText)
    resolveProfileTypes(comp, {tgpModel, expectedType: 'comp<tgp>', comp})
    const dslsSection = calcDslsSection([comp])
    const _compPath = comp.impl?.$$?.match(/([^<]+)<([^>]+)>(.+)/)
    if (!_compPath)
      return { error: 'compText must be wrapped with compDef of its type. e,g, Data({impl: ...}), Test({impl:...}) ', script}
    const compPath = comp.id ? `dsls['${_compPath[2]}']['${_compPath[1]}']['${comp.id}']` : 'x'
    const compIdPrefix = comp.id ? '' : 'const x = '
    const compId = comp.id || 'x'

    const imports = unique([filePath, ...packages]).map(f=>`\timport '${f}'`).join('\n')
    const script = `
import { jb, dsls, coreUtils } from '@jb6/core'
${imports}
${dslsSection}
      ;(async () => {
        try {
          ${setupCode}
          ${compIdPrefix}${compText}
          const res = await ${compPath}.$run()
          const result = res && typeof res == 'object' ? {...res, compId: '${compId}'} : {compId: '${compId}', result: res}
          process.stdout.write(JSON.stringify(coreUtils.stripData(result), null, 2))
        } catch (e) {
          process.stdout.write(JSON.stringify(coreUtils.stripData(e), null, 2))
        }
        process.exit(0)
      })()
    `

    try {
        debugger
      const result = await runCliInContext(script, {importMap: projectImportMap, requireNode: true})
      return { ...result, script }
    } catch (error) {
      return { error, script }
    }
}

function calcDslsSection(comps) {
    const _items = []
    const defaultCompDefs = [{ dsl: 'tgp', id: 'Const'}]
    const compDefs = [...defaultCompDefs, ...comps.map(comp=>({ dsl: comp.impl?.$$?.match(/([^<]+)<([^>]+)>(.+)/)[2], id: comp.$ }))]
    comps.forEach(calcItems)
    const items = unique(_items.filter(x=>x))

    const dsls = unique(items.map(x=>x[1])).sort().map(dsl=>{
        const types = unique(items.filter(x=>x[1] == dsl).map(x=>x[0])).sort().map(type=> {
            const comps = unique(items.filter(x=>x[1] == dsl && x[0] == type).map(x=>x[2])).sort().join(', ')
            return `${type}: { ${comps} }`
        }).join(',\n\t\t')

        const compDefsStr = compDefs.map(compDef => compDef.dsl == dsl ? `${compDef.id}, ` : '').join('')
        return `\t${dsl}:{ ${compDefsStr}\n\t\t${types}\n\t}`
    }).join(',\n')
    return `const {\n${dsls}\n} = dsls`


    function calcItems(node) {
        if (node.$$) _items.push(node.$$.match(/([^<]+)<([^>]+)>(.+)/).slice(1))
        if (typeof node == 'object') Object.values(node).filter(x=>x).forEach(x=>calcItems(x))
    }
}
