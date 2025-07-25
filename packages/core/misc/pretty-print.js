import { dsls, coreUtils } from '@jb6/core'
import '@jb6/core/misc/resolve-types.js'

const { resolveCompArgs, resolveProfileArgs, resolveProfileTypes, sysProps, resolveProfileTop, OrigArgs,
  jbComp, asJbComp, isPrimitiveValue, asArray, calcValue, compIdOfProfile, compByFullId, resolveDelayed } = coreUtils
const {
  common: { Data }
} = dsls

Object.assign(coreUtils,{ prettyPrint, prettyPrintWithPositions, prettyPrintComp})

Data('prettyPrint', {
  params: [
    {id: 'profile', defaultValue: '%%'},
    {id: 'singleLine', as: 'boolean', type: 'boolean', byName: true},
    {id: 'noMacros', as: 'boolean', type: 'boolean'},
    {id: 'type', as: 'string'}
  ],
  impl: (ctx,{profile}) => prettyPrint(calcValue(profile),{ ...ctx.jbCtx.args })
})

const emptyLineWithSpaces = Array.from(new Array(200)).map(_=>' ').join('')

function prettyPrintComp(comp,settings={}) {
  const { tgpModel } = settings
  comp = comp[asJbComp] ? comp[asJbComp] : comp
  const originalParams = comp.params ? (comp.params || []).map(p=>({...p})) : undefined
  const { type, dsl } = typeof comp.$ == 'string' ? tgpModel.dsls.tgp.comp[comp.$] : comp
  Object.assign(comp, {type,dsl})
  resolveProfileTop(comp)
  delete comp.type; delete comp.dsl
  const resolvedParams = comp.params || []
  comp.params = originalParams

  return prettyPrintWithPositions(comp,{...settings, resolvedParams}).text
}

function prettyPrint(val,settings = {}) {
  if (val == null) return ''
  return prettyPrintWithPositions(val,settings).text
}

function compHeader(compId) {
  return `component('${compId.split('>').pop()}', `
}

function prettyPrintWithPositions(val,{colWidth=100,tabSize=2,initialPath='',noMacros,singleLine, depth, tgpModel, type, resolvedParams} = {}) {
  val = (val && val[asJbComp]) || val
  const props = {}
  const startOffset = val.$comp ? compHeader(fullPTId(val)).length : 0

  if (!val || typeof val !== 'object')
    return { text: val != null && val.toString ? val.toString() : JSON.stringify(val), map: {} }
  if (type)
    val.$dslType = type
  if (val.$unresolvedArgs)
    val.$comp ? resolveCompArgs(val,{tgpModel}) : resolveProfileArgs(val,{tgpModel, expectedType: type})

  // first phase - fill the props[path] dictionary with shortest lengths. also composite with innerVals, primitives with tokens(token,action)
  calcValueProps(val,initialPath) 
  // second phase - build list of tokens
  const tokens = calcTokens(initialPath, { depth: depth || 1, useSingleLine: singleLine })
  const res = aggregateTokens(tokens)
  return res

  function aggregateTokens(tokens) {
    const actionMap = []
    let pos = startOffset
    const text = tokens.reduce((acc,{action, token}) => {
      action && actionMap.push({from: pos, to: pos+token.length ,action})
      pos = pos+ token.length
      return acc + token
    }, '')
    return { text, actionMap, tokens, startOffset}
  }

  function calcTokens(path, { depth = 1, useSingleLine }) {
    if (depth > 100) throw `prettyprint structure too deep ${path}`

    const tokens = props[path].token != null ? [props[path]] : props[path].tokens
    if (props[path].indentWithParent && tokens)  { // used by asIs - indent all token lines after the the first line
      const splitWithLines = tokens.flatMap(x => x.token.split('\n').map((line,i)=>({...x, token: line, startWithNewLine: i !=0 })))
      if (splitWithLines.length == tokens.length) 
        return tokens.map(x=>({...x, path}))
      const lastLine = splitWithLines.length - splitWithLines.slice(0).reverse().findIndex(x=>x.startWithNewLine) -1
      splitWithLines[lastLine].lastLine = true

      const fullIndent = '\n' + emptyLineWithSpaces.slice(0,depth*tabSize)
      const lastIndent = '\n' + emptyLineWithSpaces.slice(0,(depth-1)*tabSize)
      return splitWithLines.map((x,i) => ({...x,path,
        token: (x.lastLine ? lastIndent : x.startWithNewLine ? fullIndent : '') + x.token
      }))
    }
    if (tokens)
      return tokens

    const { open, close, isArray, len, singleParamAsArray, primitiveArray, longInnerValInArray, singleFunc, nameValuePattern, token, mixed } = props[path]
    
    const paramProp = path.match(/~params~[0-9]+$/)
    const singleLine = paramProp || useSingleLine || singleFunc || nameValuePattern || primitiveArray || (len < colWidth && !multiLine())
    const separatorWS = primitiveArray ? '' : singleLine ? ' ' : newLine()

    if (!mixed) {
      const innerVals = props[path].innerVals || []
      const vals = innerVals.reduce((acc,{innerPath}, index) => {
        const fullInnerPath = [path,innerPath].join('~')
        const fixedPropName = props[fullInnerPath].fixedPropName
        const propName = isArray ? [] : [{ token: fixedPropName || (fixPropName(innerPath) + ': ')}]
        const separator = index === innerVals.length-1 ? [] : [{token: ',' + separatorWS, action: `insertPT!${fullInnerPath}`}]
        return [
          ...acc,
          ...propName,
          ...calcTokens(fullInnerPath, { depth: singleLine ? depth : depth +1, singleLine}),
          ...separator
        ]
      }, [])

      return [
        ...asArray(open).map(x=>({...x, path, action: `propInfo!${path}`})),
        {token: newLine(), action: `prependPT!${path}`},
        ...vals,
        {token:'', action: `end!${path}`},
        {token: newLine(-1), action: `appendPT!${path}`},
        ...asArray(close).map(x=>({...x, path, action: `appendPT!${path}`})),
      ]
    }

    return calcMixedTokens()

    function newLine(offset = 0) {
      return singleLine ? '' : '\n' + emptyLineWithSpaces.slice(0,(depth+offset)*tabSize)
    }

    function multiLine() {
      const paramsParent = path.match(/~params$/)
      //const manyVals = innerVals.length > 4 && !isArray
      const top = !path.match(/~/g) && !noMacros
      const _longInnerValInArray = !singleParamAsArray && longInnerValInArray
      return paramsParent || top || _longInnerValInArray
    }

    function fixPropName(prop) {
      //if (prop == 'vars') return 'vars'
      return prop.match(/^[$a-zA-Z_][a-zA-Z0-9_]*$/) ? prop : `'${prop}'`
    }

    function calcMixedTokens() {
      const { lenOfValues, id, argsByValue, propsByName, nameValueFold, singleArgAsArray, singleInArray, singleVal, hasParamAsArray } = props[path]
      const mixedFold = nameValueFold || singleVal || !singleLine && lenOfValues && lenOfValues < colWidth
      const valueSeparatorWS = (singleLine || mixedFold) ? primitiveArray ? '' : ' ' : newLine()

      const _argsByValue = argsByValue.reduce((acc,{innerPath, posInArray, isLast}, index) => {
        const fullInnerPath = [path,innerPath].join('~')
        const paramAsArrayPath = [path,hasParamAsArray].join('~')
        const separatorAction = hasParamAsArray && posInArray == null ? `prependPT!${paramAsArrayPath}` 
          : hasParamAsArray && isLast ? `appendPT!${paramAsArrayPath}`
          : hasParamAsArray ? `insertPT!${fullInnerPath}`
          : `addProp!${path}`
        const separator = { token: ',' + valueSeparatorWS, action: separatorAction }
        return [
          ...acc,
          ...calcTokens(fullInnerPath, { depth: (singleLine || mixedFold) ? depth : depth +1, singleLine }),
          ...(index !== argsByValue.length-1 ? [separator] : [])
        ]
      }, [])
      const _propsByName = propsByName.reduce((acc,{innerPath}, index) => {
        const fullInnerPath = [path,innerPath].join('~')
        const fixedPropName = props[fullInnerPath].fixedPropName
        const separator = index != propsByName.length-1 ? [{token: ',' + separatorWS, action: `addProp!${path}`}] : []
        return [
          ...acc,
          {token: fixedPropName || (fixPropName(innerPath) + ': '), action: `propInfo!${fullInnerPath}`},
          ...calcTokens(fullInnerPath, { depth: singleLine ? depth : depth +1, singleLine}),
          ...separator
        ]
      }, [])

      const nameValueSectionsSeparator = {token: ',' + valueSeparatorWS, action: hasParamAsArray ? `appendPT!${path}~${hasParamAsArray}` : `addProp!${path}` }
      const propsByNameSection = propsByName.length ? [
        ...(argsByValue.length ? [nameValueSectionsSeparator] : []),
        {token: '{'+ (newLine() || ' '), action: `addProp!${path}`},
        ..._propsByName,
        {token: (newLine(-1) || ' ') + '}', action: `addProp!${path}`}
      ] : []

      const singleArgAsArrayPath = singleArgAsArray ? `${path}~${singleArgAsArray}` : path
      const actionForFirstArgByValue = !singleArgAsArray || singleLine ? `addProp!${path}` : `prependPT!${singleArgAsArrayPath}`
      const firstArgByValueIsPrimitive = ['string','token'].includes(argsByValue[0]?.type)
      const firstInArray = path.match(/~0$/)
      const parentPath = path.split('~').slice(0,-1).join('~')
      return [
          {token: '', action: `begin!${path}`},
          {token: '', action: `beginToken!${path}`},
          {token: id + '(', action: singleInArray ? `prependPT!${path}` : firstInArray ? `prependPT!${parentPath}` : `setPT!${path}`},
          {token: '', action: `endToken!${path}`},
          {token: '', action: `edit!${path}`},
          //{token: '', action: `addProp!${path}`},
          ...(argsByValue.length && !mixedFold && !firstArgByValueIsPrimitive ? [{token: newLine(), action: actionForFirstArgByValue}] : []),
          ..._argsByValue,
          ...propsByNameSection,
          {token: argsByValue.length && !mixedFold ? newLine(-1) : '', 
            action: hasParamAsArray && propsByName.length == 0 ? `appendPT!${path}~${hasParamAsArray}` : ``},
          {token: ')', action: `addProp!${path}`},
          {token: '', action: `end!${path}`}
        ]
    }
  }

  function calcProfileProps(profile, path, settings = {}) {
    const {forceByName, parentParam, posInArray} = settings
    if (noMacros)
      return asIsProps(profile,path)
    if (profile.$unresolvedArgs)
      resolveProfileArgs(profile)

    if (profile.$ == 'asIs') {
      const toPrint = profile[OrigArgs][0]
      const content = prettyPrint(toPrint,{noMacros: true})
      const tokens = [ 
        {token: 'asIs(', action: `begin!${path}`}, {token: '', action: `edit!${path}`},
        {token: content, action: `asIs!${path}`}, {token: ')', action: `end!${path}`}]
      return props[path] = {tokens, len: content.length + 6, indentWithParent: true }
    }
    if (path.match(/([0-9]+)~defaultValue$/)) {
      const index = path.match(/([0-9]+)~defaultValue$/)[1]
      const resolvedParam = resolvedParams[index]
      const topComp = compByFullId(path.split('~')[0], tgpModel)
      resolveProfileTypes(profile, {tgpModel, expectedType: resolvedParam.$dslType, topComp})
    }

    if (profile.$comp) {
      const cleaned = {...profile }
      if (profile.params)
        cleaned.params = JSON.parse(JSON.stringify(profile.params))
      Object.keys(cleaned).forEach(k=> (k == '$$' || k.match(/^\$.+/)) && delete cleaned[k])
      ;(cleaned.params||[]).forEach(p => delete p.$dslType)
      return asIsProps(cleaned,path)
    }
    const fullptId = (profile.$$ || profile.$)  && compIdOfProfile(profile)
    if (!fullptId) 
      return asIsProps(profile,path)

    const comp = profile.$ instanceof jbComp ? profile.$ : compByFullId(fullptId, tgpModel)
    if (!comp) 
      return asIsProps(profile,path)
    const id = fullptId == 'comp<tgp>tgpComp' ? (profile.$?.id || profile.$) : fullptId.split('>').pop()
    if (typeof id != 'string') debugger

    const params = (comp.params || []).slice(0)
    const param0 = params[0] || {}
    const param1 = params[1] || {}
    let firstParamAsArray = (param0.type||'').indexOf('[]') != -1 && !param0.byName && param0.id
    let secondParamAsArray = param1.secondParamAsArray && param1.id
    let hasParamAsArray = firstParamAsArray || secondParamAsArray

    let paramsByValue = param0.byName ? [] : params.slice(0,2)
    let paramsByName = param0.byName ? params.slice(0) 
      : firstParamAsArray ? params.slice(1) 
      : params.slice(2)
    if (param1.byName && paramsByValue.length)
      paramsByName.unshift(paramsByValue.pop())
    if (comp.macroByValue) {
      paramsByValue = params
      paramsByName = []
    }
    if (profile[param0.id] === undefined || profile.vars && !hasParamAsArray) {
      paramsByValue = []
      paramsByName = params.slice(0)
    }
    if (forceByName) {
      hasParamAsArray = secondParamAsArray = firstParamAsArray = false
      paramsByValue = []
      paramsByName = params.slice(0)
    }

    const varArgs = asArray(profile.vars).map(({name, val, async},i) => ({innerPath: `vars~${i}`, val: {$$: 'var<tgp>Var', name, val,async, ...calcArrayPos(i,profile.vars) }}))
    const varsByValue = hasParamAsArray ? varArgs : []
    //const varsByName = hasParamAsArray ? [] : ['vars']
    const systemProps = sysProps.filter(p=>p != 'vars' || !varsByValue.length).flatMap(p=>profile[p] ? [{innerPath: p, val: profile[p]}] : [])

    const propsByName = systemProps.concat(paramsByName.map(param=>({innerPath: param.id, val: profile[param.id], newLinesInCode: param.newLinesInCode || param.as == 'text'}))).filter(({val})=>val !== undefined)
    const propsByValue = paramsByValue.map(param=>({innerPath: param.id, val: profile[param.id], newLinesInCode: param.newLinesInCode || param.as == 'text'})).filter(({val})=>val !== undefined)
    const firstParamVal = profile[param0.id]
    const secondParamVal = asArray(profile[param1.id])
    const singleFirstParamAsArray = firstParamAsArray && !Array.isArray(firstParamVal) && firstParamVal != null

    const argsOfSingleFirstParam = [{innerPath: param0.id, val: firstParamVal}]
    const argsOfParamAsArray = singleFirstParamAsArray ? argsOfSingleFirstParam
      : firstParamAsArray && firstParamVal ? firstParamVal.map((val,i) => ({innerPath: param0.id + '~' + i, val, ...calcArrayPos(i,firstParamVal)})) 
      : secondParamAsArray ? secondParamVal.map((val,i) => ({innerPath: param1.id + '~' + i, val, ...calcArrayPos(i,secondParamVal)}))
      : []

    const varsLength = varsByValue.length ? calcArrayProps(varsByValue.map(x=>x.val),`${path}~vars`).len : 0
    const paramsAsArrayLength = singleFirstParamAsArray ? calcValueProps(firstParamVal,`${path}~${param0.id}`, {parentParam: param0}).len
      : firstParamAsArray ? calcArrayProps(argsOfParamAsArray.map(x=>x.val),`${path}~${param0.id}`).len 
      : secondParamAsArray ? calcValueProps(firstParamVal,`${path}~${param0.id}`, {parentParam: param0}).len
          + calcArrayProps(argsOfParamAsArray.map(x=>x.val),`${path}~${param1.id}`).len 
      : 0
    const restPropsByValueLength = hasParamAsArray ? 0 :
      propsByValue.reduce((len,elem) => len + calcValueProps(elem.val,`${path}~${elem.innerPath}`,{newLinesInCode: elem.newLinesInCode}).len, 0) + sepLen(propsByValue)
    const propsByNameLength = propsByName.reduce((len,elem) => len + calcValueProps(elem.val,`${path}~${elem.innerPath}`,
      {newLinesInCode: elem.newLinesInCode}).len + elem.innerPath.length+2, 0) + sepLen(propsByName) + (propsByName.length ? 4 : 0)
    const argsByValue = [...varsByValue, ...(secondParamAsArray ? argsOfSingleFirstParam : []), ...(hasParamAsArray ? argsOfParamAsArray: propsByValue)]
    const lenOfValues = varsLength + paramsAsArrayLength + restPropsByValueLength
    const singleArgAsArray = propsByName.length == 0 && firstParamAsArray
    const argsAsArrayOnly = propsByName.length == 0 && hasParamAsArray
    const singleProp = propsByName.length == 0 && propsByValue.length == 1

    const valuePair = propsByName.length == 0 && !varArgs.length && !systemProps.length && propsByValue.length == 2 
      && props[`${path}~${propsByValue[0].innerPath}`].len < colWidth/2
    const nameValuePattern = valuePair && (typeof propsByValue[1].val == 'function' || lenOfValues < colWidth *1.2)
    const nameValueFold = valuePair && !nameValuePattern && propsByValue[1].val && propsByValue[1].val.$ 
      && props[`${path}~${propsByValue[1].innerPath}`].len >= colWidth
    if (lenOfValues >= colWidth && !argsAsArrayOnly && !nameValuePattern &&!nameValueFold && !singleProp)
      return calcProfileProps(profile, path, {...settings, forceByName: true})

    const len = id.length + 2 + lenOfValues + propsByNameLength + (lenOfValues && propsByNameLength ? 2 : 0)
    const singleFunc =  propsByName.length == 0 && !varArgs.length && !systemProps.length && argsByValue.length == 1 && typeof argsByValue[0].val == 'function'
    const singleVal =  propsByName.length == 0 && !varArgs.length && !systemProps.length && argsByValue.length == 1
    const primitiveArray =  propsByName.length == 0 && !varArgs.length && firstParamAsArray && 
      argsByValue.reduce((acc,item)=> acc && isPrimitiveValue(item.val), true)
    const singleInArray = (parentParam?.type || '').indexOf('[]') != -1 && !path.match(/[0-9]$/)
    return props[path] = { len, id, posInArray, argsByValue, propsByName, nameValuePattern, nameValueFold, singleVal, singleFunc, primitiveArray, singleInArray, singleArgAsArray, hasParamAsArray, lenOfValues, mixed: true}
  }

  function calcArrayPos(index,array) {
    return { posInArray: index, isLast: index == array.length -1 }
  }
  function sepLen(array) {
    return Math.max(0,array.length-1)*2
  }

  function asIsProps(profile,path) {
    const defaultImpl = (profile.impl && typeof profile.impl == 'function' && profile.impl.toString() == '({params}) => params')
    const objProps = Object.keys(profile).filter(x=>x!= 'impl' || !defaultImpl).filter(p=>!p.startsWith('$symbol'))
    if (objProps.indexOf('$') > 0) { // make the $ first
      objProps.splice(objProps.indexOf('$'),1);
      objProps.unshift('$');
    }
    const len = objProps.reduce((len,key) => len 
      + calcValueProps(profile[key],`${path}~${key}`).len + key.length + 3,2,{asIs: true})
    const innerVals = objProps.map(prop=>({innerPath: prop}))
    return openCloseProps(path, {token:'{'},{ token:'}'}, { len, simpleObj: true, innerVals})
  }

  function calcArrayProps(array, path) {
    const primitiveArray = array.reduce((acc,item)=> acc && isPrimitiveValue(item), true)
    let longInnerValInArray = false
//      const len = Array.from(array.keys()).map(x=>array[x]).reduce((len,val,i) => {
    const _arr = Object.values(array) 
    const len = _arr.reduce((len,val,i) => {
      const innerLen = calcValueProps(val,`${path}~${i}`, calcArrayPos(i,_arr)).len
      longInnerValInArray = longInnerValInArray || innerLen > 20
      return len + innerLen + 2 
    }, 2)
    return {len, longInnerValInArray, primitiveArray}
  }

  function calcValueProps(val,path,settings) {
    const parentPath = path.split('~').slice(0,-1).join('~')
    if (Array.isArray(val)) 
      return openCloseProps(path, 
        [{token:'[', action: `addProp!${parentPath}`}, {token:'', action: `begin!${path}`}], 
        [{token:'', action: `end!${path}`}, {token:']', action: `appendPT!${path}`}]
        , {...calcArrayProps(val, path), isArray: true, innerVals: Array.from(val.keys()).map((innerPath,i)=>({innerPath, ...calcArrayPos(i,val)})) }
      )
      
    if (val === null) return tokenProps('null', path)
    if (val == globalThis) return tokenProps('err', path)
    if (val === undefined) return tokenProps('undefined', path)

    if (typeof val === 'object') return calcProfileProps(val, path,settings)
    //if (typeof val === 'function' && val[isMacro]) return '' //calcObjProps(val(), path)
    if (typeof val === 'function') return funcProps(val, path)

    const putNewLinesInString = typeof val === 'string' && val.match(/\n/) && settings?.newLinesInCode
    if (typeof val === 'string' && val.indexOf("'") == -1 && !putNewLinesInString)
      return stringValProps(JSON.stringify(val).slice(1,-1).replace(/\\"/g,'"'), "'", path)
    else if (typeof val === 'string')
      return stringValProps(val.replace(/`/g,'\\`').replace(/\$\{/g, '\\${'), "`", path, {putNewLinesInString})
    else if (typeof val === 'boolean')
      return tokenProps(val ? 'true' : 'false',path)
    else if (typeof val === 'number')
      return tokenProps('' + val,path)
    else
      return tokenProps(JSON.stringify(val) || 'undefined', path) // primitives or symbol      
  }

  function openCloseProps(path, open,close, _props) {
    return props[path] = {open,close, ..._props}
  }
  function stringValProps(_str, delim, path, {putNewLinesInString} = {}) {
    const str = putNewLinesInString ? _str : _str.replace(/\n/g,'\\n')

    const parentPath = path.split('~').slice(0,-1).join('~')
    const listBegin = [ {token: '', action: `begin!${path}`}, {token: delim, action1: `addProp!${parentPath}`}, {token: '', action: `edit!${path}`} ]
    const listEnd = str.length == 0 ? [ {token: delim, action: `setPT!${path}`}]
      : [ {token: str.slice(0,1), action: `setPT!${path}`}, {token: str.slice(1) + delim, action: `insideText!${path}`}]
    const tokens = [ 
      {token: '', action: `beginToken!${path}`}, 
      ...listBegin, ...listEnd, 
      {token: '', action: `endToken!${path}`},
      {token: '', action: `end!${path}`}
    ]
    return props[path] = {tokens, len: str.length + 2, type: 'string'}
  }    
  function tokenProps(str, path) {
    const tokens = [ 
      {token: '', action: `beginToken!${path}`},
      {token: '', action: `begin!${path}`}, 
      {token: '', action: `edit!${path}`},
      {token: str.slice(0,1), action: `setPT!${path}`}, {token: str.slice(1), action: `insideToken!${path}`},
      {token: '', action: `endToken!${path}`},
      {token: '', action: `end!${path}`}
    ]
    return props[path] = {tokens, len: str.length, type: 'token' }
  }
  function funcProps(func,path) {
    let asStr = func.toString().trim().replace(/^'([a-zA-Z_\-0-9]+)'/,'$1')
    if (func.fixedName)
      asStr = asStr.replace(/initExtension[^(]*\(/,`${func.fixedName}(`)
    const asynch = asStr.indexOf('async') == 0 ? 'async ' : ''
    const noPrefix = asStr.slice(asynch.length)
    const funcName = func.fixedName || func.name
    const header = noPrefix.indexOf(`${funcName}(`) == 0 ? funcName : noPrefix.indexOf(`function ${funcName}(`) == 0 ? `function ${funcName}` : ''
    const fixedPropName = header ? `${asynch}${header}` : ''
    const text = (fixedPropName ? '' : asynch) + asStr.slice(header.length+asynch.length)
    return props[path] = { token: text, fixedPropName, len: text.length, action: `function!${path}` }
  }
}

