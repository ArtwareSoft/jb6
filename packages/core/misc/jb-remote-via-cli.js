import { jb } from '@jb6/repo'
import './jb-remote.js'   // stripCtx / buildCtx
import './jb-cli.js'      // runCliInContext (spawn transport + dispatchChildLine logger routing)
const { coreUtils } = jb

// run a profile on a fresh process that SHARES the code, with a packed ctx (from stripCtx). The CALLER supplies
// `imports` ({importsStr, projectDir, importMapsInCli}) — discovery is not this layer's job (a bundled lambda passes
// its index.js; an ad-hoc caller passes lang-service's calcImportsForProfile output). The child rebuilds the ctx via
// buildCtx and runs the profile. Two logger use-cases:
//   - testLoggers     → collected via logsAndErrors() and RETURNED in {logs}. (tests/debug)
//   - progressLoggers → wrapped to stderr live → runCliInContext dispatches into the caller's ctx loggers. (UI progress)
// Returns { result, error?, logs? }.
async function runStrippedCli({ profileJson, packed, imports = {}, testLoggers = '', progressLoggers = '', ctx }) {
  const test = [...new Set(['errorLogger', ...testLoggers.split(',').map(s => s.trim()).filter(Boolean)])]   // errorLogger always returned — child errors must reach the caller
  const prog = progressLoggers.split(',').map(s => s.trim()).filter(Boolean)
  const all = [...new Set([...test, ...prog])]
  // the live sink: dispatchChildLine routes child progress into ctx.vars[logger].progress → eventEmitter (the local
  // progress channel a UI/SSE subscribes to). Default it to a fresh ctx with progressLoggers, so callers needn't manage it.
  ctx = ctx || await coreUtils.ensureLoggers(prog)
  const { importsStr = '', projectDir, importMapsInCli } = imports
  const script = `
import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/jb-remote.js'
export async function calc() {
  ${importsStr}
  const loggers = (await coreUtils.ensureLoggers(${JSON.stringify(all)})).vars
  ;${JSON.stringify(prog)}.forEach(n => loggers[n] && coreUtils.wrapLoggerInstanceToStderr(n, loggers[n]))   // progress → stderr live
  try {
    const ctx = coreUtils.buildCtx(${JSON.stringify(packed)}).setVars(loggers)
    const result = coreUtils.stripData(await ctx.run(${JSON.stringify(profileJson)}))
    const logs = Object.fromEntries(${JSON.stringify(test)}.map(n => [n, loggers[n]?.logsAndErrors?.()]))   // testLoggers → returned
    return ${JSON.stringify(test.length > 0)} ? { result, logs } : { result }
  } catch (e) { return { error: coreUtils.stripData(e) } }
}
`
  const res = await coreUtils.runCliInContext(`${script}\n await coreUtils.writeServiceResult(await calc())`,
    { projectDir, importMapsInCli, bindLoggers: progressLoggers, ctx, stream: 'both' })
  return res.result ?? res
}
Object.assign(coreUtils, { runStrippedCli })
