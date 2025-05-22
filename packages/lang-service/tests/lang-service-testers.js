import { langServiceUtils } from '@jb6/lang-service'
import { ns, dsls, coreUtils } from '@jb6/core'
import { } from './mock-workspace.js'

const { jb, resolveProfileArgs, prettyPrintWithPositions, calcTgpModelData, resolveProfileTypes, sortedArraysDiff, objectDiff, delay, ref } = coreUtils
const { langService } = ns
const { tgpEditorHost, tgpModelForLangService, tgpModels, calcCompProps, offsetToLineCol, applyCompChange, calcProfileActionMap} = langServiceUtils 

const { 
  test: { Test, 
    test: { dataTest }
  }, 
  common: { Data }
} = dsls

jb.langServiceTestRegistry = {
  uniqueNameCounter: 0,
}

async function getTgpModel(filePath) {
  filePath = filePath || '@jb6/testing'
  jb.langServiceRegistry.tgpModels[filePath] = jb.langServiceRegistry.tgpModels[filePath] 
     || new tgpModelForLangService(await calcTgpModelData({filePath}))
  const tgpModel = jb.langServiceRegistry.tgpModels[filePath]
  return tgpModel
}

async function initCompletionText({ctx,compText,filePath,remoteSuggestions}) {
  filePath = filePath || '@jb6/testing'
  const testId = ctx.vars.testID
  const fullText = compText.match(/^[a-z]+Test\(/) ? `Test('x', {\n  impl: ${compText}\n})` 
    : compText.match(/^[A-Z]/) ? compText
    : `Test('x', {\n  impl: uiTest(${compText})\n})`
  const parts = fixToUniqueName(fullText).split('__')
  const offset = parts[0].length
  const code = parts.join('')
  const host = tgpEditorHost()
  host.initDoc(filePath, code)
  const inCompPos = offsetToLineCol(code,offset)
  host.selectRange(inCompPos)
  const offsets = parts.reduce((acc,part) => [...acc, acc.pop()+part.length] , [0] ).slice(1,-1).map(offset=>offsetToLineCol(code,offset))
  const compTextAndCursor = host.compTextAndCursor()

  return {testId, compTextAndCursor, code, inCompPos, offsets, host, filePath }

  function fixToUniqueName(code) {
    const cmpId = 'CmpltnTst'+jb.langServiceTestRegistry.uniqueNameCounter++
    return code.replace(/Test\('x',/,`Test('${cmpId}',`)
  }
}

Data('calcCompTextAndCursor', {
  params: [
    {id: 'compText', as: 'string', mandatory: true, description: 'use __ for completion point'},
    {id: 'filePath', as: 'string'},
  ],
  impl: async (ctx,{compText, filePath}) => {
    const { compTextAndCursor } = await initCompletionText({ctx, compText, filePath })
    return compTextAndCursor
  }
})

Test('completionOptionsTest', {
  params: [
    {id: 'compText', as: 'string', description: 'use __ for completion points'},
    {id: 'expectedSelections', as: 'array', description: 'label a selection that should exist in the menu. one for each point'},
    {id: 'filePath', as: 'string' },
    {id: 'dsl', as: 'string'}
  ],
  impl: dataTest({
    calculate: async (ctx,{},{compText,filePath,dsl})=> {
      const {offsets, host} = await initCompletionText({ctx,compText,filePath,dsl})
      const acc = []
      await offsets.reduce(async (pr, inCompPos) => {
        await pr
        host.selectRange(inCompPos)
        const compTextAndCursor = host.compTextAndCursor()
        const options = (await langService.completionItems.$run({compTextAndCursor})).items.map(x=>x.label)
        acc.push({options})
      }, Promise.resolve())
      return acc
    },
    expectedResult: ({data},{},{expectedSelections}) => {
      const errors = data.reduce((errors,{options},i) => {
        if (options?.[0] == 'reformat')
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
  params: [
    {id: 'compText', as: 'string', description: 'use __ for completion point'},
    {id: 'completionToActivate', as: 'string', dynamic: true, description: 'label of completion to activate', byName: true},
    {id: 'expectedEdit', description: '{ range: , newText:}'},
    {id: 'expectedTextAtSelection', description: '{ start: , end: }'},
    {id: 'expectedCursorPos', description: 'e.g. 1,12'},
    {id: 'filePath', as: 'string'},
    {id: 'dsl', as: 'string'},
    {id: 'remoteSuggestions', as: 'boolean', type: 'boolean'}
  ],
  impl: dataTest({
    calculate: async (ctx,{}, {compText,completionToActivate, filePath, dsl, remoteSuggestions }) => {
        const { compTextAndCursor, host} = await initCompletionText({ctx,compText,filePath,dsl,remoteSuggestions})
        const {items} = await langService.completionItems.$run({compTextAndCursor})
        if (items.find(x=>x.label == 'reformat'))
            return { testFailure: `bad comp format` }

        const toActivate = completionToActivate(ctx.setData(items))
        const item = items.find(x=>x.label == toActivate)
        if (!item) 
          return { items: items.map(x=>x.label), toActivate }

        const edit = item.edit ? item : await langService.editAndCursorOfCompletionItem.$impl(ctx,{item})
        await applyCompChange(edit, {ctx})
        //applyCompChange(item,{ctx})
        await delay(1) // wait for cursor change
        const {cursorLine, cursorCol } = host.compTextAndCursor()
        const actualCursorPos = [cursorLine, cursorCol].join(',')
        const actualEdit = host.lastEdit()
        //console.log(actualEdit)
        return {items: items.map(x=>x.label), item: item.label, actualEdit, actualCursorPos, toActivate}
    },
    expectedResult: ({data},{},{expectedEdit, expectedTextAtSelection, expectedCursorPos}) => {
      const {item,actualEdit,actualCursorPos, toActivate } = data
      if (!item)
        return { testFailure: `completion not found - ${toActivate}` }

      const host = tgpEditorHost()
      const editsSuccess = Object.keys(objectDiff(actualEdit.edit,expectedEdit)).length == 0
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

// Test('fixEditedCompTest', {
//   params: [
//     {id: 'compText', as: 'string', description: 'use __ for completion point'},
//     {id: 'expectedFixedComp', as: 'string'},
//     {id: 'filePath', as: 'string'},
//     {id: 'dsl', as: 'string'}
//   ],
//   impl: async (ctx,{compText,expectedFixedComp,filePath,dsl}) => {
//       const {tgpModel, testId, compTextAndCursor} = await initCompletionText({ctx,compText,filePath,dsl})
//       const compsProps = calcProfileActionMap(compTextAndCursor.compText, {tgpModel})
//       const formattedText = compsProps.formattedText
//       const success = formattedText == expectedFixedComp
//       const reason = !success && formattedText
//       return { id: testId, title: testId, success, reason }
//     }
// })

// Data('dummyCompProps', {
//   params: [
//     {id: 'compText', as: 'string', mandatory: true, description: 'use __ for completion point'},
//     {id: 'dsl', as: 'string'},
//     {id: 'filePath', as: 'string'},
//     {id: 'includeCircuitOptions', as: 'boolean', type: 'boolean<common>'}
//   ],
//   impl: async (ctx,{compText: _compText,dsl, filePath: _filePath, includeCircuitOptions}) => {
//     const {tgpModel, compTextAndCursor, filePath } = await initCompletionText({ctx,compText: _compText, filePath: _filePath ,dsl})
//     if (includeCircuitOptions)
//       return calcCompProps(ctx,{includeCircuitOptions})
//     const { inCompOffset, shortId, cursorCol, cursorLine, compLine, lineText, compText } = calcProfileActionMap(compTextAndCursor.compText, {tgpModel})
//     return { compText, inCompOffset, shortId, cursorCol, cursorLine, compLine, filePath, lineText}
//   }
// })

Test('pathChangeTest', {
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

    const pathRef = ref(path)
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

Test('actionMapTest', {
  macroByValue: true,
  params: [
    {id: 'profile' },
    {id: 'expectedType', as: 'string'},
    {id: 'path', as: 'string'},
    {id: 'expectedPos', as: 'string'}
  ],
  impl: dataTest({
    calculate: ({},{},{profile, expectedType}) => getTgpModel().then(tgpModel => {
      const { text, actionMap } =  (typeof profile != 'string') ? prettyPrintActionMap() : { text: profile, actionMap: []}
      const actionMapFromParse = calcProfileActionMap(text, {tgpModel, tgpType: expectedType} ).actionMap
        .map(e=>({from: e.from, to: e.to,action: e.action, source: e.source})) // for debug to match actionMap
      return { actionMap, actionMapFromParse, compText: text }

      function prettyPrintActionMap() {
        const topComp = resolveProfileArgs(profile, {expectedType})
        resolveProfileTypes(topComp, {tgpModel, expectedType, topComp})
        return prettyPrintWithPositions(topComp, {tgpModel})      }
    }),
    expectedResult: ({ data : {actionMap, actionMapFromParse, compText}},{},{expectedPos,path}) => {
        const compareActions = (a, b) => a.from - b.from || a.to - b.to || a.action.localeCompare(b.action)
        actionMap.sort(compareActions)
        actionMapFromParse.sort(compareActions)
        const diff = sortedArraysDiff(actionMap,actionMapFromParse,compareActions)
        ;[...diff.inserted, ...diff.deleted].forEach(e => { e.before = compText.slice(0,e.from); e.text = compText.slice(e.from,e.to) })
        let error = ''
//        const actualDiff = [...diff.deleted.filter(x=>x.text !="'" || !x.action.startsWith('addProp!')), ...diff.inserted]
        // if (actualDiff.length)
        //   console.log('actionMapTest diffs',diff)
        const items = actionMapFromParse.filter(x=>x.action == path).map(x=>`${x.from},${x.to}`)
        error = error || (items.length ? '' : `path not found ${path}`)
        error = error || (items.includes(expectedPos) ? '' : `pos ${items.join(';')} instead of ${expectedPos}`)
        return error ? { testFailure: error } : true
    },
    includeTestRes: true,
    timeout: 1000
  })
})