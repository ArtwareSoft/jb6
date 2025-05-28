import { parse, tokenizer, tokTypes } from '../lib/acorn.mjs'
import { coreUtils } from '@jb6/core'
const { jb, systemParams, astToTgpObj, astNode, logException, 
    resolveProfileTypes, compParams, compIdOfProfile, isPrimitiveValue, asArray, compByFullId, primitivesAst, splitDslType } = coreUtils

export const langServiceUtils = jb.langServiceUtils = { closestComp, calcProfileActionMap, deltaFileContent, filePosOfPath, getPosOfPath, 
    lineColToOffset, offsetToLineCol, tgpEditorHost, applyCompChange, calcHash }

function tgpEditorHost() {
    return jb.ext.tgpTextEditor.host
}

async function applyCompChange(editAndCursor, {ctx} = {}) {
    const host = tgpEditorHost()
    const { edit, cursorPos } = editAndCursor
    if (!edit) return
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
        logException(e, 'completion apply comp change', { editAndCursor })
    }
}

function calcHash(str) {
    let hash = 0, i, chr;
    if (str.length === 0) return hash
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash
}

function offsetToLineCol(text, offset) {
    const cut = text.slice(0, offset)
    return {
        line: (cut.match(/\n/g) || []).length || 0,
        col: offset - (cut.indexOf('\n') == -1 ? 0 : (cut.lastIndexOf('\n') + 1))
    }
}
function lineColToOffset(text, { line, col }) {
    const res = text.split('\n').slice(0, line).reduce((sum, line) => sum + line.length + 1, 0) + col
    if (isNaN(res)) debugger
    return res
}

function getPosOfPath(path, _where = 'edit', { compText, tgpModel } = {}) { // edit,begin,end,function
    const { actionMap, text, startOffset = 0 } = calcProfileActionMap(compText, {tgpModel, expectedPath: path})
    const item = asArray(_where).reduce((acc,where) => acc || actionMap.find(e => e.action == `${where}!${path}`), null)
    if (!item) return { line: 0, col: 0 }
    return offsetToLineCol(text, item.from - startOffset)
}

function filePosOfPath(tgpPath, {tgpModel}) {
    const compId = tgpPath.split('~')[0]
    const loc = compByFullId(compId, tgpModel).$location
    if (!loc) return
    const path = loc.path
    const compLine = (+loc.line) || 0
    const { line, col } = getPosOfPath(tgpPath, 'begin', {tgpModel})
    return { path, line: line + compLine, col }
}

function deltaFileContent(compText, newCompText, compLine) {
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
        let i = 0, j = 0;
        while (newText[i] == oldText[i] && i < newText.length) i++
        const common = oldText.slice(0, i)
        oldText = oldText.slice(i); newText = newText.slice(i);
        while (newText[newText.length - j] == oldText[oldText.length - j] && j < oldText.length && j < newText.length) j++ // calc backwards from the end
        if (newText[newText.length - j] != oldText[oldText.length - j]) j--
        return { firstDiff: i, common, oldText: oldText.slice(0, oldText.length -j), newText: newText.slice(0, newText.length-j) }
    }
}

function log(...args) {
  if (globalThis.jbVSCodeLog)
    globalThis.jbVSCodeLog(...args)
  else
    console.log(...args)
}

function calcProfileActionMap(compText, {tgpType = 'comp<tgp>', tgpModel, inCompOffset = -1, expectedPath = ''}) {
    const topComp = astToTgpObj(parse(compText, { ecmaVersion: 'latest', sourceType: 'module' }).body[0], compText)
    resolveProfileTypes(topComp, {tgpModel, expectedType: tgpType, topComp})
    let compId = ''
    if (tgpType == 'comp<tgp>' && topComp.id) { // set compId and add to comps registry
//        log('calcProfileActionMap', compText, topComp)
        const dslType = tgpModel.dsls.tgp.comp[topComp.$].dslType
        compId = `${dslType}${topComp.id}`
        const [ type, dsl ] = splitDslType(dslType)
        tgpModel.dsls[dsl][type][topComp.id] = topComp
    }
    const actionMap = []

    calcActionMap(topComp, compId, topComp[astNode])
    const path = expectedPath || actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to)
        .map(x => x.action.split('!').pop())
        .reduce((longest, current) => current.length > longest.length ? current : longest, '');

    return { text: compText, compId, comp: topComp, actionMap, path }

    function calcActionMap(prof,path,ast) {
        const pathMatch = expectedPath.startsWith(path) || path.startsWith(expectedPath)
        const astMatchOffset = ast?.start <= inCompOffset && inCompOffset <= ast?.end
        if (!ast || !pathMatch || inCompOffset != -1 && !astMatchOffset ) return
        actionMap.push({ action: `begin!${path}`, from: ast.start, to: ast.start })

        if (isPrimitiveValue(prof)) {
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
        if (typeof prof == 'function') {
            actionMap.push({ action: `function!${path}`, from: ast.start, to: ast.end })
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
            
            const compFullId = (path && path.indexOf('~') == -1) ? 'comp<tgp>tgpComp' : compIdOfProfile(prof)
            const params = [...compParams(compByFullId(compFullId, tgpModel)), ...systemParams]
            const param0 = params[0] || {}, param1 = params[1] || {}
            const firstParamAsArray = (param0.type||'').indexOf('[]') != -1 && !param0.byName
            const secondParamAsArray = param1.secondParamAsArray
            if (!firstParamAsArray && !secondParamAsArray)
                delimiters.forEach(dl => actionMap.push({ action: `addProp!${path}`, from: dl.start, to: dl.end+1, source: 'delimiters' }))
            if (firstParamAsArray) {
                const firstParamPath = `${path}~${param0.id}`
                actionMap.push({ action: `prependPT!${firstParamPath}`, from: endOfPTName, to: (ast.arguments)?.[0]?.start || endOfPTName, source: 'firstParamAsArray' })
                const endOfParamArrayArea = paramsByNameAst ? paramsByNameAst.start -1 : ast.end-1
                actionMap.push({ action: `appendPT!${firstParamPath}`, from: endOfParamArrayArea, to: endOfParamArrayArea })
                delimiters.forEach((dl, i) => actionMap.push({ action: `insertPT!${firstParamPath}~${i}`, from: dl.start, to: dl.end }))
            }
            if (secondParamAsArray) {
                const secParamPath = `${path}~${param1.id}`
                const startParamArrayArea = delimiters.length ? delimiters[0].end+1 : ast.start
                actionMap.push({ action: `prependPT!${secParamPath}`, from: startParamArrayArea, to: startParamArrayArea, source: 'secondParamAsArray' })
                const endOfParamArrayArea = paramsByNameAst ? paramsByNameAst.start -1 : ast.end-1
                actionMap.push({ action: `appendPT!${secParamPath}`, from: endOfParamArrayArea, to: endOfParamArrayArea })
                delimiters.forEach((dl, i) => actionMap.push({ action: `insertPT!${secParamPath}~${i}`, from: dl.start, to: dl.end }))
            }
            params.map(p=>({id:p.id, val: prof[p.id]})).filter(({val}) => val != null)
                .forEach(({id,val}) => calcActionMap(val, `${path}~${id}`, prof[primitivesAst][id] || val[astNode]))
        }
    }
}

function closestComp(docText, cursorLine, cursorCol, filePath) {
    const offset = lineColToOffset(docText,{line: cursorLine, col: cursorCol})
    try {
        const ast = parse(docText, { ecmaVersion:"latest", sourceType:"module", ranges:true })
        const span = ast.body.find(n => n.start <= offset && offset < n.end)
        const compText = docText.slice(span.start, span.end)
        const shortId = span.expression?.arguments?.[0]?.value // (compText.match(/^\s*\w+\(\s*(['"`])([\s\S]*?)\1/)||[])[2]
        if (!shortId) return { notJbCode: true }
        const compLine = offsetToLineCol(docText,span.start).line
        return { compText, compLine, inCompOffset: offset - span.start, shortId, cursorLine, cursorCol, filePath}
    } catch (e) {
        return { notJbCode: true }
    }
}

