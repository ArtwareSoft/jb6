import { Test, dataTest, utils } from '../../testers/data-tester.js'
import { prettyPrintWithPositions } from '../formatter/pretty-print.js'
import { resolveProfileArgs } from '../../core/jb-args.js'
import { calcProfileActionMap } from './tgp-text-editor.js'
import { calcTgpModelData } from '../model-data/tgp-model-data.js'
export { Test, dataTest }

let testTgpModel
function getTgpModel() {
  return testTgpModel ??= calcTgpModelData({filePath: '/plugins/tgp/text-editor/profile-parser-tests.js'})
}

export const actionMapTest = Test('actionMapTest', {
  macroByValue: true,
  params: [
    {id: 'profile' },
    {id: 'expectedType', as: 'string'},
    {id: 'path', as: 'string'},
    {id: 'expectedPos', as: 'string'}
  ],
  impl: dataTest({
    calculate: ({},{},{profile, expectedType}) => getTgpModel().then(tgpModel => {
      const { text: compText, actionMap} = typeof profile == 'string' ? { text: profile, actionMap: [] } 
        :  prettyPrintWithPositions(resolveProfileArgs(profile, {expectedType}), {tgpModel} )
      const actionMapFromParse = calcProfileActionMap(compText, {tgpModel, tgpType: expectedType} ).actionMap
        .map(e=>({from: e.from, to: e.to,action: e.action, source: e.source})) // for debug to match actionMap
      return { actionMap, actionMapFromParse, compText }
    }),
    expectedResult: ({ data : {actionMap, actionMapFromParse, compText}},{},{expectedPos,path}) => {
        const compareActions = (a, b) => a.from - b.from || a.to - b.to || a.action.localeCompare(b.action)
        actionMap.sort(compareActions)
        actionMapFromParse.sort(compareActions)
        const diff = utils.sortedArraysDiff(actionMap,actionMapFromParse,compareActions)
        ;[...diff.inserted, ...diff.deleted].forEach(e => { e.before = compText.slice(0,e.from); e.text = compText.slice(e.from,e.to) })
        let error = ''
        const actualDiff = [...diff.deleted.filter(x=>x.text !="'" || !x.action.startsWith('addProp!')), ...diff.inserted]
        if (actualDiff.length)
          console.log('actionMapTest diffs',diff)
        const items = actionMapFromParse.filter(x=>x.action == path).map(x=>`${x.from},${x.to}`)
        error = error || (items.length ? '' : `path not found ${path}`)
        error = error || (items.includes(expectedPos) ? '' : `pos ${items.join(';')} instead of ${expectedPos}`)
        return error ? { testFailure: error } : true
    },
    includeTestRes: true,
    timeout: 1000
  })
})
