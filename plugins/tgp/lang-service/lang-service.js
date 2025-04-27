import { resolveCompArgs, isMacro}  from '../../core/jb-macro.js'
import { utils, Data, jb, Ctx, DefComponents } from '../../common/common-utils.js'
import { calcTgpModelData } from '../model-data/tgp-model-data.js'
import { tgpEditorHost, offsetToLineCol, parseComp, deltaFileContent, filePosOfPath, calcHash } from '../text-editor/tgp-text-editor.js'
import { prettyPrintWithPositions, prettyPrint } from '../formatter/pretty-print.js'
import { update } from '../../db/immutable.js'

export const tgpModels = {}

export async function calcCompProps(ctx, {includeCircuitOptions} = {}) {
    const {forceLocalSuggestions, forceRemoteCompProps} = ctx.vars
    const docProps = { forceLocalSuggestions, ...tgpEditorHost().compTextAndCursor() }
    const packagePath = docProps.packagePath = docProps.filePath
    const compProps = (tgpModels[packagePath] && !forceRemoteCompProps) 
        ? parseComp(docProps, tgpModels[packagePath])
        : await calcCompProps()
    const circuitOptions = (compProps.path && includeCircuitOptions) ? 
        await new Ctx().setData(packagePath).calc({$: 'remote.circuitOptions', filePath: compProps.filePath, path: compProps.path}) : null
    return {...compProps, circuitOptions}

    async function calcCompProps() {
        const tgpModelData = forceLocalSuggestions ? await calcTgpModelData({filePath: packagePath}) 
            : await new Ctx().setData(packagePath).calc({$: 'remote.tgpModelData'})
        if (!tgpModelData.filePath) {
            const errorMessage = utils.path(tgpModelData.errors,'0.0.e.message') || ''
            const referenceError = (errorMessage.match(/ReferenceError: (.*)/) || [])[1]
            const SyntaxError = (errorMessage.match(/SyntaxError: (.*)/) || [])[1]
            const errors = [referenceError,SyntaxError].filter(x=>x)
            tgpEditorHost().log(`error creating tgpModelData for path ${packagePath}`)
            return { errors: [...errors, ...utils.asArray(tgpModelData.errors), `error creating tgpModelData for path ${packagePath}`]}
        }
            
        docProps.filePath = tgpModelData.filePath
        tgpModels[packagePath] = new tgpModelForLangService(tgpModelData)
        return parseComp(docProps, tgpModels[packagePath])
    }
}

async function provideCompletionItems(compProps, ctx) {
    const { actionMap, inCompOffset, tgpModel } = compProps
    const actions = actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
        .map(e => e.action).filter(e => e.indexOf('edit!') != 0 && e.indexOf('begin!') != 0 && e.indexOf('end!') != 0)
    if (actions.length == 0) return []
    const priorities = ['addProp']
    let paramDef = null
    const sortedActions = utils.unique(actions).map(action=>action.split('!')).sort((a1,a2) => priorities.indexOf(a2[0]) - priorities.indexOf(a1[0]))
    let items = sortedActions.reduce((acc, action) => {
        const [op, path] = action
        paramDef = tgpModel.paramDef(path)
        // if (!paramDef)
        //     utils.logError('can not find paramDef for path',{path,ctx})
        const toAdd = (op == 'setPT' && paramDef && paramDef.options) ? enumCompletions(path,compProps)
            : op == 'setPT' ? [...wrapWithArray(path, compProps), ...newPTCompletions(path, 'set', compProps)]
            : op == 'insertPT' ? newPTCompletions(path, 'insert', compProps)
            : op == 'appendPT' ? newPTCompletions(path, 'append', compProps)
            : op == 'prependPT' ? newPTCompletions(path, 'prepend', compProps)
            : op == 'addProp' ? paramCompletions(path, compProps) : []
        return [...acc, ...toAdd]
    }, [])
    if (actions[0] && actions[0].indexOf('insideText') == 0)
        items = await dataCompletions(compProps, actions[0].split('!').pop(), ctx)

    return { items, paramDef }
}

function newPTCompletions(path, opKind, compProps) { // opKind: set,insert,append,prepend
    const tgpModel = compProps.tgpModel
    const options = compProps.tgpModel.PTsOfPath(path).filter(x => !x.match(/^dataResource\./)).map(compName => {
        const comp = tgpModel.compById(compName)
        return {
            label: compName.split('>').pop(), kind: 2, compName, opKind, path, compProps,
            detail: [comp.description, compName.indexOf('>') != -1 && compName.split('>')[0] + '>'].filter(x => x).join(' '),
            extend(ctx) { return setPTOp(this.path, this.opKind, this.compName, ctx) },
        }
    })
    const isArrayElem = path.match(/~[0-9]+$/)
    const propStr = isArrayElem ? path.split('~').slice(-2).join('~') : path.split('~').pop()
    const propTitle = {
        label: propStr + ': ' + tgpModel.paramType(path), kind: 25, path, extend: () => { },
        detail: utils.path(compProps.tgpModel.paramDef(path), 'description')
    }
    return [propTitle, ...options]

    function setPTOp(path, opKind, compName, ctx) {
        const index = opKind == 'append' ? -1 : opKind == 'insert' ? (+path.split('~').pop() + 1) : opKind == 'prepend' && 0
        const basePath = opKind == 'insert' ? path.split('~').slice(0, -1).join('~') : path
        const basedOnVal = opKind == 'set' && tgpModel.valOfPath(path)
        const { result, cursorPath, whereToLand } = newProfile(tgpModel.compById(compName), {basedOnVal})
        const res = opKind == 'set' ? setOp(path, result, ctx) : addArrayItemOp(basePath, { toAdd: result, index, ctx })
        return {...res, resultPath: [res.resultPath || path,cursorPath].filter(x=>x).join('~'), whereToLand }
    }

    function addArrayItemOp(path, { toAdd, index, srcCtx } = {}) {
        const val = tgpModel.valOfPath(path)
        toAdd = toAdd === undefined ? { $: 'TBD' } : toAdd
        if (Array.isArray(val)) {
            if (index === undefined || index == -1)
                return { path, op: { $push: [toAdd] }, srcCtx, resultPath: `${path}~${val.length}` }
            else
                return { path, op: { $splice: [[index, 0, toAdd]] }, srcCtx, resultPath: `${path}~${index}` }
        } else if (!val) {
            return { ...setOp(path, utils.asArray(toAdd), srcCtx), resultPath: `${path}~0` }
        } else {
            if (index === undefined || index == -1)
                return { ...setOp(path, [val, toAdd], srcCtx), resultPath: `${path}~1` }
            else
                return { ...setOp(path, [toAdd, val], srcCtx), resultPath: `${path}~0` }
        }
    }
}

function newProfile(comp, {basedOnPath, basedOnVal} = {}) {
	const currentVal = basedOnVal != null ?  basedOnVal : (basedOnPath && valOfPath(basedOnPath))
	const result = { $$: comp.$$, $type: comp.$type	}
	let cursorPath = '', whereToLand = 'edit'
	const composite = utils.compParams(comp).find(p=>p.composite)
	utils.compParams(comp).forEach(p=>{
		if (p.composite && currentVal != null) {
			result[p.id] = currentVal
			cursorPath = p.id
			whereToLand = 'end'
		}
		else if (p.templateValue != null && !composite)
			result[p.id] = cloneProfile(p.templateValue)
		else if (currentVal && currentVal[p.id] !== undefined && !composite)
			result[p.id] = currentVal[p.id]
		cursorPath = cursorPath || (result[p.id] != null && p.id)
	})
	return { result, cursorPath, whereToLand }
}

function enumCompletions(path, compProps) {
    return compProps.tgpModel.paramDef(path).options.split(',').map(label => ({
        label, kind: 19, path, compProps, op: { $set: label } }))
}

function paramCompletions(path, compProps) {
    const tgpModel = compProps.tgpModel
    const params = tgpModel.paramsOfPath(path).filter(p => tgpModel.valOfPath(path + '~' + p.id) === undefined)
        .sort((p2, p1) => (p1.mandatory ? 1 : 0) - (p2.mandatory ? 1 : 0))
    return params.map(param => ({
        label: param.id, path, kind: 4, id: param.id, compProps, detail: [param.as, param.type, param.description].filter(x => x).join(' '),
        extend(ctx) { return addPropertyOp(`${this.path}~${this.id}`, ctx) },
    }))

    function addPropertyOp(path, srcCtx) {
        const param = tgpModel.paramDef(path)
        if (!param)
            return utils.logError(`no param def for path ${path}`, { srcCtx })
        const paramType = tgpModel.paramType(path)
        const result = param.templateValue ? JSON.parse(JSON.stringify(param.templateValue))
            : paramType == 'boolean<>' ? true
            : paramType.indexOf('data') != -1 ? '' : { $: 'TBD' }

        return setOp(path, result, srcCtx)
    }
}

function wrapWithArray(path, compProps) {
    const tgpModel = compProps.tgpModel
    return [path].filter(x => x).map(path => tgpModel.canWrapWithArray(path) ? {
        label: `wrap with array`, kind: 18, compProps, path, extend(ctx) { return { ...wrapWithArrayOp(this.path, ctx), whereToLand: 'end' } },
    } : null).filter(x => x).slice(0, 1)

    function wrapWithArrayOp(path, srcCtx) {
        const toAdd = tgpModel.valOfPath(path)
        if (toAdd != null && !Array.isArray(toAdd))
            return { ...setOp(path, [toAdd], srcCtx) }
    }
}

async function dataCompletions(compProps, path, ctx) {
    const { actionMap, inCompOffset, text, startOffset, filePath, compLine } = compProps
    const item = actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
        .find(e => e.action.indexOf('insideText!') == 0)
    const value = text.slice(item.from - startOffset - 1, item.to - startOffset - 1)
    const selectionStart = inCompOffset - item.from + 1
    const input = { value, selectionStart }
    const { line, col } = offsetToLineCol(text, item.from - startOffset - 1)

    const suggestions = await ctx.setData(input).setVars({ filePath, probePath: path }).calc(
        {$: 'langServer.remoteProbe', sourceCode: {$: 'source-code<loader>probeServer', filePath: '%$filePath%'}, probePath: '%$probePath%', expressionOnly: true })
    return (utils.path(suggestions, '0.options') || []).map(option => {
        const { pos, toPaste, tail, text } = option
        const primiteVal = option.valueType != 'object'
        const suffix = primiteVal ? '%' : '/'
        const newText = toPaste + suffix
        const startInInput = pos - tail.length
        const overlap = calcOverlap(newText, input.value.slice(startInInput))
        const suffixExists = input.value.substr(startInInput + overlap)[0] == suffix
        const newVal = input.value.substr(0, startInInput) + newText + input.value.substr(startInInput + overlap + (suffixExists ? 1 : 0))
        const cursorPos = { line: line + compLine, col: col + startInInput + toPaste.length + (suffix == '%' ? 2 : 1) }
        return { label: text, path, kind: primiteVal ? 12 : 13, cursorPos, compProps,  op: { $set: newVal } }
    })

    function calcOverlap(s1, s2) {
        for (i = 0; i < s1.length; i++)
            if (s1[i] != s2[i]) return i
        return s1.length
    }
}

function setOp(path, value, srcCtx) {
    return { op: { $set: value }, path, srcCtx }
}

function cloneProfile(prof) {
	if (!prof || utils.isPrimitiveValue(prof) || typeof prof == 'function') return prof
	const keys = [...Object.keys(prof),jb.core.OrigArgs]
	return Object.fromEntries(keys.map(k=>[k,cloneProfile(prof[k])]))
}

export class tgpModelForLangService {
    constructor(tgpModel) {
        Object.assign(this,tgpModel)
        this.ptsOfTypeCache = {}
        this.currentComp = {}
    }
    valOfPath(path, silent){ 
        const res = utils.path(this.compById(path.split('~')[0], silent),path.split('~').slice(1))
        return res && res[isMacro] ? res() : res
    }
    compNameOfPath(path) {
        if (path.indexOf('~') == -1)
            return 'jbComponent'
        if (path.match(/~\vars$/)) 
            return
        return utils.compName(this.valOfPath(path))
    }
    paramDef(path) {
        let _parentPath = utils.parentPath(path)
        let paramName = path.split('~').pop()
        if (!_parentPath)
            return this.compById(path)
        if (!isNaN(Number(paramName))) { // array elements
            path = _parentPath
            paramName = path.split('~').pop()
            _parentPath = utils.parentPath(path)
        }
        if (paramName == 'defaultValue' && this.isParamDef(_parentPath))
        return this.valOfPath(_parentPath)
        const comp = this.compOfPath(_parentPath)
        return utils.compParams(comp).find(p=>p.id==paramName)
    }
    isParamDef(path) {
        const pathAr = path.split('~')
        return pathAr.length == 3 && pathAr[1] == 'params'
    }
    compOfPath(path) { return this.compById(this.compNameOfPath(path)) }
    paramsOfPath(path) { return utils.compParams(this.compOfPath(path)) }
    compById(id) { return this.currentComp.compId == id ? this.currentComp.comp : this.comps[id] }
    PTsOfType(type) {
        if (this.ptsOfTypeCache[type])
            return this.ptsOfTypeCache[type]
        const comps = this.comps
        const types = [...(type||'').replace(/\[\]/g,'').split(','),'any']
        const res = types.flatMap(t=> Object.entries(comps).filter(([id,comp]) => !comp.hidden && id.startsWith(t)).map(c=>c[0]) )
        res.sort((c1,c2) => this.markOfComp(c2) - this.markOfComp(c1))
        return this.ptsOfTypeCache[type] = res
    }
    markOfComp(id) {
        return +(((this.compById(id).category||'').match(/common:([0-9]+)/)||[0,0])[1])
    }
    PTsOfPath(path) {
        const typeAdpter = this.valOfPath(`${utils.parentPath(path)}~fromType`,true)
        const type = typeAdpter || this.paramType(path)
        return this.PTsOfType(type)
    }
    paramType(path) {
        const type = utils.path(this.paramDef(path),'$type')
        return type == '$asParent' ? this.paramType(utils.parentPath(path)) : type
    }
    enumOptions(path) { 
        return ((this.paramDef(path) || {}).options ||'').split(',').map(x=> ({code: x.split(':')[0],text: x.split(':')[0]}))
    }
    canWrapWithArray(path) {
        const type = this.paramDef(path) ? (this.paramDef(path).type || '') : ''
        const val = this.valOfPath(path)
        const parentVal = this.valOfPath(utils.parentPath(path))
        return type.includes('[') && !Array.isArray(val) && !Array.isArray(parentVal)
    }
    pluginOfFilePath(filePath) {
        return Object.values(this.plugins).filter(p=>p.files.includes(filePath)).map(p=>p.id)[0]
    }
    fileDsl(filePath) {
        const plugin = this.pluginOfFilePath(filePath)
        return plugin && (((this.plugins[plugin].dslOfFiles || []).find(e=>e[0]==filePath) || [])[1] || plugin.dsl)
    }
}

export async function completionItems(ctx) {
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
        title = paramDef && `${paramDef.id}: ${paramDef.$type.replace('<>','')}`
        utils.log('completion items', { items, ...compProps, ctx })
    } else if (errors) {
        utils.logError('completion provideCompletionItems', {errors, compProps})
        items = [ {
            kind: 4, label: (errors[0]||'').toString(), sortText: '0001',
        }]
        title = prettyPrint(errors)
    }
    return { items, title, paramDef, errors }
}

async function compId(ctx) {
    const compProps = await calcCompProps(ctx)
    const { reformatEdits, actionMap, inCompOffset, tgpModel, path, comp } = compProps
    if (reformatEdits)
        return { errors: ['compId - bad format'], ...compProps }

    const actions = actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
        .map(e => e.action).filter(e => e.indexOf('edit!') != 0 && e.indexOf('begin!') != 0 && e.indexOf('end!') != 0)
    if (actions.length == 0 && comp) 
        return { comp: comp.$$}
    if (actions.length == 0) return []
    const priorities = ['addProp']
    const sortedActions = utils.unique(actions).map(action=>action.split('!')).sort((a1,a2) => priorities.indexOf(a2[0]) - priorities.indexOf(a1[0]))
    if (sortedActions[0] && sortedActions[0][0] == 'propInfo') 
        return { comp: tgpModel.compNameOfPath(utils.parentPath(path)), prop: path.split('~').pop() }
    return { comp: path && (path.match(/~/) ? tgpModel.compNameOfPath(path) : path) }
}

async function compReferences(ctx) {
    const { comp, prop, reformatEdits } = ctx.data
    if (reformatEdits)
        return [{...ctx.data}]
    const paths = Object.values(jb.comps).flatMap(comp=>scanForPath(comp,comp.$$ || ''))
    return paths.map(path=>filePosOfPath(path))

    function scanForPath(profile,path) {
        if (!profile || utils.isPrimitiveValue(profile) || typeof profile == 'function') return []
        const res = prop ? (utils.path(jb.comps[profile.$$],'$$') == comp && profile[prop] ? [`${path}~${prop}`] : [])
            : utils.path(jb.comps[profile.$$],'$$') == comp ? [path] : []
        return [ 
            ...res,
            ...Object.keys(profile).flatMap(k=>scanForPath(profile[k],`${path}~${k}`))
        ]
    }
}

async function definition(ctx) {
    const compProps = await calcCompProps(ctx)
    const { actionMap, reformatEdits, inExtension, errors, path, tgpModel, lineText } = compProps
    if (reformatEdits)
        return { errors: ['definition - bad format'], ...compProps }
    const allSemantics = actionMap.filter(e => e.action && e.action.endsWith(path)).map(x => x.action.split('!')[0])
    if (inExtension || allSemantics.includes('function')) {
        return funcLocation()
    } else if (path) {
        const cmpId = tgpModel.compNameOfPath(path)
        return utils.path(tgpModel.comps[cmpId],'$location') || funcLocation()
    } else if (errors) {
        utils.logError('langService definition', {errors, ctx,compProps})
        return compProps
    }

    async function funcLocation() {
        const [, lib, func] = lineText.match(/jb\.([a-zA-Z_0-9]+)\.([a-zA-Z_0-9]+)/) || ['', '', '']
        if (lib && utils.path(jb, [lib, '__extensions'])) {
            // TODO: pass extensions in tgpModel
            const loc = Object.values(jb[lib].__extensions).filter(ext => ext.funcs.includes(func)).map(ext => ext.location)[0]
            const lineOfExt = (+loc.line) || 0
            const fileContent = await jbHost.codePackageFromJson().fetchFile(loc.path)
            const lines = ('' + fileContent).split('\n').slice(lineOfExt)
            const funcHeader = new RegExp(`[^\.]${func}\\s*:|[^\.]${func}\\s*\\(`) //[^{]+{)`)
            const lineOfFunc = lines.findIndex(l => l.match(funcHeader))
            return { ...loc, line: lineOfExt + lineOfFunc }
        }
    }
}

export function editAndCursorOfCompletionItem(item) {
    if (item.edit) return item
    const { text, compId, comp, compLine, tgpModel } = item.compProps
    const itemProps = item.extend ? { ...item, ...item.extend() } : item
    const { op, path, resultPath, whereToLand } = itemProps

    const opOnComp = {}
    utils.path(opOnComp,path.split('~').slice(1),op) // create op as nested object
    const newComp = update(comp,opOnComp)
    resolveCompArgs(newComp,{tgpModel})
    const newRes = prettyPrintWithPositions(newComp, { initialPath: compId, tgpModel })
    const edit = deltaFileContent(text, newRes.text , compLine)

    const cursorPos = itemProps.cursorPos || calcNewPos(newRes)
    return { edit, cursorPos }

    function calcNewPos(prettyPrintData) {
        const TBD = item.compName == 'TBD' || utils.path(itemProps, 'op.$set.$') == 'TBD'
        const _whereToLand = TBD ? 'begin' : (whereToLand || 'edit')
        const { line, col } = getPosOfPath(resultPath || path, [_whereToLand,'prependPT','appendPT'], {prettyPrintData})
        return { TBD, line: line + compLine, col }
    }
}

async function deleteEdits(ctx) {
    const compProps = await calcCompProps(ctx)
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
        let { line, col } = getPosOfPath(path, 'begin',{prettyPrintData})
        if (!line && !col) {
            let { line, col } = getPosOfPath(utils.parentPath(path), 'begin',{prettyPrintData})
        }
        if (!line && !col)
            return utils.logError('delete can not find path', { path })
        return { line: line + compLine, col }
    }
}

async function disableEdits(ctx) {
    const compProps = await calcCompProps(ctx)
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
        let { line, col } = getPosOfPath(path, 'begin',{prettyPrintData})
        return { line: line + compLine, col }
    }
} 

async function duplicateEdits(ctx) {
    const compProps = await calcCompProps(ctx)
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
        let { line, col } = getPosOfPath(path, 'begin',{prettyPrintData})
        if (!line && !col)
            return utils.logError('duplicate can not find target path', { path })
        return { line: line + compLine, col }
    }
}

async function createTestEdits(ctx) {
    const compProps = await calcCompProps(ctx)
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

async function moveInArrayEdits(diff,ctx) {
    const compProps = await calcCompProps(ctx)
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
        const { line, col } = getPosOfPath(path, 'begin',{prettyPrintData})
        if (!line && !col)
            return utils.logError('moveInArray can not find path', { path })
        return { line: line + compLine, col }
    }
}


const langService = {completionItems,definition,compId,compReferences,deleteEdits,duplicateEdits,disableEdits,createTestEdits}

DefComponents(Object.keys(langService), f => Data(`langService.${f}`, {
  autoGen: true,
  impl: ctx => langService[f](ctx)
})
)

Data('langService.calcCompProps', {
  params: [
    {id: 'includeCircuitOptions', as: 'boolean', type: 'boolean<>', byName: true}
  ],
  impl: (ctx,{includeCircuitOptions}) => calcCompProps(ctx,{includeCircuitOptions})
})

Data('langService.editAndCursorOfCompletionItem', {
  params: [
    {id: 'item'}
  ],
  impl: (ctx,{item}) => editAndCursorOfCompletionItem(item)
})

Data('langService.moveInArrayEdits', {
    params: [
        { id: 'diff', as: 'number', defaultValue: '%%' }
    ],
    impl: (ctx,{diff}) => moveInArrayEdits(diff,ctx)
})

