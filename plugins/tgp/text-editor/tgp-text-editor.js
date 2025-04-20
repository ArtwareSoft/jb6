import { jb } from '../../core/jb-core.js'
import { astToTgpObj } from '../model-data/tgp-model-data.js'
import { resolveProfile } from '../../core/jb-macro.js'
import { parse } from '/libs/acorn.mjs'

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

export function getPosOfPath(path, _where = 'edit', { prettyPrintData } = {}) { // edit,begin,end,function
    const compId = path.split('~')[0]
    const { actionMap, text, startOffset } = prettyPrintData || jb.utils.prettyPrintWithPositions(jb.comps[compId], { initialPath: compId })
    const item = jb.asArray(_where).reduce((acc,where) => acc || actionMap.find(e => e.action == `${where}!${path}`), null)
    if (!item) return { line: 0, col: 0 }
    return offsetToLineCol(text, item.from - startOffset)
}

export function filePosOfPath(tgpPath) {
    const compId = tgpPath.split('~')[0]
    const loc = jb.comps[compId].$location
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

export function parseComp(docProps, tgpModel) {
    const unresolved = astToTgpObj(parse(docProps.compText).body[0])
    const prof = resolveProfile(unresolved,{tgpModel, expectedType: 'tgpCompDef<>'})

    const actionMap = {}
    return { ...docProps, actionMap, type: prof.$type }


    //const code = '{\n' + compText.split('\n').slice(1).join('\n').slice(0, -1)
//    const cursorPos = offsetToLineCol(compText, inCompOffset)
    const {compId, comp, compProps, type} = parseProfile(compText,tgpModel)
    // if (errors) {
    //     utils.logError('calcCompProps evalProfileDef', { compId, compText, shortId, plugin })
    //     return ({...docProps, compId, comp, errors, pluginDsl, compDsl})
    // }
    // if (!compId)
    //     return { errors: ['can not determine compId'], shortId, plugin }

    // const { text, actionMap, startOffset } = prettyPrintWithPositions(comp, { initialPath: compId, tgpModel })
    // const lastToken = Object.values(actionMap).filter(x=>x.action.indexOf('Token!') != -1 && x.from < inCompOffset).sort((x,y)=>x.from-y.from).pop()
    // const pathByToken = lastToken && lastToken.action.startsWith('beginToken!') && lastToken.action.split('!').pop()
    // const path = pathByToken || actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
    //         .map(e => e.action.split('!').pop())[0] || compId
    // const compProps = (code != text) ? { path, formattedText: text, reformatEdits: deltaFileContent(code, text, compLine) }
    //     : { time: new Date().getTime(), text, path, actionMap, startOffset, plugin, tgpModel, compId, comp }

    //return { ...docProps, ...compProps, ...tgpModelErrors, fileDsl, type: tgpModel.paramType(path) }
}



/*
export function evalProfileDef(id, code, pluginId, fileDsl, tgpModel, { cursorPos, fixed, forceLocalSuggestions } = {}) {
    const plugin = utils.path(tgpModel, ['plugins', pluginId])
    const proxies = utils.path(plugin, 'proxies') ? jb.objFromEntries(plugin.proxies.map(id => jb.macro.registerProxy(id))) : jb.macro.proxies
    const context = { jb, ...proxies, dsl: x => jb.dsl(x), component: (id,comp) => jb.component(id,comp, { plugin, fileDsl }) }
    try {
        const f = eval(`(function(${Object.keys(context)}) {return ${code}\n})`)
        const res = f(...Object.values(context))
        if (!id) return { res }

        const comp = res
        const type = comp.type || ''
        const pluginDsl = plugin.dsl
        const dsl = fileDsl || pluginDsl || type.indexOf('<') != -1 && type.split(/<|>/)[1]
        comp.$dsl = dsl
        const compId = jb.utils.resolveSingleComp(comp, id, { tgpModel, dsl })
        comp.$location = utils.path(tgpModel,[compId,'$location'])
        comp.$comp = true
        if (forceLocalSuggestions && jb.plugins[pluginId]) {
            const compToRun = f(...Object.values(context))
            jb.comps[compId] = compToRun
            compToRun.$dsl = dsl
            compToRun.$plugin = pluginId
            jb.utils.resolveSingleComp(compToRun, id, {dsl})
            compToRun.$location = utils.path(jb.comps,[compId,'$location'])
        }
        return tgpModel.currentComp = { comp, compId, pluginDsl, compDsl: dsl }
    } catch (e) {
        if (fixed)
            return { compilationFailure: true, errors: [e] }
        const newCode = cursorPos && fixCode()
        if (!newCode)
            return { compilationFailure: true, errors: [e] }
        return evalProfileDef(id, newCode, pluginId, fileDsl, tgpModel, { cursorPos, fixed: true })
    }

    function fixCode() {
        const lines = code.split('\n')
        const { line, col } = cursorPos
        const currentLine = lines[line]
        const fixedLine = currentLine && fixLineAtCursor(currentLine, col)
        if (currentLine && fixedLine != currentLine)
            return lines.map((l, i) => i == line ? fixedLine : l).join('\n')
    }

    function fixLineAtCursor(line, pos) {
        const rest = line.slice(pos)
        const to = pos + (rest.match(/^[a-zA-Z0-9$_\.]+/) || [''])[0].length
        const from = pos - (line.slice(0, pos).match(/[a-zA-Z0-9$_\.]+$/) || [''])[0].length
        const word = line.slice(from, to)
        const noCommaNoParan = rest.match(/^[a-zA-Z0-9$_\.]*\s*$/)
        const func = rest.match(/^[a-zA-Z0-9$_\.]*\s*\(/)
        const replaceWith = noCommaNoParan ? 'TBD(),' : func ? isValidFunc(word) ? word : 'TBD' : 'TBD()'
        return line.slice(0, from) + replaceWith + line.slice(to)
    }
    function isValidFunc(f) {
        return f.trim() != '' && (jb.macro.proxies[f] || jb.frame[f])
    }
}

*/