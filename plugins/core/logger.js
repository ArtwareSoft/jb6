import { jb } from './jb-core.js'

export function log(logNames, logObj) {
  jb.ext.spy?.log(logNames, logObj)
}

export function logError(err,logObj) {
  const { ctx } = logObj || {}
  const { tgpCtx: { callerStack, creatorStack }} = ctx || { tgpCtx: {} }
  globalThis.window && globalThis.console.error('%c Error: ','color: red', err, logObj, callerStack, creatorStack)
  const errObj = { err , ...logObj, callerStack, creatorStack}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(err)
  jb.ext.spy?.log('error', errObj)
}

export function logException(e,err,logObj) {
  globalThis.window && globalThis.console.log('%c Exception: ','color: red', err, e, logObj)
  const errObj = { e, err, stack: e.stack||'', ...logObj}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(`${err}\n${e}`)
  jb.ext.spy?.log('exception error', errObj)
}



