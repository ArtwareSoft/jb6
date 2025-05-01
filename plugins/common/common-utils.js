import { Const, utils as core_utils } from '../core/core-utils.js'
import { log, logError, logException } from '../core/logger.js'
import { jb, Data, Ctx, DefComponents, TgpType, Var } from '../core/tgp.js'
export {jb, Data, Var, Const, Ctx, DefComponents, TgpType, log, logError, logException}

const delay = (mSec,res) => new Promise(r=>setTimeout(()=>r(res),mSec))

const path = (object,_path,value) => {
    if (!object) return object
    let cur = object
    if (typeof _path === 'string') _path = _path.split('.')
    _path = core_utils.asArray(_path)

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

function isDelayed(v) {
  if (!v || v.constructor === {}.constructor || Array.isArray(v)) return
  return typeof v === 'object' ? core_utils.isPromise(v) : typeof v === 'function' && isCallbag(v)
}

function waitForInnerElements(item, {passRx} = {}) { // resolve promises in array and double promise (via array), passRx - does not wait for reactive data to end, and pass it as is
  if (core_utils.isPromise(item))
    return item.then(r=>waitForInnerElements(r,{passRx}))
  if (!passRx && isCallbag(item))
    return callbagToPromiseArray(item)

  if (Array.isArray(item)) {
    if (! item.find(v=> isCallbag(v) || core_utils.isPromise(v))) return item
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


export function sortedArraysDiff(newArr, oldArr, compareFn) {
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

export const utils = { ...core_utils, delay, path, isDelayed, waitForInnerElements, isCallbag, callbagToPromiseArray, subscribe, 
    objectDiff, sortedArraysDiff, log, logError, logException }
