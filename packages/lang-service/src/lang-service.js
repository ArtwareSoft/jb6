import { coreUtils, dsls } from '@jb6/core'
import { update } from '../lib/immutable.js'

const { jb, resolveCompArgs, prettyPrint, prettyPrintComp, isPrimitiveValue, logError, calcPath, compByFullId, parentPath, unique, calcHash, splitDslType, calcExpectedDslsSection } = coreUtils
const { calcCompProps, cloneProfile, deltaFileContent, provideCompletionItems, filePosOfPath, getPosOfPath, tgpEditorHost, tgpModelForLangService } = jb.langServiceUtils
const { calcTgpModelData } = coreUtils

const {
   common: { Data }
} = dsls


Data('langService.completionItems', {
    params: [
        { id: 'compTextAndCursor', defaultValue: '%%' }
    ],
    impl: async (ctx, {}, { compTextAndCursor }) => {
        const _compTextAndCursor = compTextAndCursor ? await compTextAndCursor : tgpEditorHost().compTextAndCursor()
        const { dslsSection, compText, compPos, cursorLine, cursorCol, filePath } = _compTextAndCursor

        if (dslsSection) {
            return dslsSectionCompletion({compText, compPos, cursorLine, cursorCol, filePath, ctx})
        }

        const compProps = await calcCompProps(_compTextAndCursor, ctx)
        const { actionMap, errors, cursorPos, compId, tgpModel, comp, error } = compProps
        let items = [], title = '', paramDef

        if (actionMap) {
            ({items, paramDef} = await provideCompletionItems(compProps, ctx))
            items.forEach((item, i) => Object.assign(item, {
                compPos, insertText: '', sortText: '!' + String(i).padStart(3, '0'), command: { command: 'jbart.applyCompChangeOfCompletionItem',
                arguments: [{...item}]
            },
            }))
            title = paramDef && `${paramDef.id}: ${(paramDef.$dslType||'').replace('<>','')}`
            ctx.vars.langServiceLogger?.info?.({
                t: 'completion items', labels: items.map(x => x.label), path: compProps.path,
                compId, dslType: comp?.$dslType, filePath
            }, {}, {ctx})
        } else if (errors) {
            logError('completion provideCompletionItems', {errors, compProps})
            items = [ {
                kind: 4, label: (errors[0]||'').toString(), sortText: '!!01',
            }]
            title = prettyPrint(errors)
        }

        const formattedCompText = !error && !comp?.syntaxError && prettyPrintComp(comp, {initialPath: compId, tgpModel, filePath, compDef: compProps.compDef})
        ctx.vars.langServiceLogger?.info?.({
            t: 'lang service formatted comp', sourceHeader: compText.match(/^\s*([\w$]+)/)?.[1],
            formattedHeader: formattedCompText?.match(/^\s*([\w$]+)/)?.[1], compId,
            dslType: comp?.$dslType, compDef: compProps.compDef?.capitalLetterId, changed: formattedCompText != compText
        }, {}, {ctx})
        if (formattedCompText && formattedCompText != compText) {
            const reformatEdits = deltaFileContent(compText, formattedCompText , compPos)
            const item = {
                kind: 4, id: 'reformat', insertText: '', label: '🔄 reformat', sortText: '!!01', edit: reformatEdits,
                command: { command: 'jbart.applyCompChangeOfCompletionItem', arguments: [{ edit: reformatEdits, cursorPos }] },
            }
            title = 'reformat'
            items.unshift(item)
        }
        return { items, title, paramDef, errors }
    }
})

async function dslsSectionCompletion({compText, compPos, cursorLine, cursorCol, filePath, ctx}) {
    // Ensure tgpModel is loaded
    if (!jb.langServiceRegistry.tgpModels[filePath]) {
        jb.langServiceRegistry.tgpModels[filePath] = await calcTgpModelData({entryPointPaths: filePath}, ctx)
            .then(v => new tgpModelForLangService(v))
    }
    const tgpModel = jb.langServiceRegistry.tgpModels[filePath]
    if (!tgpModel) return { items: [], title: 'dsls section' }

    const expectedDslsSection = await calcExpectedDslsSection(tgpModel, filePath)
    let items = [], title = 'dsls section'

    if (expectedDslsSection && expectedDslsSection != compText) {
        const reformatEdits = deltaFileContent(compText, expectedDslsSection, compPos)
        const cursorPos = { line: cursorLine, col: cursorCol }
        const item = {
            kind: 4, id: 'reformat', insertText: '', label: '🔄 reformat dsls', sortText: '!!01', edit: reformatEdits,
            command: { command: 'jbart.applyCompChangeOfCompletionItem', arguments: [{ edit: reformatEdits, cursorPos }] },
        }
        title = 'reformat dsls'
        items.push(item)
    }
    return { items, title }
}

Data('langService.compReferences', {
    params: [
        { id: 'compTextAndCursor', defaultValue: '%%' }
    ],
    impl: async (ctx, {}, { compTextAndCursor }) => {    
        const compProps = await calcCompProps(compTextAndCursor, ctx)
        const { compId: PTToSearch, prop } = PTInPath(compProps)
        const { filePath } = compProps
        const tgpModel = jb.langServiceRegistry.tgpModels[filePath]
        // todo: scan files for references - TGP model does not have impl part
        const paths = Object.entries(tgpModel.comps()).flatMap(([id,comp])=>scanForPT(comp,id))
        return paths.map(path=>filePosOfPath(path, {tgpModel}))

        function scanForPT(profile,path) {
            if (!profile || isPrimitiveValue(profile) || typeof profile == 'function') return []
            const found = profile.$$ == PTToSearch
            const res = [path,prop].filter(Boolean).join('~')
            return [ 
                ...(found ? [res] : []),
                ...Object.keys(profile).flatMap(k=>scanForPT(profile[k],`${path}~${k}`))
            ]
        }

        function PTInPath(compProps) {
            const { actionMap, inCompOffset, tgpModel, path, comp } = compProps
    
            const actions = actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
                .map(e => e.action).filter(e => e.indexOf('edit!') != 0 && e.indexOf('begin!') != 0 && e.indexOf('end!') != 0)
            if (actions.length == 0 && comp) 
                return { compId: comp.id}
            if (actions.length == 0) return {}
            const priorities = ['addProp']
            const sortedActions = unique(actions).map(action=>action.split('!')).sort((a1,a2) => priorities.indexOf(a2[0]) - priorities.indexOf(a1[0]))
            if (sortedActions[0] && sortedActions[0][0] == 'propInfo') 
                return { compId: tgpModel.compIdOfPath(parentPath(path)), prop: path.split('~').pop() }
            return { compId: path && (path.match(/~/) ? tgpModel.compIdOfPath(path) : path) }
        }
    }
})

Data('langService.definition', {
    params: [
        { id: 'compTextAndCursor', defaultValue: '%%' }
    ],
    impl: async (ctx, {}, { compTextAndCursor }) => {
        const compProps = await calcCompProps(compTextAndCursor, ctx)
        const { errors, tgpModel, path } = compProps
        const cmpId = path && tgpModel.compIdOfPath(path)
        if (cmpId)
            return compByFullId(cmpId, tgpModel)?.$location
        if (errors) {
            logError('langService definition', {errors, ctx,compProps})
            return compProps
        }
    }
})

Data('langService.calcCompProps', {
  params: [
    {id: 'compTextAndCursor', defaultValue: '%%'}
  ],
  impl: (ctx, {}, { compTextAndCursor }) => calcCompProps(compTextAndCursor, ctx)
})

Data('langService.calcTgpCompChange', {
  description: 'Calculate a safe TGP component source change for MCP before applying it through tgpEditorHost',
  params: [
    {id: 'tgpPath', as: 'string', asIs: true, mandatory: true},
    {id: 'profileText', as: 'text', asIs: true, mandatory: true},
    {id: 'existingProfileText', as: 'text', asIs: true, mandatory: true}
  ],
  impl: async (ctx, {}, {tgpPath, profileText, existingProfileText}) => {
    const repoRoot = await coreUtils.calcRepoRoot()
    const modelData = await calcTgpModelData({entryPointPaths: await coreUtils.resolveDeveloperEntryPoint(ctx)}, ctx)
    const tgpModel = new tgpModelForLangService(modelData)
    const ownerCompId = tgpPath.split('~')[0], innerPath = tgpPath.split('~').slice(1)
    const firstNonWhitespaceDiff = (currentValue, expectedValue) => {
      const current = currentValue.replace(/\s/g, ''), expected = expectedValue.replace(/\s/g, '')
      let offset = 0
      while (current[offset] == expected[offset] && offset < current.length && offset < expected.length) offset++
      if (offset == current.length && offset == expected.length) return
      const contextFrom = Math.max(0, offset - 30), contextTo = offset + 31
      const pointer = ' '.repeat(offset - contextFrom) + '^'
      return `existingProfileText mismatch at non-whitespace offset ${offset}\ncurrent  ${current.slice(contextFrom, contextTo)}\nexpected ${expected.slice(contextFrom, contextTo)}\n         ${pointer}`
    }
    const current = compByFullId(ownerCompId, tgpModel)
    if (!current) throw new Error(`component '${ownerCompId}' not found`)
    const {readFile} = await import('fs/promises')
    const {importMap, staticMappings} = await coreUtils.calcImportData({forRepo: repoRoot})
    const sourceLocation = current.$location
    const path = coreUtils.resolveWithImportMap(sourceLocation.path, importMap, staticMappings) || sourceLocation.path
    const source = await readFile(path, 'utf8')
    const from = jb.langServiceUtils.lineColToOffset(source, sourceLocation)
    const to = jb.langServiceUtils.lineColToOffset(source, sourceLocation.to)
    const currentText = source.slice(from, to)
    const compProps = jb.langServiceUtils.calcProfileActionMap(currentText, {tgpModel, filePath: path, ctx})
    if (!compProps.comp || compProps.error || compProps.comp.syntaxError)
      throw new Error(compProps.error?.syntaxError || compProps.error || compProps.comp?.syntaxError || 'Invalid current TGP component')

    let proposedProfile
    if (innerPath.length) {
      const paramType = tgpModel.paramType(tgpPath)
      const expectedType = paramType?.startsWith('$asParent')
        ? innerPath.length == 1 ? compProps.comp.$dslType : tgpModel.compOfPath(parentPath(tgpPath))?.$dslType
        : paramType
      if (!expectedType) throw new Error(`can not resolve expected type at '${tgpPath}'`)
      const parsedProfile = jb.langServiceUtils.calcProfileActionMap(profileText, {tgpType: expectedType, tgpModel, filePath: path, ctx})
      if (!parsedProfile.comp || parsedProfile.error || parsedProfile.comp.syntaxError)
        throw new Error(parsedProfile.error?.syntaxError || parsedProfile.error || parsedProfile.comp?.syntaxError || 'Invalid TGP profile')
      proposedProfile = parsedProfile.comp
      if (existingProfileText != null) {
        const exactAction = compProps.actionMap.find(({action}) => action == `function!${tgpPath}`)
        const begin = compProps.actionMap.find(({action}) => action == `begin!${tgpPath}`)
        const end = compProps.actionMap.find(({action}) => action == `end!${tgpPath}`)
        const currentProfileText = exactAction ? currentText.slice(exactAction.from, exactAction.to)
          : begin && end ? currentText.slice(begin.from, end.to) : null
        if (currentProfileText == null) throw new Error(`source span not found for '${tgpPath}'`)
        const mismatch = firstNonWhitespaceDiff(currentProfileText, existingProfileText)
        if (mismatch) throw new Error(mismatch)
      }
    } else {
      const parsedComp = jb.langServiceUtils.calcProfileActionMap(profileText, {tgpModel, filePath: path, ctx})
      if (!parsedComp.comp || parsedComp.error || parsedComp.comp.syntaxError)
        throw new Error(parsedComp.error?.syntaxError || parsedComp.error || parsedComp.comp?.syntaxError || 'Invalid TGP component')
      if (parsedComp.compId != ownerCompId)
        throw new Error(`component id mismatch: expected '${ownerCompId}', found '${parsedComp.compId}'`)
      proposedProfile = parsedComp.comp
      const mismatch = firstNonWhitespaceDiff(currentText, existingProfileText)
      if (mismatch) throw new Error(mismatch)
    }

    const opOnComp = {}
    if (innerPath.length) calcPath(opOnComp, innerPath, {$set: proposedProfile})
    const newComp = innerPath.length ? update(compProps.comp, opOnComp) : proposedProfile
    resolveCompArgs(newComp, {tgpModel})
    const formattedTgpComp = prettyPrintComp(newComp,
      {initialPath: ownerCompId, tgpModel, filePath: path, compDef: compProps.compDef})
    const formattedTgpProfile = innerPath.length
      ? prettyPrint(calcPath(newComp, innerPath), {initialPath: tgpPath, tgpModel, filePath: path})
      : formattedTgpComp
    return {
      path,
      source,
      compChange: deltaFileContent(currentText, formattedTgpComp, sourceLocation),
      formattedTgpProfile
    }
  }
})

Data('langService.editAndCursorOfCompletionItem', {
  params: [
    {id: 'item'}
  ],
  impl: async (ctx, {}, {item}) => {
    if (item.edit) return item
    if (!item.compProps) return {}
    const { text, compId, comp, compPos, tgpModel, filePath } = item.compProps
    const itemProps = item.extend ? { ...item, ...item.extend() } : item
    const { op, path, resultPath, whereToLand } = itemProps

    const opOnComp = {}
    calcPath(opOnComp,path.split('~').slice(1),op) // create op as nested object
    const newComp = update(comp,opOnComp)
    resolveCompArgs(newComp,{tgpModel})
    const newcompText = prettyPrintComp(newComp, {initialPath: compId, tgpModel, filePath, compDef: item.compProps.compDef})
    const edit = deltaFileContent(text, newcompText , compPos)

    const cursorPos = itemProps.cursorPos || calcNewPos(newcompText)
    return { edit, cursorPos }

    function calcNewPos(compText) {
        const op = itemProps.op?.$set
        const propWithEmptyVal = Object.entries(op || {}).find(x=>x[1] == '')?.[0]
        const TBD = item.compId == '' || propWithEmptyVal
        const _whereToLand = TBD ? ['insideText','prependPT'] : [whereToLand || 'edit']
        const innerProp = item.compId && TBD ? propWithEmptyVal : null
        const expectedPath = innerProp ? [path,innerProp].join('~') : (resultPath || path)
        const posResult = getPosOfPath(expectedPath, [..._whereToLand, 'begin', 'prependPT','appendPT'], {compText, tgpModel})
        const { line, col } = posResult
        return { TBD, line: line + compPos.line, col }
    }
  }
})

Data('langService.deleteEdits', { 
    params: [
        { id: 'compTextAndCursor', defaultValue: '%%' }
    ],
    impl: async (ctx, {}, { compTextAndCursor }) => {
        const compProps = await calcCompProps(compTextAndCursor, ctx)
        const { reformatEdits, text, comp, compPos, compId, filePath, path, tgpModel, lineText } = compProps
        if (reformatEdits)
            return { errors: ['delete - bad format'], ...compProps }

        const pathAr = path.split('~').slice(1)
        const arrayElem = !isNaN(pathAr.slice(-1)[0])
        const indexInArray = arrayElem && +pathAr.slice(-1)[0]

        const opOnComp = {}
        if (arrayElem)
            calcPath(opOnComp,pathAr.slice(0, -1),{$splice: [[indexInArray,1]] })
        else
            calcPath(opOnComp,pathAr,{$set: null });

        const newComp = update(comp,opOnComp)
        resolveCompArgs(newComp,{tgpModel})
        const newcompText = prettyPrintComp(newComp, {initialPath: compId, tgpModel, filePath, compDef: compProps.compDef})
        const edit = deltaFileContent(text, newcompText , compPos)
        
        return { edit, cursorPos: calcNewPos(newcompText), hash: calcHashNoTitle(text) }

        function calcNewPos(compText) {
            let { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel})
            if (!line && !col) {
                let { line, col } = getPosOfPath(parentPath(path), 'begin',{compText, tgpModel})
            }
            if (!line && !col)
                return logError('delete can not find path', { path })
            return { line: line + compPos.line, col }
        }
    }
})

Data('langService.duplicateEdits', { 
    params: [
        { id: 'compTextAndCursor', defaultValue: '%%' }
    ],
    impl: async (ctx, {}, { compTextAndCursor }) => {
        const compProps = await calcCompProps(compTextAndCursor, ctx)
        const { reformatEdits, text, shortId, comp, compPos, compId, filePath, path, tgpModel, lineText } = compProps
        if (reformatEdits)
            return { errors: ['duplicate - not in array'], ...compProps }

        const pathAr = path.split('~').slice(1)
        const arrayElem = !isNaN(pathAr.slice(-1)[0])
        const indexInArray = arrayElem && +pathAr.slice(-1)[0]
        const opOnComp = {}
        if (arrayElem) {
            const toAdd = cloneProfile(calcPath(comp,pathAr))
            calcPath(opOnComp,pathAr.slice(0, -1),{$splice: [[indexInArray, 0, toAdd]] })    
            const newComp = update(comp,opOnComp)
            const newcompText = prettyPrintComp(newComp, {initialPath: compId, tgpModel, filePath, compDef: compProps.compDef})
            const edit = deltaFileContent(text, newcompText , compPos)
            ctx.vars.langServiceLogger?.info?.({t: 'lang services duplicate', edit, ...compProps}, {}, {ctx})
            const targetPath = [compId,...pathAr.slice(0, -1),indexInArray+1].join('~')
            return { edit, cursorPos: calcNewPos(targetPath, newcompText), hash: calcHashNoTitle(text) }
        } else if (path.indexOf('~') == -1) { // duplicate component
            const noOfLines = (text.match(/\n/g) || []).length+1
            const newcompText = prettyPrintComp(newComp, {initialPath: compId, tgpModel, filePath, compDef: compProps.compDef})
            const edit = deltaFileContent('', newcompText, compPos+noOfLines)
            ctx.vars.langServiceLogger?.info?.({t: 'lang services duplicate comp', edit, ...compProps}, {}, {ctx})
            return { edit, cursorPos: {line: compPos+noOfLines+1, col: 0}}
        }
        return { errors: ['duplicate - bad format'], ...compProps }

        function calcNewPos(path,compText) {
            let { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel})
            if (!line && !col)
                return logError('duplicate can not find target path', { path })
            return { line: line + compPos.line, col }
        }
    }
})

Data('langService.createTestEdits', { 
    params: [
        { id: 'compTextAndCursor', defaultValue: '%%' }
    ],
    impl: async (ctx, {}, { compTextAndCursor }) => {
        const compProps = await calcCompProps(compTextAndCursor, ctx)
        const { reformatEdits, text, shortId, compPos} = compProps
        if (reformatEdits)
            return { errors: ['createText - bad format'], ...compProps }

        const impl = `dataTest(${shortId}(), equals(''))`
        const newText = `\nTest('dataTest.${shortId}', {\n  impl: ${impl}\n})\n`        
        const noOfLines = (text.match(/\n/g) || []).length+1
        const edit = deltaFileContent('', newText, {line: compPos.line +noOfLines, col: 0})
        ctx.vars.langServiceLogger?.info?.({t: 'lang services create test', edit, ...compProps}, {}, {ctx})
        return { edit, cursorPos: {line: compPos.line+noOfLines+1, col: 0}}
    }
})

Data('langService.moveInArrayEdits', {
    params: [
        { id: 'diff', as: 'number', defaultValue: '%%' },
        { id: 'compTextAndCursor' }
    ],
    impl: async (ctx, {}, {diff, compTextAndCursor}) => {
        const compProps = await calcCompProps(compTextAndCursor, ctx)
        const { reformatEdits, compId, compPos, actionMap, text, path, comp, tgpModel, filePath } = compProps
        if (!reformatEdits && actionMap) {
            const rev = path.split('~').slice(1).reverse()
            const indexOfElem = rev.findIndex(x => x.match(/^[0-9]+$/))
            if (indexOfElem != -1) {
                const elemPath = rev.slice(indexOfElem).reverse()
                const arrayPath = elemPath.slice(0, -1)
                const fromIndex = +elemPath.slice(-1)[0]
                const toIndex = fromIndex + diff
                const valToMove = calcPath(comp,elemPath)
                const op = {$splice: [[fromIndex,1],[toIndex,0,valToMove]] }

                const opOnComp = {}
                calcPath(opOnComp,arrayPath,op) // create opOnComp as nested object
                const newComp = update(comp,opOnComp)
                const newcompText = prettyPrintComp(newComp, {initialPath: compId, tgpModel, filePath, compDef: compProps.compDef})
                const edit = deltaFileContent(text, newcompText , compPos)
                ctx.vars.langServiceLogger?.info?.({t: 'tgpTextEditor moveInArray', op, edit, ...compProps}, {}, {ctx})

                const origPath = compProps.path.split('~')
                const index = origPath.length - indexOfElem
                const to = [...origPath.slice(0,index-1),toIndex,...origPath.slice(index)].join('~')

                return { edit, cursorPos: calcNewPos(to, newcompText) }
            }
        }
        return { errors: ['moveInArray - array elem was not found'], ...compProps }

        function calcNewPos(path, compText) {
            const { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel, filePath})
            if (!line && !col)
                return logError('moveInArray can not find path', { path })
            return { line: line + compPos.line, col }
        }
    }
})

function calcHashNoTitle(str) {
    return calcHash(str.split('\n').slice(1).join('\n'))
}
