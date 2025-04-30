import { jb, utils } from '../../common/common-utils.js'
import { astToTgpObj, astNode } from '../model-data/tgp-model-data.js'
import { systemParams, OrigArgs } from '../../core/jb-macro.js'
import { resolveProfileTypes, primitivesAst } from './resolve-types.js'
import { parse } from '/libs/acorn.mjs'
import { prettyPrintWithPositions } from '../formatter/pretty-print.js'

const visitedPaths = [] 
let currentVisited = 0

export const tgpEditorHost = () => jb.ext.tgpTextEditor.host

export async function applyCompChange(editAndCursor, {ctx} = {}) {
    const host = tgpEditorHost()
    const { edit, cursorPos } = editAndCursor
    try {
        await host.saveDoc()
        await host.applyEdit(edit,{ctx})
        await host.saveDoc()
        if (cursorPos) {
            await host.selectRange(cursorPos,{ctx})
            if (cursorPos.TBD)
                await host.execCommand('editor.action.triggerSuggest') // VSCODE command
        }
    } catch (e) {
        host.log(`applyCompChange exception`)
        jb.logException(e, 'completion apply comp change', { item })
    }
}

export function calcHash(str) {
    let hash = 0, i, chr;
    if (str.length === 0) return hash
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash
}

export function offsetToLineCol(text, offset) {
    const cut = text.slice(0, offset)
    return {
        line: (cut.match(/\n/g) || []).length || 0,
        col: offset - (cut.indexOf('\n') == -1 ? 0 : (cut.lastIndexOf('\n') + 1))
    }
}
export function lineColToOffset(text, { line, col }) {
    const res = text.split('\n').slice(0, line).reduce((sum, line) => sum + line.length + 1, 0) + col
    if (isNaN(res)) debugger
    return res
}

export function getPosOfPath(path, _where = 'edit', { prettyPrintData, tgpModel } = {}) { // edit,begin,end,function
    const compId = path.split('~')[0]
    const { actionMap, text, startOffset } = prettyPrintData || prettyPrintWithPositions(tgpModel.comps[compId], { initialPath: compId })
    const item = jb.asArray(_where).reduce((acc,where) => acc || actionMap.find(e => e.action == `${where}!${path}`), null)
    if (!item) return { line: 0, col: 0 }
    return offsetToLineCol(text, item.from - startOffset)
}

export function filePosOfPath(tgpPath, {tgpModel}) {
    const compId = tgpPath.split('~')[0]
    const loc = tgpModel.comps[compId].$location
    const path = loc.path
    const compLine = (+loc.line) || 0
    const { line, col } = getPosOfPath(tgpPath, 'begin')
    return { path, line: line + compLine, col }
}

export function deltaFileContent(compText, newCompText, compLine) {
    const { common, oldText, newText } = calcDiff(compText, newCompText || '')
    const commonStartSplit = common.split('\n')
    const start = { line: compLine + commonStartSplit.length - 1, col: commonStartSplit.slice(-1)[0].length }
    const end = {
        line: start.line + oldText.split('\n').length - 1,
        col: (oldText.split('\n').length - 1 ? 0 : start.col) + oldText.split('\n').pop().length
    }
    return { range: { start, end }, newText }

    // the diff is continuous, so we cut the common parts at the begining and end 
    function calcDiff(oldText, newText) {
        let i = 0; j = 0;
        while (newText[i] == oldText[i] && i < newText.length) i++
        const common = oldText.slice(0, i)
        oldText = oldText.slice(i); newText = newText.slice(i);
        while (newText[newText.length - j] == oldText[oldText.length - j] && j < oldText.length && j < newText.length) j++ // calc backwards from the end
        if (newText[newText.length - j] != oldText[oldText.length - j]) j--
        return { firstDiff: i, common, oldText: oldText.slice(0, oldText.length -j), newText: newText.slice(0, newText.length-j) }
    }
}

// export function calcCompActionMap(compText, tgpModel) {
//     return parseProfile(compText, {$$: 'comp<tgp>tgpComp', tgpType: 'comp<tgp>', tgpModel, basePath: utils.compName(topComp)})
// }

export function calcProfileActionMap(compText, {tgpType, tgpModel, basePath = '', $$}) {
    const topComp = astToTgpObj(parse(compText, { ecmaVersion: 'latest', sourceType: 'module' }).body[0])
    resolveProfileTypes(topComp,{tgpModel, expectedType: tgpType, topComp})
    topComp.$$ = $$ || `${tgpType}${topComp.$}`
    const actionMap = []
    calcActionMap(topComp,basePath,topComp[astNode])

    return actionMap

    function calcActionMap(prof,path,ast) {
        if (!ast) 
            { return } // injected secondParamAsArray
        actionMap.push({ action: `begin!${path}`, from: ast.start, to: ast.start })

        if (utils.isPrimitiveValue(prof)) {
            actionMap.push({ action: `beginToken!${path}`, from: ast.start, to: ast.start })
            actionMap.push({ action: `endToken!${path}`, from: ast.end, to: ast.end })
            actionMap.push({ action: `end!${path}`, from: ast.end, to: ast.end })
            if (typeof prof == 'string') {
                actionMap.push({ action: `setPT!${path}`, from: ast.start+1, to: ast.start+2 })
                actionMap.push({ action: `edit!${path}`, from: ast.start+1, to: ast.start+1 })
                actionMap.push({ action: `insideText!${path}`, from: ast.start+2, to: ast.end });
            } else { // token (number or bool)
                actionMap.push({ action: `setPT!${path}`, from: ast.start, to: ast.start+1 })
                actionMap.push({ action: `edit!${path}`, from: ast.start, to: ast.start })
                actionMap.push({ action: `insideToken!${path}`, from: ast.start+1, to: ast.end });
            }
            return
        }

        if (Array.isArray(prof)) {
            const delimiters =  ast.elements.slice(1).map((dl, i) => ({start: ast.elements[i].end, end: dl.start }))

            actionMap.push({ action: `propInfo!${path}`, from: ast.start, to: ast.start+1 })
            actionMap.push({ action: `prependPT!${path}`, from: ast.start+1, to: ast.start+1, source: 'array' })
            actionMap.push({ action: `appendPT!${path}`, from: ast.end-1, to: ast.end })
            delimiters.forEach((dl,i) => actionMap.push({ action: `insertPT!${path}~${i}`, from: dl.start, to: dl.end }))
            actionMap.push({ action: `end!${path}`, from: ast.end-1, to: ast.end-1 })
            prof.forEach((val,i) => calcActionMap(val,`${path}~${i}`, prof[primitivesAst][i] || val[astNode]))

        } else { // profile
            const expressionAst = ast.type == 'CallExpression' ? ast : ast.expression
            if (!expressionAst) return // asIs
            const astArgs = expressionAst.arguments
            const delimiters = ast.type == 'ExpressionStatement' ? astArgs.filter(n => n.value == ',')
                : astArgs.slice(1).map((dl, i) => ({start: astArgs[i].end, end: dl.start }))

            const endOfPTName = expressionAst.callee.end + 1
            actionMap.push({ action: `beginToken!${path}`, from: ast.start, to: ast.start })
            actionMap.push({ action: `endToken!${path}`, from: endOfPTName, to: endOfPTName })    
            actionMap.push({ action: `setPT!${path}`, from: ast.start, to: endOfPTName })
            actionMap.push({ action: `edit!${path}`, from: endOfPTName, to: endOfPTName })
            actionMap.push({ action: `addProp!${path}`, from: endOfPTName, to: endOfPTName, source: 'profile-begin' })
            actionMap.push({ action: `addProp!${path}`, from: ast.end - 1, to: ast.end, source: 'profile-end'  })
            actionMap.push({ action: `end!${path}`, from: ast.end, to: ast.end })

            const paramsByNameAst = astArgs.filter(n=>n.type=='ObjectExpression')[0]
            if (paramsByNameAst) {
                actionMap.push({ action: `addProp!${path}`, from: paramsByNameAst.start-2, to: paramsByNameAst.start, source: 'byName-begin' })
                const firstPropStart = paramsByNameAst.properties?.[0]?.start
                firstPropStart && actionMap.push({ action: `addProp!${path}`, from: paramsByNameAst.start, to: firstPropStart, source: 'byName-begin2' })
                actionMap.push({ action: `addProp!${path}`, from: paramsByNameAst.end-2, to: paramsByNameAst.end, source: 'byName-end' })
                const props = paramsByNameAst?.properties || []
                props.forEach(prop => actionMap.push({ action: `propInfo!${path}~${prop.key.name}`, from: prop.start, to: prop.value.start }))
                if (props.length > 1)
                    props.slice(1).forEach((prop, i) => actionMap.push({ action: `addProp!${path}`, from: props[i].end, to: prop.start, source: 'props' }))
            }
            const params = [...utils.compParams(tgpModel.comps[utils.compName(prof)]), ...systemParams]
            const param0 = params[0] || {}, param1 = params[1] || {}
            const firstParamAsArray = (param0.type||'').indexOf('[]') != -1 && !param0.byName
            const secondParamAsArray = param1.secondParamAsArray
            if (!firstParamAsArray && !secondParamAsArray)
                delimiters.forEach(dl => actionMap.push({ action: `addProp!${path}`, from: dl.start, to: dl.end, source: 'delimiters' }))
            if (firstParamAsArray) {
                const firstParamPath = `${path}~${param0.id}`
                actionMap.push({ action: `prependPT!${firstParamPath}`, from: endOfPTName, to: (ast.arguments)?.[0]?.start || endOfPTName, source: 'firstParamAsArray' })
                const endOfParamArrayArea = paramsByNameAst ? paramsByNameAst.start -1 : ast.end-1
                actionMap.push({ action: `appendPT!${firstParamPath}`, from: endOfParamArrayArea, to: endOfParamArrayArea })
                delimiters.forEach((dl, i) => actionMap.push({ action: `insertPT!${firstParamPath}~${i}`, from: dl.start, to: dl.end }))
            }
            if (secondParamAsArray && delimiters.length) {
                const secParamPath = `${path}~${param1.id}`
                const startParamArrayArea = delimiters[0].end+1
                actionMap.push({ action: `prependPT!${secParamPath}`, from: startParamArrayArea, to: startParamArrayArea, source: 'secondParamAsArray' })
                const endOfParamArrayArea = paramsByNameAst ? paramsByNameAst.start -1 : ast.end-1
                actionMap.push({ action: `appendPT!${secParamPath}`, from: endOfParamArrayArea, to: endOfParamArrayArea })
                delimiters.slice(1).forEach((dl, i) => actionMap.push({ action: `insertPT!${secParamPath}~${i}`, from: dl.start, to: dl.end }))
            }
            params.map(p=>({id:p.id, val: prof[p.id]})).filter(({val}) => val != null)
                .forEach(({id,val}) => calcActionMap(val, `${path}~${id}`, prof[primitivesAst][id] || val[astNode]))
        }
    }
}

export function closestComp(docText, cursorLine, cursorCol, filePath) {
    const ast = parse(docText, { ecmaVersion:'latest', sourceType:'module' })
    const offset = lineColToOffset(docText,{line: cursorLine, col: cursorCol})
    const node = ast.body.find(x=> x.start <= offset && offset < x.end)
    const shortId = node?.expression?.arguments[0]?.value
    if (!shortId)
        return { notJbCode: true }
    const compLine = offsetToLineCol(docText,node.start).line
    const compText = docText.slice(node.start,node.end)
    return { compText, compLine, inCompOffset: offset - node.start, shortId, cursorLine, cursorCol, filePath}
}