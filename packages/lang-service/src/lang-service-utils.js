import { coreUtils } from '@jb6/core'
import { langServiceUtils } from './lang-service-parsing-utils.js'
import '@jb6/core/misc/calc-import-map.js'

import './probe-suggestions.js'

const { tgpEditorHost, offsetToLineCol, calcProfileActionMap, suggestionsOfProbe } = langServiceUtils
const { jb, calcTgpModelData, compParams, asArray, isPrimitiveValue, calcPath, parentPath, compIdOfProfile, 
    unique, compByFullId, splitDslType, runProbeCli, studioAndProjectImportMaps } = coreUtils

jb.langServiceRegistry = { 
    tgpModels : {}
}

async function calcCompProps(_compTextAndCursor) {
    const compTextAndCursor = _compTextAndCursor ? await _compTextAndCursor : tgpEditorHost().compTextAndCursor()
    const { filePath, compText, inCompOffset } = compTextAndCursor
    jb.langServiceRegistry.tgpModels[filePath] = jb.langServiceRegistry.tgpModels[filePath] || new tgpModelForLangService(await calcTgpModelData({filePath}))
    const tgpModel = jb.langServiceRegistry.tgpModels[filePath]
    return {...compTextAndCursor, tgpModel, ...calcProfileActionMap(compText, {inCompOffset, tgpModel}) }
}

async function provideCompletionItems(compProps, ctx) {
    const { actionMap, inCompOffset, tgpModel } = compProps
    const actions = actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
        .map(e => e.action).filter(e => e.indexOf('edit!') != 0 && e.indexOf('begin!') != 0 && e.indexOf('end!') != 0)
    if (actions.length == 0) return { items: [] }
    const priorities = ['addProp']
    let paramDef = null
    const sortedActions = unique(actions).map(action=>action.split('!')).sort((a1,a2) => priorities.indexOf(a2[0]) - priorities.indexOf(a1[0]))
    let items = sortedActions.reduce((acc, action) => {
        const [op, path] = action
        paramDef = tgpModel.paramDef(path)
        // if (!paramDef)
        //     logError('can not find paramDef for path',{path,ctx})
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
    const { tgpModel } = compProps
    const options = tgpModel.PTsOfPath(path).map(comp => {
        const compId = `${comp.$dslType}${comp.id}`
        return {
            label: comp.id, kind: 2, compId, opKind, path, compProps,
            detail: [comp.description, compId.indexOf('>') != -1 && compId.split('>')[0] + '>'].filter(x => x).join(' '),
            extend(ctx) { return setPTOp(this.path, this.opKind, this.compId, ctx) },
        }
    })
    const isArrayElem = path.match(/~[0-9]+$/)
    const propStr = isArrayElem ? path.split('~').slice(-2).join('~') : path.split('~').pop()
    const propTitle = {
        label: propStr + ': ' + tgpModel.paramType(path), kind: 25, path, extend: () => { }, sortText: '!!02',
        detail: calcPath(tgpModel.paramDef(path), 'description')
    }
    return [propTitle, ...options]

    function setPTOp(path, opKind, compId, ctx) {
        const index = opKind == 'append' ? -1 : opKind == 'insert' ? (+path.split('~').pop() + 1) : opKind == 'prepend' && 0
        const basePath = opKind == 'insert' ? path.split('~').slice(0, -1).join('~') : path
        const basedOnVal = opKind == 'set' && tgpModel.valOfPath(path)
        const { result, cursorPath, whereToLand } = newProfile(compByFullId(compId, tgpModel), {basedOnVal})
        const res = opKind == 'set' ? setOp(path, result, ctx) : addArrayItemOp(basePath, { toAdd: result, index, ctx })
        return {...res, resultPath: [res.resultPath || path,cursorPath].filter(x=>x).join('~'), whereToLand }
    }

    function addArrayItemOp(path, { toAdd, index, srcCtx } = {}) {
        const val = tgpModel.valOfPath(path)
        toAdd = toAdd === undefined ? { $$: 'any<tgp>TBD' } : toAdd
        if (Array.isArray(val)) {
            if (val[index]?.$ == 'TBD')
                return { ...setOp(`${path}~${index}`, toAdd, srcCtx), resultPath: `${path}~${index}` }
            else if (index === undefined || index == -1)
                return { path, op: { $push: [toAdd] }, srcCtx, resultPath: `${path}~${val.length}` }
            else
                return { path, op: { $splice: [[index, 0, toAdd]] }, srcCtx, resultPath: `${path}~${index}` }
        } else if (!val) {
            return { ...setOp(path, toAdd, srcCtx), resultPath: `${path}` } // empty array - lazy add ...
        } else {
            const arrayVal = asArray(val)
            if (index === undefined || index == -1)
                return { ...setOp(path, [...arrayVal, toAdd], srcCtx), resultPath: `${path}~1` }
            else
                return { ...setOp(path, [toAdd, ...arrayVal], srcCtx), resultPath: `${path}~0` }
        }
    }
}

function newProfile(comp, {basedOnPath, basedOnVal} = {}) {
	const currentVal = basedOnVal != null ?  basedOnVal : (basedOnPath && valOfPath(basedOnPath))
	const result = { $$: `${comp.$dslType}${comp.id}`, $dslType: comp.$dslType }
	let cursorPath = '', whereToLand = 'edit'
	const composite = compParams(comp).find(p=>p.composite)
	compParams(comp).forEach(p=>{
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
            return logError(`no param def for path ${path}`, { srcCtx })
        const paramType = tgpModel.paramType(path)
        const result = param.templateValue ? JSON.parse(JSON.stringify(param.templateValue))
            : paramType == 'boolean<common>' ? true
            : paramType.indexOf('data') != -1 ? '' : { $$: 'any<tgp>TBD' }

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
    const { actionMap, inCompOffset, text, filePath, compPos } = compProps
    const item = actionMap.filter(e => e.from <= inCompOffset && inCompOffset < e.to || (e.from == e.to && e.from == inCompOffset))
        .find(e => e.action.indexOf('insideText!') == 0)
    const value = text.slice(item.from - 1, item.to - 1)
    const selectionStart = inCompOffset - item.from + 1
    const input = { value, selectionStart }
    const { line, col } = offsetToLineCol(text, item.from - 1)

    const inCompletionTest = ctx.jbCtx?.creatorStack?.find(x=> x && x.indexOf('completionTest') != -1)
    const extraCode = inCompletionTest ? `
const { test: { Test, test: { dataTest } } } = dsls
${text}
` : ''

    
    const { testFiles } = await studioAndProjectImportMaps(filePath)
    const {probeRes, error, cmd} = await runProbeCli(path, filePath, { testFiles, extraCode, importMap: compProps.tgpModel.projectImportMap })
    if (error) {
        globalThis.showUserMessage && showUserMessage('error', `probe cli failed: ${cmd}`)
        return []
    }
    const suggestions = suggestionsOfProbe(probeRes, input, path) || []

    return (suggestions.options || []).map(option => {
        const { pos, toPaste, tail, text } = option
        const primiteVal = option.valueType != 'object'
        const suffix = primiteVal ? '%' : '/'
        const newText = toPaste + suffix
        const startInInput = pos - tail.length
        const overlap = calcOverlap(newText, input.value.slice(startInInput))
        const suffixExists = input.value.substr(startInInput + overlap)[0] == suffix
        const newVal = input.value.substr(0, startInInput) + newText + input.value.substr(startInInput + overlap + (suffixExists ? 1 : 0))
        const cursorPos = { line: line + compPos.line, col: compPos.col + col + startInInput + toPaste.length + (suffix == '%' ? 2 : 1) }
        return { label: text, path, kind: primiteVal ? 12 : 13, cursorPos, compProps,  op: { $set: newVal } }
    })

    function calcOverlap(s1, s2) {
        for (let i = 0; i < s1.length; i++)
            if (s1[i] != s2[i]) return i
        return s1.length
    }
}

function setOp(path, value, srcCtx) {
    return { op: { $set: value }, path, srcCtx }
}

function cloneProfile(prof) {
	if (!prof || isPrimitiveValue(prof) || typeof prof == 'function') return prof
	return Object.fromEntries(Object.entries(prof).map(([k,v]) =>[k,cloneProfile(v)]))
}

class tgpModelForLangService {
    constructor(tgpModel) {
        Object.assign(this,tgpModel)
        this.ptsOfTypeCache = {}
    }
    valOfPath(path){ 
        return calcPath(this.compById(path.split('~')[0]),path.split('~').slice(1))
    }
    compIdOfPath(path) {
        if (path.indexOf('~') == -1)
            return 'comp<tgp>tgpComp'
        if (path.match(/~\vars$/)) 
            return
        const prof = this.valOfPath(path)
        return prof?.$$ && compIdOfProfile(prof)
    }
    paramDef(path) {
        let _parentPath = parentPath(path)
        let paramName = path.split('~').pop()
        if (!_parentPath)
            return this.compById(path)
        if (!isNaN(Number(paramName))) { // array elements
            path = _parentPath
            paramName = path.split('~').pop()
            _parentPath = parentPath(path)
        }
        if (paramName == 'defaultValue' && this.isParamDef(_parentPath))
        return this.valOfPath(_parentPath)
        const comp = this.compOfPath(_parentPath)
        return compParams(comp).find(p=>p.id==paramName)
    }
    isParamDef(path) {
        const pathAr = path.split('~')
        return pathAr.length == 3 && pathAr[1] == 'params'
    }
    compOfPath(path) { return this.compById(this.compIdOfPath(path)) }
    paramsOfPath(path) { return compParams(this.compOfPath(path)) }
    compById(id) { return compByFullId(id, this) }
    PTsOfType(type,dsl) {
        const dslType = `${type}<${dsl}>`
        if (this.ptsOfTypeCache[dslType])
            return this.ptsOfTypeCache[dslType]
        const res = Object.values(this.dsls[dsl][type])
        res.sort((c1,c2) => this.markOfComp(c2) - this.markOfComp(c1))
        return this.ptsOfTypeCache[dslType] = res
    }
    markOfComp(comp) {
        return +(((comp.category||'').match(/common:([0-9]+)/)||[0,0])[1])
    }
    PTsOfPath(path) {
        const dslType = this.paramType(path)
        const [type, dsl] = splitDslType(dslType)
        return this.PTsOfType(type,dsl)
    }
    paramType(path) {
        const type = this.paramDef(path)?.$dslType
        return type == '$asParent' ? this.paramType(parentPath(path)) : type
    }
    enumOptions(path) { 
        return ((this.paramDef(path) || {}).options ||'').split(',').map(x=> ({code: x.split(':')[0],text: x.split(':')[0]}))
    }
    canWrapWithArray(path) {
        const type = this.paramDef(path) ? (this.paramDef(path).type || '') : ''
        const val = this.valOfPath(path)
        const parentVal = this.valOfPath(parentPath(path))
        return type.includes('[') && !Array.isArray(val) && !Array.isArray(parentVal)
    }
    pluginOfFilePath(filePath) {
        return Object.values(this.plugins).filter(p=>p.files.includes(filePath)).map(p=>p.id)[0]
    }
    fileDsl(filePath) {
        const plugin = this.pluginOfFilePath(filePath)
        return plugin && (((this.plugins[plugin].dslOfFiles || []).find(e=>e[0]==filePath) || [])[1] || plugin.dsl)
    }
    comps() {
        return Object.fromEntries(Object.entries(this.dsls).flatMap(([dsl,types]) => 
          Object.entries(types).flatMap(([type,tgpType]) => Object.entries(tgpType).map(([id,comp]) => [`${type}<${dsl}>${id}`, comp]))))
    }
}

Object.assign(langServiceUtils, { provideCompletionItems, calcCompProps, cloneProfile, tgpModelForLangService,  
    tgpModels: jb.langServiceRegistry.tgpModels
})

