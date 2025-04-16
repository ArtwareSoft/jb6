import { path } from './core-utils.js'

export function log(logName, record, options) { jb.spy && jb.spy.enabled && jb.spy.log(logName, record, options) }

export function logError(err,logObj) {
  const ctx = path(logObj,'ctx')
  const stack = ctx && jb.utils.callStack(ctx)
  jb.frame.window && jb.frame.console.error('%c Error: ','color: red', err, stack, logObj)
  const errObj = { err , ...logObj, stack}
  globalThis.jbHost.process && globalThis.jbHost.process.stderr.write(err)
  jb.spy && jb.spy.log('error', errObj)
}

export function logException(e,err,logObj) {
  jb.frame.window && jb.frame.console.log('%c Exception: ','color: red', err, e, logObj)
  const errObj = { e, err, stack: e.stack||'', ...logObj}
  globalThis.jbHost.process && globalThis.jbHost.process.stderr.write(`${err}\n${e}`)
  jb.spy && jb.spy.log('exception error', errObj)
}
