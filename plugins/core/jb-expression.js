import { RT_types, isRefType, resolveFinishedPromise } from './core-utils.js'
import { val, objHandler, isRef, calcVar } from './db.js'
import { log, logError } from './spy.js'

const tostring = RT_types.string, tonumber = RT_types.number

export function calc(_exp, ctx, overrideParentParam ) {
    const { tgpCtx : {parentParam } } = ctx
    const jstype = parentParam?.ref ? 'ref' : parentParam?.as
    let exp = '' + _exp
    if (jstype == 'boolean') return calcBool(exp, ctx)
    if (exp.indexOf('$debugger:') == 0) {
      debugger
      exp = exp.split('$debugger:')[1]
    }
    if (exp.indexOf('$log:') == 0) {
      const out = calc(exp.split('$log:')[1],ctx)
      console.log(out, ctx)
      return out
    }
    if (exp.indexOf('%') == -1 && exp.indexOf('{') == -1) return exp
    if (exp == '{%%}' || exp == '%%')
        return expPart('')
  
    if (exp.lastIndexOf('{%') == 0 && exp.indexOf('%}') == exp.length-2) // just one exp filling all string
      return expPart(exp.substring(2,exp.length-2))
  
    exp = exp.replace(/{%(.*?)%}/g, (match,contents) => tostring(expPart(contents,{ as: 'string'})))
    exp = exp.replace(/{\?(.*?)\?}/g, (match,contents) => tostring(conditionalExp(contents)))
    if (exp.match(/^%[^%;{}\s><"']*%$/)) // must be after the {% replacer
      return expPart(exp.substring(1,exp.length-1))
  
    exp = exp.replace(/%([^%;{}\s><"']*)%/g, (match,contents) => tostring(expPart(contents,{as: 'string'})))
    return exp

    function expPart(expressionPart, _parentParam) {
      return resolveFinishedPromise(evalExpressionPart(expressionPart,ctx, _parentParam || overrideParentParam || parentParam))
    }
    function conditionalExp(exp) {
      // check variable value - if not empty return all exp, otherwise empty
      const match = exp.match(/%([^%;{}\s><"']*)%/)
      if (match && tostring(expPart(match[1])))
        return calc(exp, ctx, { as: 'string' })
      else
        return ''
    }
}

function evalExpressionPart(expressionPart, ctx, overrideParentParam ) {
    const jstype = overrideParentParam?.ref ? 'ref' : overrideParentParam?.as
    // example: %$person.name%.
  
    const parts = expressionPart.split(/[./[]/)
    return parts.reduce((input,subExp,index)=>pipe(input,subExp,index == parts.length-1,index == 0),ctx.data)
  
    function pipe(input,subExp,last,first,invokeFunc) {
      if (subExp == '')
         return input
      if (subExp.match(/]$/))
        subExp = subExp.slice(0,-1)
  
      const refHandler = objHandler(input)
      if (subExp.match(/\(\)$/))
        return pipe(input,subExp.slice(0,-2),last,first,true)
      if (first && subExp.charAt(0) == '$' && subExp.length > 1) {
        const ret = calcVar(subExp.substr(1), ctx, {isRef: isRefType(last && jstype)})
        // const _ctx = ret.creatorCtx ? { data: ctx.data, vars: ctx.vars, tgpCtx: ret.creatorCtx } : ctx
        //const _ctx = ctx // TODO: fix it. ret && ret.runCtx ? new jb.core.jbCtx(ctx, { cmpCtx: ret.runCtx, forcePath: ret.srcPath}) : ctx
        return typeof ret === 'function' && invokeFunc ? ret(ctx) : ret
      }
      const obj = val(input)
      if (subExp == 'length' && obj && typeof obj.length == 'number')
        return obj.length
      if (Array.isArray(obj) && isNaN(Number(subExp)))
        return [].concat.apply([],obj.map(item=>pipe(item,subExp,last,false,refHandler)).filter(x=>x!=null))
  
      if (input != null && typeof input == 'object') {
        if (obj == null) return
        if (typeof obj[subExp] === 'function' && (invokeFunc || obj[subExp].profile && parentParam && parentParam.dynamic)) {
          return obj[subExp](ctx)
        }
        if (subExp.match(/\(\)$/)) {
          const method = subExp.slice(0,-2)
          return typeof obj[method] == 'function' && obj[method]()
        }
        if (subExp.match(/^@/) && obj.getAttribute)
            return obj.getAttribute(subExp.slice(1))
        if (isRefType(jstype)) {
          if (last)
            return refHandler.objectProperty(obj,subExp,ctx)
          if (obj[subExp] === undefined)
            obj[subExp] = implicitlyCreateInnerObject(obj,subExp,refHandler)
        }
        if (last && jstype)
            return RT_types[jstype](obj[subExp])
        return obj[subExp]
      }
    }
}

function implicitlyCreateInnerObject(parent,prop,refHandler) {
    log('core innerObject created',{parent,prop,refHandler})
    parent[prop] = {}
    refHandler.refreshMapDown && refHandler.refreshMapDown(parent)
    return parent[prop]
}

export function calcBool(exp, ctx) {
    if (exp.indexOf('$debugger:') == 0) {
      debugger
      exp = exp.split('$debugger:')[1]
    }
    if (exp.indexOf('$log:') == 0) {
      const calculated = calc(exp.split('$log:')[1],ctx, {as: 'boolean'})
      const result = calcBool(exp.split('$log:')[1], ctx)
      console.log(result, calculated, ctx)
      return result
    }
    if (exp.indexOf('!') == 0)
      return !calcBool(exp.substring(1), ctx)
    const parts = exp.match(/(.+)(==|!=|<|>|>=|<=|\^=|\$=)(.+)/)
    if (!parts) {
      const ref = calc(exp, ctx)
      if (isRef(ref))
        return ref
      
      const _val = tostring(ref)
      if (typeof _val == 'boolean') return _val
      const asString = tostring(_val)
      return !!asString && asString != 'false'
    }
    if (parts.length != 4)
      return logError('invalid boolean expression: ' + exp, {ctx})
    const op = parts[2].trim()
  
    if (op == '==' || op == '!=' || op == '$=' || op == '^=') {
      let [p1, p2] = [doCalcString(parts[1]), doCalcString(parts[3])]
      p2 = (p2.match(/^["'](.*)["']/) || ['',p2])[1] // remove quotes
      if (op == '==') return p1 == p2
      if (op == '!=') return p1 != p2
      if (op == '^=') return p1.lastIndexOf(p2,0) == 0 // more effecient
      if (op == '$=') return p1.indexOf(p2, p1.length - p2.length) !== -1
    }
  
    const [p1,p2] = [doCalcNumber(parts[1]), doCalcNumber(parts[3])]
  
    if (op == '>') return p1 > p2
    if (op == '<') return p1 < p2
    if (op == '>=') return p1 >= p2
    if (op == '<=') return p1 <= p2
  
    function trim(str) {  // trims also " and '
      return str.trim().replace(/^"(.*)"$/,'$1').replace(/^'(.*)'$/,'$1')
    }

    function doCalcString(exp) {
        return tostring(calc(trim(exp), ctx, {as: 'string'} ))
    }
    function doCalcNumber(exp) {
        return tonumber(calc(trim(exp), ctx, {as: 'number'}))
    }
}
