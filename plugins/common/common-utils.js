import { utils as core_utils } from '../core/core-utils'
import { log, logError, logException } from '../core/logger'
const delay = (mSec,res) => new Promise(r=>setTimeout(()=>r(res),mSec))

const path = (object,_path,value) => {
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

const isPromise = v => v && v != null && typeof v.then === 'function'

function isDelayed(v) {
  if (!v || v.constructor === {}.constructor || Array.isArray(v)) return
  return typeof v === 'object' ? isPromise(v) : typeof v === 'function' && isCallbag(v)
}

function waitForInnerElements(item, {passRx} = {}) { // resolve promises in array and double promise (via array), passRx - do not wait for reactive data to end, and pass it as is
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

export const utils = { ...core_utils, unique, delay, path, isPromise, isDelayed, waitForInnerElements, isCallbag, callbagToPromiseArray, subscribe
    , log, logError, logException }
