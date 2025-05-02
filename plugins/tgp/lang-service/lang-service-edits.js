import { utils, Data } from '../../common/common-utils.js'
import { _calcCompProps, cloneProfile } from './lang-service.js'
import { prettyPrint } from '../formatter/pretty-print.js'
import { update } from '../../db/immutable.js'
import { tgpEditorHost, offsetToLineCol, calcProfileActionMap, deltaFileContent, filePosOfPath, calcHash, getPosOfPath } from '../text-editor/tgp-text-editor.js'
import { resolveCompArgs, isMacro}  from '../../core/jb-macro.js'


const deleteEdits = Data({ 
    impl: async ctx => {
        const compProps = await _calcCompProps(ctx)
        const { reformatEdits, text, comp, compLine, compId, errors, path, tgpModel, lineText } = compProps
        if (reformatEdits)
            return { errors: ['delete - bad format'], ...compProps }

        const pathAr = path.split('~').slice(1)
        const arrayElem = !isNaN(pathAr.slice(-1)[0])
        const indexInArray = arrayElem && +pathAr.slice(-1)[0]

        const opOnComp = {}
        if (arrayElem)
            utils.path(opOnComp,pathAr.slice(0, -1),{$splice: [[indexInArray,1]] })
        else
            utils.path(opOnComp,pathAr,{$set: null });

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
                return utils.logError('delete can not find path', { path })
            return { line: line + compLine, col }
        }
    }
})

const disableEdits = Data({ 
    impl: async ctx => {
        const compProps = await _calcCompProps(ctx)
        const { reformatEdits, text, comp, compLine, compId, errors, path, tgpModel, lineText } = compProps
        if (reformatEdits)
            return { errors: ['disable - bad format'], ...compProps }

        const pathAr = [...path.split('~').slice(1),'$disabled']
        const opOnComp = {}
        const toggleVal = utils.path(comp,pathAr) ? null : true
        utils.path(opOnComp,pathAr,{$set: toggleVal });

        const newComp = update(comp,opOnComp)
        resolveCompArgs(newComp,{tgpModel})
        const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
        const edit = deltaFileContent(text, newcompText , compLine)        
        return { edit, cursorPos: calcNewPos(newcompText), hash: calcHashNoTitle(text) }

        function calcNewPos(compText) {
            let { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel})
            return { line: line + compLine, col }
        }
    } 
})

const duplicateEdits = Data({ 
    impl: async ctx => {
        const compProps = await _calcCompProps(ctx)
        const { reformatEdits, text, shortId, comp, compLine, compId, errors, path, tgpModel, lineText } = compProps
        if (reformatEdits)
            return { errors: ['duplicate - not in array'], ...compProps }

        const pathAr = path.split('~').slice(1)
        const arrayElem = !isNaN(pathAr.slice(-1)[0])
        const indexInArray = arrayElem && +pathAr.slice(-1)[0]
        const opOnComp = {}
        if (arrayElem) {
            const toAdd = cloneProfile(utils.path(comp,pathAr))
            utils.path(opOnComp,pathAr.slice(0, -1),{$splice: [[indexInArray, 0, toAdd]] })    
            const newComp = update(comp,opOnComp)
            const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
            const edit = deltaFileContent(text, newcompText , compLine)
            utils.log('lang services duplicate', { edit, ...compProps })
            const targetPath = [compId,...pathAr.slice(0, -1),indexInArray+1].join('~')
            return { edit, cursorPos: calcNewPos(targetPath, newcompText), hash: calcHashNoTitle(text) }
        } else if (path.indexOf('~') == -1) { // duplicate component
            const noOfLines = (text.match(/\n/g) || []).length+1
            const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
            const edit = deltaFileContent('', newcompText, compLine+noOfLines)
            utils.log('lang services duplicate comp', { edit, ...compProps })
            return { edit, cursorPos: {line: compLine+noOfLines+1, col: 0}}
        }
        return { errors: ['duplicate - bad format'], ...compProps }

        function calcNewPos(path,compText) {
            let { line, col } = getPosOfPath(path, 'begin',{compText, tgpModel})
            if (!line && !col)
                return utils.logError('duplicate can not find target path', { path })
            return { line: line + compLine, col }
        }
    }
})

const createTestEdits = Data({ 
    impl: async ctx => {
        const compProps = await _calcCompProps(ctx)
        const { reformatEdits, text, shortId, compLine} = compProps
        if (reformatEdits)
            return { errors: ['createText - bad format'], ...compProps }

        const impl = `dataTest(${shortId}(), equals(''))`
        const newText = `\nTest('dataTest.${shortId}', {\n  impl: ${impl}\n})\n`        
        const noOfLines = (text.match(/\n/g) || []).length+1
        const edit = deltaFileContent('', newText, compLine+noOfLines)
        utils.log('lang services duplicate comp', { edit, ...compProps })
        return { edit, cursorPos: {line: compLine+noOfLines+1, col: 0}}
    }
})

const moveInArrayEdits = Data({
    params: [
        { id: 'diff', as: 'number', defaultValue: '%%' }
    ],
    impl: async (ctx, {diff}) => {
        const compProps = await _calcCompProps(ctx)
        const { reformatEdits, compId, compLine, actionMap, text, path, comp, tgpModel } = compProps
        if (!reformatEdits && actionMap) {
            const rev = path.split('~').slice(1).reverse()
            const indexOfElem = rev.findIndex(x => x.match(/^[0-9]+$/))
            if (indexOfElem != -1) {
                const elemPath = rev.slice(indexOfElem).reverse()
                const arrayPath = elemPath.slice(0, -1)
                const fromIndex = +elemPath.slice(-1)[0]
                const toIndex = fromIndex + diff
                const valToMove = utils.path(comp,elemPath)
                const op = {$splice: [[fromIndex,1],[toIndex,0,valToMove]] }

                const opOnComp = {}
                utils.path(opOnComp,arrayPath,op) // create opOnComp as nested object
                const newComp = update(comp,opOnComp)
                const newcompText = prettyPrint(newComp, { initialPath: compId, tgpModel })
                const edit = deltaFileContent(text, newcompText , compLine)
                utils.log('tgpTextEditor moveInArray', { op, edit, ...compProps })

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
                return utils.logError('moveInArray can not find path', { path })
            return { line: line + compLine, col }
        }
    }
})

function calcHashNoTitle(str) {
    return calcHash(str.split('\n').slice(1).join('\n'))
}

export const langServiceEdits = { deleteEdits, disableEdits, duplicateEdits, createTestEdits, moveInArrayEdits }