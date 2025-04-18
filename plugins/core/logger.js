import { onInjectExtension } from './jb-core.js'

let spy = null
onInjectExtension('logger', ext => spy = ext.spy )

export function log(logNames, logObj) {
  spy?.log(logNames, logObj)
}

export function logError(err,logObj) {
  const { ctx } = logObj || {}
  const { tgpCtx: { callerStack, creatorStack }} = ctx || {}
  globalThis.window && globalThis.console.error('%c Error: ','color: red', err, logObj, callerStack, creatorStack)
  const errObj = { err , ...logObj, callerStack, creatorStack}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(err)
  spy?.log('error', errObj)
}

export function logException(e,err,logObj) {
  globalThis.window && globalThis.console.log('%c Exception: ','color: red', err, e, logObj)
  const errObj = { e, err, stack: e.stack||'', ...logObj}
  globalThis.jbHost?.process && globalThis.jbHost.process.stderr.write(`${err}\n${e}`)
  spy?.log('exception error', errObj)
}



