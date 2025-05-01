import {lastEditForTester} from '../text-editor/workspace.js'
import {tgpModelForLangService, tgpModels, completionItems, editAndCursorOfCompletionItem, calcCompProps } from './lang-service.js'
import { calcTgpModelData } from '../model-data/tgp-model-data.js'
import { offsetToLineCol, applyCompChange, tgpEditorHost, calcProfileActionMap } from  '../text-editor/tgp-text-editor.js'
import { dataTest, Test, Usage, Data, utils } from '../../testers/data-tester.js'
export { Test, Usage, Data }

let uniqueNameCounter = 0
function fixToUniqueName(code) {
  const cmpId = 'CmpltnTst'+uniqueNameCounter++
  return code.replace(/Test\('x',/,`Test('${cmpId}',`)
}

const testTgpModel = {}
function getTgpModel(filePath) {
  testTgpModel[filePath] = testTgpModel[filePath] || calcTgpModelData({filePath})
  return testTgpModel[filePath]
}

async function initCompletionText({ctx,compText,filePath,dsl,remoteSuggestions}) {
  const testId = ctx.vars.testID
  const fullText = compText.match(/^[a-z]+Test\(/) ? `Test('x', {\n  impl: ${compText}\n})` 
    : `Test('x', {\n  impl: uiTest(${compText})\n})`
  const parts = fixToUniqueName(fullText).split('__')
  const offset = parts[0].length
  const code = parts.join('')
  tgpEditorHost().initDoc(filePath, code)
  const tgpModel = tgpModels[filePath] = new tgpModelForLangService(await getTgpModel(filePath))
  //TODO: add file path to tgp model
  const ctxForTest = ctx.setVars({forceLocalSuggestions: !remoteSuggestions})
  const inCompPos = offsetToLineCol(code,offset)
  tgpEditorHost().selectRange(inCompPos)
  const offsets = parts.reduce((acc,part) => [...acc, acc.pop()+part.length] , [0] ).slice(1,-1)

  return {testId, tgpModel, ctxForTest, code, inCompPos, offsets}
}

export const completionOptionsTest = Test('completionOptionsTest', {
  params: [
    {id: 'compText', as: 'string', description: 'use __ for completion points'},
    {id: 'expectedSelections', as: 'array', description: 'label a selection that should exist in the menu. one for each point'},
    {id: 'filePath', as: 'string', defaultValue: '/plugins/testers/ui-dsl/ui.js'},
    {id: 'dsl', as: 'string'}
  ],
  impl: dataTest({
    calculate: async (ctx,{},{compText,filePath,dsl})=> {
      const {ctxForTest, code, offsets} = await initCompletionText({ctx,compText,filePath,dsl})
      const offsetsPos = offsets.map(offset=>offsetToLineCol(code,offset))
      const acc = []
      await offsetsPos.reduce(async (pr, inCompPos) => {
        await pr
        tgpEditorHost().selectRange(inCompPos)
        const options = (await completionItems(ctxForTest)).items.map(x=>x.label)
        acc.push({options})
      }, Promise.resolve())
      return acc
    },
    expectedResult: ({data},{},{expectedSelections}) => {
      const errors = data.reduce((errors,{options},i) => {
        if (utils.path(options,'0') == 'reformat')
          return ['bad format']
        if (!options)
            return [`no options at index ${i}`]
        const res = options.includes(expectedSelections[i]) ? '' : ` ${expectedSelections[i]} not found at index ${i}`
        return [...errors,res]
      }, []).filter(x=>x).join(', ')
      return errors.match(/^-*$/) ? true : { testFailure: errors }
    },
    includeTestRes: true
  })
})
  
Test('completionActionTest', {
  type: 'test',
  params: [
    {id: 'compText', as: 'string', description: 'use __ for completion point'},
    {id: 'completionToActivate', as: 'string', dynamic: true, description: 'label of completion to activate', byName: true},
    {id: 'expectedEdit', description: '{ range: , newText:}'},
    {id: 'expectedTextAtSelection', description: '{ start: , end: }'},
    {id: 'expectedCursorPos', description: 'e.g. 1,12'},
    {id: 'filePath', as: 'string', defaultValue: '/plugins/testers/ui-dsl/ui.js'},
    {id: 'dsl', as: 'string'},
    {id: 'remoteSuggestions', as: 'boolean', type: 'boolean'}
  ],
  impl: dataTest({
    calculate: async (ctx,{}, {compText,completionToActivate, filePath, dsl, remoteSuggestions }) => {
        const {ctxForTest} = await initCompletionText({ctx,compText,filePath,dsl,remoteSuggestions})
        const {items} = await completionItems(ctxForTest)
        if (items.find(x=>x.label == 'reformat'))
            return { testFailure: `bad comp format` }

        const toActivate = completionToActivate(ctx.setData(items))
        const item = items.find(x=>x.label == toActivate)
        if (!item) 
          return { items: items.map(x=>x.label), toActivate }

        await applyCompChange(item.edit ? item : editAndCursorOfCompletionItem(item), {ctx})
        //applyCompChange(item,{ctx})
        await jb.delay(1) // wait for cursor change
        const {cursorLine, cursorCol } = host.compTextAndCursor()
        const actualCursorPos = [cursorLine, cursorCol].join(',')
        const actualEdit = lastEditForTester()
        //console.log(actualEdit)
        return {items: items.map(x=>x.label), item: item.label, actualEdit, actualCursorPos, toActivate}
    },
    expectedResult: ({data},{},{expectedEdit, expectedTextAtSelection, expectedCursorPos}) => {
      const {item,actualEdit,actualCursorPos, toActivate } = data
      if (!item)
        return { testFailure: `completion not found - ${toActivate}` }

      const editsSuccess = Object.keys(utils.objectDiff(actualEdit.edit,expectedEdit)).length == 0
      const selectionSuccess  = expectedTextAtSelection == null || host.getTextAtSelection() == expectedTextAtSelection
      const cursorPosSuccess = !expectedCursorPos || expectedCursorPos == actualCursorPos

      const testFailure = (editsSuccess ? '' : 'wrong expected edit') + 
          (selectionSuccess ? '' : `wrong expected selection "${expectedTextAtSelection}" instead of "${host.getTextAtSelection}"`) +
          (cursorPosSuccess ? '' : `wrong cursor pos ${actualCursorPos} instead of ${expectedCursorPos}`)

      return { testFailure }
    },
    includeTestRes: true
  })
})

Test('fixEditedCompTest', {
  params: [
    {id: 'compText', as: 'string', description: 'use __ for completion point'},
    {id: 'expectedFixedComp', as: 'string'},
    {id: 'filePath', as: 'string', defaultValue: '/plugins/testers/ui-dsl/ui.js'},
    {id: 'dsl', as: 'string'}
  ],
  impl: async (ctx,{compText,expectedFixedComp,filePath,dsl}) => {
      const {tgpModel, testId} = await initCompletionText({ctx,compText,filePath,dsl})
      const compsProps = calcProfileActionMap(host.compTextAndCursor(), {tgpModel})
      const formattedText = compsProps.formattedText
      const success = formattedText == expectedFixedComp
      const reason = !success && formattedText
      return { id: testId, title: testId, success, reason }
    }
})

Data('langService.dummyCompProps', {
  params: [
    {id: 'compText', as: 'string', mandatory: true, description: 'use __ for completion point'},
    {id: 'dsl', as: 'string'},
    {id: 'filePath', as: 'string', defaultValue: '/plugins/common/common-tests.js'},
    {id: 'includeCircuitOptions', as: 'boolean', type: 'boolean<>'}
  ],
  impl: async (ctx,{compText: _compText,dsl,_filePath, includeCircuitOptions}) => {
    const {tgpModel} = await initCompletionText({ctx,compText: _compText,filePath: _filePath,dsl})
    if (includeCircuitOptions)
      return calcCompProps(ctx,{includeCircuitOptions})
    const { compText, inCompOffset, shortId, cursorCol, cursorLine, compLine, filePath, lineText } = calcProfileActionMap(host.compTextAndCursor(), {tgpModel})
    return { compText, inCompOffset, shortId, cursorCol, cursorLine, compLine, filePath, lineText}
  }
})

Test('tgp.pathChangeTest', {
  params: [
    {id: 'path', as: 'string'},
    {id: 'action', type: 'action', dynamic: true},
    {id: 'expectedPathAfter', as: 'string'},
    {id: 'cleanUp', type: 'action', dynamic: true}
  ],
  impl: (ctx,{path,action,expectedPathAfter,cleanUp})=> {
    //st.initTests()

    const testId = ctx.vars.testID
    const failure = (part,reason) => ({ id: testId, title: testId + '- ' + part, success:false, reason: reason })
    const success = _ => ({ id: testId, title: testId, success: true })

    const pathRef = jb.tgp.ref(path)
    action()
    
    const res_path = pathRef.path().join('~')
    if (res_path != expectedPathAfter)
      var res = { id: testId, title: testId, success: false , reason: res_path + ' instead of ' + expectedPathAfter }
    else
      var res = { id: testId, title: testId, success: true }
    cleanUp()

    return res
  }
})
