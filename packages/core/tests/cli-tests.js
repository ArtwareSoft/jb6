import { dsls, coreUtils } from '@jb6/core'
import '@jb6/testing'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/core/misc/jb-remote.js'         // stripCtx / buildCtx
import '@jb6/core/misc/jb-remote-via-cli.js' // runStrippedCli

// ============================================================================
// OVER-THE-WIRE: run a profile on a process that shares the code, with a stripped slice of the caller's ctx.
//   stripCtx({profileJson, ctx})  → packed (the call's referenced vars/args; bigData→ref; 256K cap)
//   buildCtx(packed)              → Ctx (args back into jbCtx) — run it == running locally
// over a FRESH node process: result returned, testLoggers' logs returned, progressLoggers re-activate local progress.
// ============================================================================
const {
  tgp: { 'ctx-enricher': { Var } },
  common: { Data, boolean: { equals } },
  test: { Test, test: { dataTest } }
} = dsls

const sCalc = Data('sCalc', {
  params: [
    {id: 'p1', as: 'string'},
    {id: 'pDyn1', dynamic: true, defaultValue: '%$v1%-%$p1%'}
  ],
  impl: '%$v1%-%$p1%-%$pDyn1()%'
})

const s2Calc = Data('s2Calc', {
  params: [{id: 'pDyn2', dynamic: true}],
  impl: sCalc('s2-%$pDyn2()%')
})

const stripAndRun = Data('stripAndRun', {
  params: [{id: 'prof', dynamic: true}],
  impl: (ctx, {}, {prof}) => {
    const { stripCtx, buildCtx, tgpProfileToJson } = coreUtils
    const profileJson = tgpProfileToJson(prof.profile)
    const wire = JSON.parse(JSON.stringify(stripCtx({ profileJson, ctx: prof.lexicalCtx })))
    return buildCtx(wire).run(profileJson)
  }
})

Test('stripCtxTest.var', {
  impl: dataTest(stripAndRun({ vars: Var('v1', 'V'), prof: sCalc('P') }), equals('V-P-V-'))
})

Test('stripCtxTest.doubleDynamicTrue', {
  impl: dataTest({
    calculate: stripAndRun({ vars: Var('v1', 'V'), prof: sCalc('P', s2Calc('%$v1%')) }),
    expectedResult: equals('V-P-V-s2-V-V-')
  })
})

const sCalcLogged = Data('sCalcLogged', {
  params: [{id: 'p1', as: 'string'}],
  impl: (ctx, {}, {p1}) => {
    ctx.vars.cliLogger?.progress?.({ t: 'sCalcProgress', p1 })
    ctx.vars.cliLogger?.info?.({ t: 'sCalcLogged', p1 }, {}, {ctx})
    return `done-${p1}`
  }
})

// from a live ctx: stripCtx the call, then runStrippedCli on a FRESH node process that shares the code (imports =
// core-tests.js, like a lambda's package index.js). Captures the LOCAL progress channel (eventEmitter) to prove
// remote progress re-activates it.
const stripAndRunCli = Data('stripAndRunCli', {
  params: [{id: 'prof', dynamic: true}, {id: 'testLoggers', as: 'string'}, {id: 'progressLoggers', as: 'string'}],
  impl: async (ctx, {}, {prof, testLoggers, progressLoggers}) => {
    const { stripCtx, tgpProfileToJson, runStrippedCli, ensureLoggers } = coreUtils
    const profileJson = tgpProfileToJson(prof.profile)
    const packed = stripCtx({ profileJson, ctx: prof.lexicalCtx })
    const sink = await ensureLoggers((progressLoggers || '').split(',').filter(Boolean))
    const localProgress = []
    const onProgress = ev => localProgress.push(ev)
    coreUtils.eventEmitter.on('progress', onProgress)
    const result = await runStrippedCli({ profileJson, packed, imports: { importsStr: "await import('@jb6/core/tests/cli-tests.js')" }, testLoggers, progressLoggers, ctx: sink })
    coreUtils.eventEmitter.off('progress', onProgress)
    return { result, localProgress }
  }
})

// var + arg cross the wire; the remote returns the result string.
Test('cliTest.stripCtxRun', {
  HeavyTest: true,
  impl: dataTest({
    calculate: stripAndRunCli({ vars: Var('v1', 'V'), prof: sCalc('P') }),
    expectedResult: equals('V-P-V-', '%result.result%'),
    timeout: 20000
  })
})

// testLoggers ⇒ the remote RETURNS the snippet's logged record (the info event).
Test('cliTest.stripCtxLogs', {
  HeavyTest: true,
  impl: dataTest({
    calculate: stripAndRunCli({ prof: sCalcLogged('P'), testLoggers: 'cliLogger' }),
    expectedResult: equals('sCalcLogged', '%result.logs.cliLogger.cliLog.1.t%'),
    timeout: 20000
  })
})

// progressLoggers ⇒ the snippet's PROGRESS event re-activates the LOCAL progress mechanism (eventEmitter) — the UI hook.
Test('cliTest.stripCtxProgress', {
  HeavyTest: true,
  impl: dataTest({
    calculate: stripAndRunCli({ prof: sCalcLogged('P'), progressLoggers: 'cliLogger' }),
    expectedResult: equals('sCalcProgress', '%localProgress.0.t%'),
    timeout: 20000
  })
})
