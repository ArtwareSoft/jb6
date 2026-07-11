import { jb } from '@jb6/repo'
import './core-utils.js'
const { coreUtils } = jb
import './tgp.js'
const spyLog = (...args) => coreUtils.browserSpy?.log(...args)

const {
    tgp: {TgpType, Component}
} = jb.dsls

const Logger = TgpType('logger', 'test')

// URL params reserved by view boot — modules add their own here so URL params can be cleanly partitioned into ctx vars.
jb.coreRegistry.urlReservedParams = jb.coreRegistry.urlReservedParams || {}
Object.assign(jb.coreRegistry.urlReservedParams, {logger: true, browserSpy: true, spy: true})

const ensureLoggers = (names = [], {ctx = new coreUtils.Ctx(), wrapToStderr} = {}) => {
  names = (Array.isArray(names) ? names : String(names).split(',')).map(s => s.trim()).filter(Boolean)
  if (wrapToStderr) coreUtils.browserSpy?.initSpy({spyParam: 'all'})
  return [...new Set(['errorLogger', ...names])].reduce((c, name) => {
    const comp = jb.dsls.test.logger[name] || Logger(name, { impl: domainLogger(name.replace(/Logger$/, '')) })   // unregistered name -> register a default domain logger on the fly
    const inst = c.vars[name] || comp.$runWithCtx(c)
    if (wrapToStderr) wrapLoggerInstanceToStderr(name, inst)
    if (wrapToStderr && name == 'cliLogger') inst.info({t: 'staticImportsLoaded', staticImportsMs: Math.round(globalThis.performance?.now?.() || 0)}, {}, {ctx: c})
    return c.vars[name] ? c : c.setVars({[name]: inst})
  }, ctx)
}
coreUtils.ensureLoggers = ensureLoggers

coreUtils.harvestLogs = (ctx, names) => Object.fromEntries((names || Object.keys(ctx.vars)).filter(n => ctx.vars[n]?.logsAndErrors).map(n => [n, ctx.vars[n].logsAndErrors()]))
coreUtils.activeLoggers = ctx => Object.keys(ctx.vars).filter(n => /Logger$/.test(n)).join(',')

// loggersFromUrl: instantiate loggers named by `?logger=...` URL param + activate spy. Returns ctx with logger vars.
coreUtils.loggersFromUrl = (urlParams, ctx = new coreUtils.Ctx()) => {
  coreUtils.browserSpy?.initSpyByUrl()
  const names = urlParams.get('logger') || ''
  return ensureLoggers(names, {ctx})
}

// ensureLogger: ctx-enricher form (single name). Idempotent — safe in both standalone and test-runner ctxs.
Component('ensureLogger', {
  type: 'ctx-enricher<tgp>',
  params: [{id: 'name', as: 'string', mandatory: true, description: 'logger name (e.g. "wlaLogger")'}],
  impl: (ctx, {}, {name}) => ensureLoggers(name, {ctx})
})

const takeFromVars = (ids, ctx) => Object.fromEntries((ids||'').split(',').map(x=>x.trim()).filter(x=>x).filter(p=>ctx?.vars[p] != null).map(p=>[p,ctx.vars[p]]))

let $source = 'browser'   // machine:pid, computed once. stamped on every entry so parent & child logs both carry their origin
if (typeof process != 'undefined')
  import('os').then(os => $source = `${os.hostname()}:${process.pid}`)

export const domainLogger = Logger('domainLogger', {
  params: [
    {id: 'domain', as: 'string'},
    {id: 'addToR1', as: 'string', description: 'add to first param, e.g. userId,fileName'},
    {id: 'addToR2', as: 'string', description: 'add to second param, e.g. roomId'},
    {id: 'doNotAllowInR1', as: 'string', description: 'e.g. roomId'},
  ],
  impl: (ctx,{},{addToR1, addToR2, domain}) => {
    const logName = `${domain}Log`
    const errorsName = `${domain}Errors`
    const startTime = Date.now()
    let progressSeq = 0   // monotonic per-instance; with $source lets a debugger order emits & detect dropped (dispatch-missing) progress
    return {
      [logName]: [],
      [errorsName]: [],
      info(r1,r2,r3) {
        const enriched = enrichParams(r1,r2,r3)
        this[logName].push({...enriched[0], ...enriched[1]})
        spyLog(logName, {r1: enriched[0], r2: enriched[1], ctx: r3?.ctx})
      },
      warning(r1,r2,r3) {
        const enriched = enrichParams(r1,r2,r3)
        this[logName].push({severity: 'warning', ...enriched[0], ...enriched[1]})
        spyLog(logName, {severity: 'warning', r1: enriched[0], r2: enriched[1], ctx: r3?.ctx})
      },
      warnOnce(key,r1,r2,r3) {   // collapse per-element warning spam: warn first time per key, count the rest
        const seen = this._warnCount || (this._warnCount = {})
        if ((seen[key] = (seen[key]||0)+1) == 1) this.warning({...r1, warnKey: key}, r2, r3)
      },
      error(r1,r2,r3) {
        const enriched = enrichParams(r1, r2, r3)
        this[logName].push({severity: 'error', ...enriched[0], ...enriched[1]})
        this[errorsName].push({...enriched[0], ...enriched[1]})
        spyLog(logName, {severity: 'error', r1: enriched[0], r2: enriched[1], ctx: r3?.ctx})
        const errLog = r3?.ctx?.vars?.errorLogger   // tee: every error is ALSO recorded in the always-on errorLogger
        if (errLog && errLog !== this) errLog.error(r1, r2, r3)
      },
      status(text) { this.progress({t: text, status: true}) },
      progress(payload) {
        const entry = {severity: 'progress', seq: ++progressSeq, at: Date.now() - startTime, $source, logger: `${domain}Logger`, ...payload}
        this[logName].push(entry)
        spyLog(logName, {severity: 'progress', r1: entry})
        coreUtils.eventEmitter.emit('progress', entry)
      },
      $stripData() {
        const custom = coreUtils.loggerSummaries?.[domain]   // per-domain summary override (e.g. rx node rollup); keeps auto-logger path intact
        if (custom) return custom(this[logName], this[errorsName])
        return { $: `${domain}Logger`, logCount: this[logName].length, errorCount: this[errorsName].length, last: this[logName].at(-1)?.t }
      },
      logsAndErrors({stripData = true} = {}) {
        const res = {[logName]: this[logName], [errorsName]: this[errorsName]}
        return stripData ? coreUtils?.stripData(res) || res : res
      }
    }
    function enrichParams(r1, r2, r3 = {}) {
      const {ctx} = r3   // ctx is optional — callbag/no-ctx call sites (rx internals) log without it
      const error = r3.error ? {error: r3.error.stack || r3.error.message || r3.error } : {}
      const resp = r3.response ? { status: r3.response.status, statusText: r3.response.statusText } : {}
      const enrichedR1 = { ...takeFromVars(addToR1,ctx), ...error, ...resp, at: Date.now() - startTime, $source, tgpPath: ctx?.jbCtx.lexicalParentPath, ...r1 }
      const enrichedR2 = { ...takeFromVars(addToR2,ctx), ...r2 }
      return [enrichedR1, enrichedR2]
    }
  }
})

// coreUtils.log: the sole remaining caller is logError/logException (core-utils.js), always severity 'error'.
// All plain-info call sites now log via `xxLogger?.info?.(...)` off ctx.vars. This routes errors to the always-on
// errorLogger (the auto-fail test gate). `error` = a raw Error/exception; enrichParams extracts its .stack.
const bridgeCtx = ensureLoggers('errorLogger')   // prebuilt once: carries the always-on errorLogger
coreUtils.log = (logNames, logObj = {}) => {
  const {ctx: callerCtx, error, ...data} = logObj
  // NEVER instantiate loggers on the hot log() path (running comps mid-probe re-enters the probe machinery -> recursion).
  const errorLogger = callerCtx?.vars?.errorLogger || bridgeCtx.vars.errorLogger
  errorLogger.error({t: logNames, ...data}, {}, {ctx: callerCtx || bridgeCtx, error})
}

const wrapLoggerInstanceToStderr = (name, inst) => {
  if (!inst) return inst   // logger not registered in this process (its defining package wasn't imported) - skip, don't crash the run
  if (inst._wrappedToStderr) return inst   // idempotent - ensureLoggers may run more than once; don't double-emit
  inst._wrappedToStderr = true
  for (const ch of ['info','warning','error','progress']) {   // not 'status': status() delegates to progress() which is already wrapped
    const o = inst[ch]?.bind(inst)
    if (!o) continue
    inst[ch] = (...args) => {
      const event = args[0] && typeof args[0] === 'object' ? {...args[0], $source} : args[0]
      try { process.stderr.write(JSON.stringify({kind:'log', logger:name, channel:ch, event}).replace(/\n/g, '\\n') + '\n') } catch {}
      return o(event, ...args.slice(1))
    }
  }
  return inst
}
coreUtils.wrapLoggerInstanceToStderr = wrapLoggerInstanceToStderr

