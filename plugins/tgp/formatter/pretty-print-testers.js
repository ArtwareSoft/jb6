import { dataTest } from '../../testers/data-tester.js'
import { Test } from '../../testers/tester.js'
export { Test }
import { prettyPrintWithPositions } from './pretty-print.js'
import { resolveProfile } from '../../core/jb-macro.js'

export const PPPosOfPath = Test('PPPosOfPath', {
  macroByValue: true,
  params: [
    {id: 'profile', type: 'any'},
    {id: 'expectedType', as: 'string'},
    {id: 'path', as: 'string'},
    {id: 'expectedPos', as: 'string'}
  ],
  impl: dataTest({
    calculate: ({},{},{profile, expectedType}) => prettyPrintWithPositions(resolveProfile(profile, {expectedType})),
    expectedResult: ({data},{},{expectedPos,path}) => {
        const items = (data?.actionMap || []).filter(x=>x.action == path).map(x=>`${x.from},${x.to}`)
        let error = items.length ? '' : `path not found ${path}`
        error = error || (items.includes(expectedPos) ? '' : `pos ${items.join(';')} instead of ${expectedPos}`)
        return error ? { testFailure: error } : true
    },
    includeTestRes: true
  })
})