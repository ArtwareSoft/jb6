import { coreUtils, dsls } from '../../core/all.js'
import { utils } from '../../common/common-utils.js'
import { update } from '../../db/immutable.js'
import {} from '../formatter/pretty-print.js'
import { langServiceUtils } from './lang-service-utils.js'
export { langServiceUtils } 

const { jb, resolveCompArgs, prettyPrint, isPrimitiveValue, logError, log, calcPath, compByFullId, parentPath, unique } = coreUtils
const { calcCompProps, cloneProfile, deltaFileContent, provideCompletionItems, filePosOfPath, getPosOfPath, calcHash } = langServiceUtils

const { 
   common: { Data }
} = dsls


Data('langService.completionItems', {
    impl: async (ctx) => {
        const compProps = await calcCompProps(ctx)
        const { actionMap, reformatEdits, compLine, errors, cursorPos } = compProps
        let items = [], title = '', paramDef
        if (reformatEdits) {
            const item = {
                kind: 4, id: 'reformat', insertText: '', label: 'reformat', sortText: '0001', edit: reformatEdits,
                command: { command: 'jbart.applyCompChangeOfCompletionItem', arguments: [{ edit: reformatEdits, cursorPos }] },
            }
            title = 'bad format'
            items = [item]
        } else if (actionMap) {
            ({items, paramDef} = await provideCompletionItems(compProps, ctx))
            items.forEach((item, i) => Object.assign(item, {
                compLine, insertText: '', sortText: ('0000' + i).slice(-4), command: { command: 'jbart.applyCompChangeOfCompletionItem', 
                arguments: [item] 
            },
            }))
            title = paramDef && `${paramDef.id}: ${(paramDef.$dslType||'').replace('<>','')}`
            log('completion items', { items, ...compProps, ctx })
        } else if (errors) {
            logError('completion provideCompletionItems', {errors, compProps})
            items = [ {
                kind: 4, label: (errors[0]||'').toString(), sortText: '0001',
            }]
            title = prettyPrint(errors)
        }
        return { items, title, paramDef, errors }
    }
})

Data('langService.compId', {
    impl: async (ctx) => {    
        const compProps = await calcCompProps(ctx)
        const { reformatEdits, actionMap, inCompOffset, tgpModel, path, comp } = compProps
        if (reformatEdits)
            return { errors: ['compId - bad format'], ...compProps }

        const actions = actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
            .map(e => e.action).filter(e => e.indexOf('edit!') != 0 && e.indexOf('begin!') != 0 && e.indexOf('end!') != 0)
        if (actions.length == 0 && comp) 
            return { comp: comp.id}
        if (actions.length == 0) return []
        const priorities = ['addProp']
        const sortedActions = unique(actions).map(action=>action.split('!')).sort((a1,a2) => priorities.indexOf(a2[0]) - priorities.indexOf(a1[0]))
        if (sortedActions[0] && sortedActions[0][0] == 'propInfo') 
            return { comp: tgpModel.compIdOfPath(parentPath(path)), prop: path.split('~').pop() }
        return { comp: path && (path.match(/~/) ? tgpModel.compIdOfPath(path) : path) }
    }
})

Data('langService.compReferences', {
    impl: async (ctx) => {    
        const { comp, prop, reformatEdits, tgpModel } = ctx.data
        if (reformatEdits)
            return [{...ctx.data}]
        const paths = tgpModel.comps().flatMap(comp=>scanForPath(comp,comp.id || ''))
        return paths.map(path=>filePosOfPath(path, tgpModel))

        function scanForPath(profile,path) {
            if (!profile || isPrimitiveValue(profile) || typeof profile == 'function') return []
            const found = compByFullId(profile.$$, tgpModel)?.$$ == comp
            const res = [path,prop].filter(Boolean).join('~')
            return [ 
                ...(found ? [res] : []),
                ...Object.keys(profile).flatMap(k=>scanForPath(profile[k],`${path}~${k}`))
            ]
        }
    }
})

Data('langService.definition', {
    impl: async (ctx) => {
        const compProps = await calcCompProps(ctx)
        const { errors, tgpModel, path } = compProps
        const cmpId = tgpModel.compIdOfPath(path)
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
    {id: 'includeCircuitOptions', as: 'boolean', type: 'boolean<common>', byName: true}
  ],
  impl: (ctx,{includeCircuitOptions}) => calcCompProps(ctx,{includeCircuitOptions})
})

Data('langService.editAndCursorOfCompletionItem', {
  params: [
    {id: 'item'}
  ],
  impl: async (ctx,{item}) => {
    if (item.edit) return item
    const { text, compId, comp, compLine, tgpModel } = item.compProps
    const itemProps = item.extend ? { ...item, ...item.extend() } : item
    const { op, path, resultPath, whereToLand } = itemProps

    const opOnComp = {}
    calcPath(opOnComp,path.split('~').slice(1),op) // create op as nested object
    const newComp = update(comp,opOnComp)
    resolveCompArgs(newComp,{tgpModel})
    const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
    const edit = deltaFileContent(text, newcompText , compLine)

    const cursorPos = itemProps.cursorPos || calcNewPos(newcompText)
    return { edit, cursorPos }

    function calcNewPos(compText) {
        const TBD = item.compId == 'any<tgp>TBD' || calcPath(itemProps, 'op.$set.$$') == 'any<tgp>TBD'
        const _whereToLand = TBD ? 'begin' : (whereToLand || 'edit')
        const expectedPath = resultPath || path
        const { line, col } = getPosOfPath(expectedPath, [_whereToLand,'prependPT','appendPT'], {compText, tgpModel})
        return { TBD, line: line + compLine, col }
    }    
  }
})

Data('langService.deleteEdits', { 
    impl: async ctx => {
        const compProps = await calcCompProps(ctx)
        const { reformatEdits, text, comp, compLine, compId, errors, path, tgpModel, lineText } = compProps
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
        const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
        const edit = deltaFileContent(text, newcompText , compLine)
        
        return { edit, cursorPos: calcNewPos(newcompText), hash: calcHashNoTitle(text) }

        function calcNewPos(compText) {
            let { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel})
            if (!line && !col) {
                let { line, col } = getPosOfPath(utils.parentPath(path), 'begin',{compText, tgpModel})
            }
            if (!line && !col)
                return logError('delete can not find path', { path })
            return { line: line + compLine, col }
        }
    }
})

Data('langService.duplicateEdits', { 
    impl: async ctx => {
        const compProps = await calcCompProps(ctx)
        const { reformatEdits, text, shortId, comp, compLine, compId, errors, path, tgpModel, lineText } = compProps
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
            const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
            const edit = deltaFileContent(text, newcompText , compLine)
            log('lang services duplicate', { edit, ...compProps })
            const targetPath = [compId,...pathAr.slice(0, -1),indexInArray+1].join('~')
            return { edit, cursorPos: calcNewPos(targetPath, newcompText), hash: calcHashNoTitle(text) }
        } else if (path.indexOf('~') == -1) { // duplicate component
            const noOfLines = (text.match(/\n/g) || []).length+1
            const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
            const edit = deltaFileContent('', newcompText, compLine+noOfLines)
            log('lang services duplicate comp', { edit, ...compProps })
            return { edit, cursorPos: {line: compLine+noOfLines+1, col: 0}}
        }
        return { errors: ['duplicate - bad format'], ...compProps }

        function calcNewPos(path,compText) {
            let { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel})
            if (!line && !col)
                return logError('duplicate can not find target path', { path })
            return { line: line + compLine, col }
        }
    }
})

Data('langService.createTestEdits', { 
    impl: async ctx => {
        const compProps = await calcCompProps(ctx)
        const { reformatEdits, text, shortId, compLine} = compProps
        if (reformatEdits)
            return { errors: ['createText - bad format'], ...compProps }

        const impl = `dataTest(${shortId}(), equals(''))`
        const newText = `\nTest('dataTest.${shortId}', {\n  impl: ${impl}\n})\n`        
        const noOfLines = (text.match(/\n/g) || []).length+1
        const edit = deltaFileContent('', newText, compLine+noOfLines)
        log('lang services duplicate comp', { edit, ...compProps })
        return { edit, cursorPos: {line: compLine+noOfLines+1, col: 0}}
    }
})

Data('langService.moveInArrayEdits', {
    params: [
        { id: 'diff', as: 'number', defaultValue: '%%' }
    ],
    impl: async (ctx, {diff}) => {
        const compProps = await calcCompProps(ctx)
        const { reformatEdits, compId, compLine, actionMap, text, path, comp, tgpModel } = compProps
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
                const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
                const edit = deltaFileContent(text, newcompText , compLine)
                log('tgpTextEditor moveInArray', { op, edit, ...compProps })

                const origPath = compProps.path.split('~')
                const index = origPath.length - indexOfElem
                const to = [...origPath.slice(0,index-1),toIndex,...origPath.slice(index)].join('~')

                return { edit, cursorPos: calcNewPos(to, newcompText) }
            }
        }
        return { errors: ['moveInArray - array elem was not found'], ...compProps }

        function calcNewPos(path, compText) {
            const { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel})
            if (!line && !col)
                return logError('moveInArray can not find path', { path })
            return { line: line + compLine, col }
        }
    }
})

function calcHashNoTitle(str) {
    return calcHash(str.split('\n').slice(1).join('\n'))
}

