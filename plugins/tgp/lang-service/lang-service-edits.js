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
        const newRes = prettyPrintWithPositions(newComp, { initialPath: compId, tgpModel })
        const edit = deltaFileContent(text, newRes.text , compLine)
        utils.log('lang services delete', { edit, ...compProps })
        return { edit, cursorPos: calcNewPos(newRes), hash: calcHash(text) }

        function calcNewPos(prettyPrintData) {
            let { line, col } = getPosOfPath(path, 'begin',{prettyPrintData, tgpModel})
            if (!line && !col) {
                let { line, col } = getPosOfPath(utils.parentPath(path), 'begin',{prettyPrintData, tgpModel})
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
        const newRes = prettyPrintWithPositions(newComp, { initialPath: compId, tgpModel })
        const edit = deltaFileContent(text, newRes.text , compLine)
        utils.log('lang services disable', { edit, ...compProps })
        return { edit, cursorPos: calcNewPos(newRes) , hash: calcHash(text)}

        function calcNewPos(prettyPrintData) {
            let { line, col } = getPosOfPath(path, 'begin',{prettyPrintData, tgpModel})
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
            const toAdd = cloneProfile(comp?.pathAr)
            utils.path(opOnComp,pathAr.slice(0, -1),{$splice: [[indexInArray, 0, toAdd]] })    
            const newComp = update(comp,opOnComp)
            const newRes = prettyPrintWithPositions(newComp, { initialPath: compId, tgpModel })
            const edit = deltaFileContent(text, newRes.text , compLine)
            utils.log('lang services duplicate', { edit, ...compProps })
            const targetPath = [compId,...pathAr.slice(0, -1),indexInArray+1].join('~')
            return { edit, cursorPos: calcNewPos(targetPath, newRes), hash: calcHash(text) }
        } else if (path.indexOf('~') == -1) { // duplicate component
            const noOfLines = (text.match(/\n/g) || []).length+1
            const edit = deltaFileContent('', `\ncomponent('${shortId}', ${text})\n`, compLine+noOfLines)
            utils.log('lang services duplicate comp', { edit, ...compProps })
            return { edit, cursorPos: {line: compLine+noOfLines+1, col: 0}}
        }
        return { errors: ['duplicate - bad format'], ...compProps }

        function calcNewPos(path,prettyPrintData) {
            let { line, col } = getPosOfPath(path, 'begin',{prettyPrintData, tgpModel})
            if (!line && !col)
                return utils.logError('duplicate can not find target path', { path })
            return { line: line + compLine, col }
        }
    }
})

const createTestEdits = Data({ 
    impl: async ctx => {
        const compProps = await _calcCompProps(ctx)
        const { reformatEdits, text, shortId, comp, compLine, compId, errors, path, tgpModel, lineText } = compProps
        if (reformatEdits)
            return { errors: ['createText - bad format'], ...compProps }

        const impl = comp.$type == 'control<>' ? `uiTest(${shortId}(), contains(''))` : `dataTest(${shortId}(), equals(''))`
        const testPrefix = comp.$type == 'action<>' ? 'action' : comp.$type == 'control<>' ? 'ui' : 'data'
        const newText = `\ncomponent('${testPrefix}Test.${shortId}', {\n  impl: ${impl}\n})\n`        
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
                const path = rev.slice(indexOfElem).reverse()
                const arrayPath = path.slice(0, -1)
                const fromIndex = +path.slice(-1)[0]
                const toIndex = fromIndex + diff
                const valToMove = utils.path(comp,path)
                const op = {$splice: [[fromIndex,1],[toIndex,0,valToMove]] }

                const opOnComp = {}
                utils.path(opOnComp,arrayPath,op) // create opOnComp as nested object
                const newComp = update(comp,opOnComp)
                const newRes = prettyPrintWithPositions(newComp, { initialPath: compId, tgpModel })
                const edit = deltaFileContent(text, newRes.text , compLine)
                utils.log('tgpTextEditor moveInArray', { op, edit, ...compProps })

                const origPath = compProps.path.split('~')
                const index = origPath.length - indexOfElem
                const to = [...origPath.slice(0,index-1),toIndex,...origPath.slice(index)].join('~')

                return { edit, cursorPos: calcNewPos(to, newRes) }
            }
        }
        return { errors: ['moveInArray - array elem was not found'], ...compProps }

        function calcNewPos(path, prettyPrintData) {
            const { line, col } = getPosOfPath(path, 'begin',{prettyPrintData, tgpModel})
            if (!line && !col)
                return utils.logError('moveInArray can not find path', { path })
            return { line: line + compLine, col }
        }
    }
})

export const langService = { deleteEdits, disableEdits, duplicateEdits, createTestEdits, moveInArrayEdits }