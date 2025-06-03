import { jb } from '@jb6/repo'
export { jb }
Object.assign(jb, {
  proxies: {},
  ext: {},
  coreRegistry: {
    consts: {}
  },
  dsls: {
    tgp: { Const }
  },
  ns: {}
})

const isPrimitiveValue = val => ['string','boolean','number'].indexOf(typeof val) != -1

const calcValue = v => jb.dbUtils ? jb.dbUtils?.calcValue(v) : v
const asRef = v => jb.dbUtils ? jb.dbUtils.asRef(v) : logError('asRef. extension db/writable.js was not loaded',{})

const RT_types = {
    asIs: x => x,
    object(value) {
      if (Array.isArray(value))
        value = value[0]
      if (value && typeof value === 'object')
        return calcValue(value)
      return {}
    },
    string(value) {
      if (Array.isArray(value)) value = value[0]
      if (value == null) return ''
      value = calcValue(value)
      if (typeof(value) == 'undefined') return ''
      return '' + value
    },
    number(value) {
      if (Array.isArray(value)) value = value[0]
      if (value == null || value == undefined) return null // 0 is not null
      const num = Number(calcValue(value),true)
      return isNaN(num) ? null : num
    },
    array(value) {
      if (typeof value == 'function' && value.profile)
        value = value()
      value = calcValue(value)
      if (Array.isArray(value)) return value
      if (value == null) return []
      return [value]
    },
    boolean(value) {
      if (Array.isArray(value)) value = value[0]
      value = calcValue(value)
      return value && value != 'false' ? true : false
    },
    single(value) {
      if (Array.isArray(value))
        value = value[0]
      return calcValue(value)
    },
    ref(value) {
      if (Array.isArray(value))
        value = value[0]
      return asRef(value)
    },
    'ref[]': function(value) {
      return asRef(value)
    },
    value(value) {
      return calcValue(value)
    }
}

const isRefType = jstype => jstype === 'ref' || jstype === 'ref[]'

function resolveFinishedPromise(val) {
    if (val && typeof val == 'object' && val._state == 1) // finished promise
      return val._result
    return val
}

const unique = (ar,f) => {
    const keys = {}, res = []
    ar.forEach(x =>{
      const key = f ? f(x) : x
      if (!keys[key]) res.push(x)
      keys[key] = true
    })
    return res
}
const isPromise = v => v && v != null && typeof v.then === 'function'

function compIdOfProfile(profile) {
  if (typeof profile.$$ == 'string') return profile.$$
  const comp = profile.$$ || profile.$
  return `${comp.$dslType}${comp.id}`
}

const compParams = comp => comp?.params || []
const parentPath = path => path.split('~').slice(0,-1).join('~')

const asArray = v => v == null ? [] : (Array.isArray(v) ? v : [v])
const toArray = RT_types.array
const toString = RT_types.string
const toNumber = RT_types.number
const toSingle = RT_types.single
const toJstype = (val,type) => RT_types[type](val)

function log(logNames, logObj) {
  jb.ext.spy?.log(logNames, logObj)
}

function logError(err,logObj) {
  const { ctx, url, line, col } = logObj || {}
  const { jbCtx: { callerStack, creatorStack }} = ctx || { jbCtx: {} }
  const srcLink = url && globalThis.window ? `${window.location.origin}${url}:${line+1}:${col} ` : ''
  globalThis.window && globalThis.console.error(srcLink+'%c Error: ','color: red', err, logObj, callerStack, creatorStack)
  const errObj = { err , ...logObj, callerStack, creatorStack}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(err)
  jb.ext.spy?.log('error', errObj)
}

function logException(e,err,logObj) {
  globalThis.window && globalThis.console.log('%c Exception: ','color: red', err, e, logObj)
  const errObj = { e, err, stack: e.stack||'', ...logObj}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(`${err}\n${e}`)
  jb.ext.spy?.log('exception error', errObj)
}

function Const(id, val) {
  const passiveSym = Symbol.for('passive')
  jb.coreRegistry.consts[id] = markAsPassive(val || {})

  function markAsPassive(obj) {
      if (obj && typeof obj == 'object') {
          obj[passiveSym] = true
          Object.values(obj).forEach(v=>markAsPassive(v))
      }
      return obj
  }    
}

function calcPath(object,_path,value) {
  if (!object) return object
  let cur = object
  if (typeof _path === 'string') _path = _path.split('.')
  _path = asArray(_path)

  if (typeof value == 'undefined') {  // get
    return _path.reduce((o,k)=>o && o[k], object)
  } else { // set
    for(let i=0;i<_path.length;i++)
      if (i == _path.length-1)
        cur[_path[i]] = value
      else
        cur = cur[_path[i]] = cur[_path[i]] || {}
    return value
  }
}

function splitDslType(dslType) {
  return dslType.match(/^([^<]+)<([^>]+)>$/).slice(1)
}

const delay = (mSec,res) => new Promise(r=>setTimeout(()=>r(res),mSec))

function isDelayed(v) {
  if (!v || v.constructor === {}.constructor || Array.isArray(v)) return
  return typeof v === 'object' ? isPromise(v) : typeof v === 'function' && isCallbag(v)
}

function waitForInnerElements(item, {passRx} = {}) { // resolve promises in array and double promise (via array), passRx - does not wait for reactive data to end, and pass it as is
  if (isPromise(item))
    return item.then(r=>waitForInnerElements(r,{passRx}))
  if (!passRx && isCallbag(item))
    return callbagToPromiseArray(item)

  if (Array.isArray(item)) {
    if (! item.find(v=> isCallbag(v) || isPromise(v))) return item
    return Promise.all(item.map(x=>waitForInnerElements(x,{passRx}))).then(items=>items.flatMap(x=>x))
  }
  return item
}

const isCallbag = cb => typeof cb == 'function' && cb.toString().split('=>')[0].split('{')[0].replace(/\s/g,'').match(/start,sink|t,d/)
const callbagToPromiseArray = source => new Promise(resolve => {
  let talkback
  const res = []
  source(0, function toPromiseArray(t, d) {
    if (t === 0) talkback = d
    if (t === 1) res.push(d && d.vars ? d.data : d)
    if (t === 2) resolve(res)
    if (t === 1 || t === 0) talkback(1)  // Pull
  })
})

const subscribe = (source, callback) => {
  let talkback
  source(0, function subscribe(t, d) {
    if (t === 0) talkback = d
    if (t === 1) callback(d)
    if (t === 1 || t === 0) talkback(1)  // Pull
  })
}

const isObject = o => o != null && typeof o === 'object'
const isEmpty = o => Object.keys(o).length === 0

function objectDiff(newObj, orig) {
    if (orig === newObj) return {}
    if (!isObject(orig) || !isObject(newObj)) return newObj
    const deletedValues = Object.keys(orig).reduce((acc, key) =>
        newObj.hasOwnProperty(key) ? acc : { ...acc, [key]: '__undefined'}
    , {})

    return Object.keys(newObj).reduce((acc, key) => {
      if (!orig.hasOwnProperty(key)) return { ...acc, [key]: newObj[key] } // return added r key
      const difference = objectDiff(newObj[key], orig[key])
      if (isObject(difference) && isEmpty(difference)) return acc // return no diff
      return { ...acc, [key]: difference } // return updated key
    }, deletedValues)
}

function compareArrays(arr1, arr2) {
  if (arr1 === arr2)
    return true
  if (!Array.isArray(arr1) && !Array.isArray(arr2)) return arr1 === arr2
  if (!arr1 || !arr2 || arr1.length != arr2.length) return false
  for (let i = 0; i < arr1.length; i++) {
    const key1 = (arr1[i]||{}).key, key2 = (arr2[i]||{}).key
    if (key1 && key2 && key1 === key2 && arr1[i].val === arr2[i].val)
      continue
    if (arr1[i] !== arr2[i]) return false
  }
  return true
}

function sortedArraysDiff(newArr, oldArr, compareFn) {
  const inserted = [], updated  = [], deleted  = []
  let i = 0, j = 0

  while (i < oldArr.length || j < newArr.length) {
    if (i >= oldArr.length) {
      inserted.push(...newArr.slice(j))
      break
    }
    if (j >= newArr.length) {
      deleted.push(...oldArr.slice(i))
      break
    }

    const a = oldArr[i]
    const b = newArr[j]
    const cmp = compareFn(a, b)

    if (cmp < 0) {           // a < b  → present only in oldArr
      deleted.push(a)
      i++
    } else if (cmp > 0) {    // a > b  → present only in newArr
      inserted.push(b)
      j++
    } else {                 // same key
      i++
      j++
    }
  }

  return { inserted, updated, deleted }
}

function logCli(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
  if (globalThis.jbVSCodeLog)
    globalThis.jbVSCodeLog(msg)
  else
    console.error(msg)
}


function stripData(top, { MAX_OBJ_DEPTH = 100, MAX_ARRAY_LENGTH = 10000} = {}) {
  return doStripData(top, { depth: 0, path: ''})

  function doStripData(data, { depth, path} = {}) {
      if (data == null || (path||'').match(/parentNode$/)) return
      const innerDepthAndPath = key => ({depth: (depth || 0) +1, path: [path,key].filter(x=>x).join('~') })

      if (['string','boolean','number'].indexOf(typeof data) != -1) return data
      if (typeof data == 'function')
          return 'function'
      if (depth > MAX_OBJ_DEPTH) {
          logError('stripData too deep object, maybe recursive',{top, path, depth, data})
          return
      }

      if (Array.isArray(data) && data.length > MAX_ARRAY_LENGTH)
          logError('stripData slicing large array',{data})
      if (Array.isArray(data))
          return data.slice(0,MAX_ARRAY_LENGTH).map((x,i)=>doStripData(x, innerDepthAndPath(i)))
      if (typeof data == 'object' && ['DOMRect'].indexOf(data.constructor.name) != -1)
          return Object.fromEntries(Object.keys(data.__proto__).map(k=>[k,data[k]]))
      if (typeof data == 'object' && (data.constructor?.name || '').match(/Error$/))
          return {$$: 'Error', message: data.toString() }
      if (typeof data == 'object' && ['Object','Array'].indexOf(data.constructor?.name) == -1)
          return { $$: data.constructor?.name }
      if (typeof data == 'object')
          return Object.fromEntries(Object.entries(data)
              .filter(e=> data.$ || typeof e[1] != 'function') // if not a profile, block functions
  //                .map(e=>e[0] == '$' ? [e[0], jb.path(data,[jb.core.CT,'comp',jb.core.CT,'fullId']) || e[1]] : e)
              .map(e=>[e[0],doStripData(e[1], innerDepthAndPath(e[0]) )]))
  }
}

const isNode = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string'

export const coreUtils = jb.coreUtils = {
  jb, RT_types, log, logError, logException, logCli, isNode,
  isPromise, isPrimitiveValue, isRefType, resolveFinishedPromise, unique, asArray, toArray, toString, toNumber, toSingle, toJstype, 
  compIdOfProfile, compParams, parentPath, calcPath, splitDslType, stripData,
  delay, isDelayed, waitForInnerElements, isCallbag, callbagToPromiseArray, subscribe, objectDiff, sortedArraysDiff, compareArrays,
  calcValue
}

