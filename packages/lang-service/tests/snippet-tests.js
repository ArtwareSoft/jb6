import { dsls, coreUtils } from '@jb6/core'
import './lang-service-testers.js'
import '@jb6/core/misc/jb-remote-via-cli.js'   // stripCtx/buildCtx + runStrippedCli (over the cli wire)
import '@jb6/core/tests/core-tests.js'         // sCalcLogged (a snippet that emits a logger event)

const {
  common: { Data,
    boolean: { contains, equals }
  },
  tgp: { 'ctx-enricher': { Var } },
  test: { Test,
    test: { snippetTest, dataTest }
  }
} = dsls

// PARALLEL TO THE LAMBDA: from a live ctx, stripCtx the call, discover imports (the lambda uses its bundle instead),
// then runStrippedCli — a fresh process rebuilds the ctx (buildCtx), overlays extraVars, binds the loggers and streams
// their events back into THIS ctx. Asserts the result AND that the snippet's vmLogger event arrived over the wire.
const sCalcLogged = dsls.common.data.sCalcLogged
const runOverCliWithLoggers = Data('runOverCliWithLoggers', {
  params: [{id: 'prof', dynamic: true}],
  impl: async (ctx, {}, {prof}) => {
    const { stripCtx, tgpProfileToJson, calcImportsForProfile, runStrippedCli } = coreUtils
    const profileJson = tgpProfileToJson(prof.profile)
    const packed = stripCtx({ profileJson, ctx: prof.lexicalCtx })
    const imp = await calcImportsForProfile(profileJson, {})                 // test-side discovery (lambda: its index.js)
    const result = await runStrippedCli({ profileJson, packed,
      importsStr: imp.importsStr, projectDir: imp.projectDir, importMapsInCli: imp.importMapsInCli,
      extraVars: { isTest: true }, bindLoggers: 'vmLogger', ctx })           // ctx = the caller sink; vmLogger events stream into ctx.vars.vmLogger
    const logged = (ctx.vars.vmLogger?.vmLog || []).some(e => e.t === 'sCalcLogged')
    return `${result}|logged:${logged}`
  }
})
Test('remoteCli.loggersStreamBack', {
  HeavyTest: true,
  impl: dataTest({
    calculate: runOverCliWithLoggers({ prof: sCalcLogged('P') }),
    expectedResult: equals('done-P|logged:true'),
    logger: 'vmLogger',
    timeout: 20000
  })
})

Test('nodeOnly.basic', {
  nodeOnly: true,
  impl: dataTest({
    calculate: () => typeof process !== 'undefined' && !!process.versions?.node,
    expectedResult: equals(true)
  })
})

Test('snippet.Data', {
  HeavyTest: true,
  impl: snippetTest(`{$: 'data<common>asIs', val: 'hello'}`, equals('hello'))
})

Test('snippet.rx', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `{$: 'data<common>pipe', source: {$: 'reactive-source<rx>rx.data', Data: ['h']} }`,
    expectedResult: contains('h')
  })
})

Test('snippet.typeError', {
  HeavyTest: true,
  impl: snippetTest(`{$: 'data<common>notExistingComp'}`, equals('can not find data<common>notExistingComp'))
})

Test('snippet.ns', {
  HeavyTest: true,
  impl: snippetTest(`{$: 'data<common>math.abs', data: -2}`, equals(2))
})

// Test('snippet.probe', {
//   HeavyTest: true,
//   impl: snippetTest(`{$: 'data<common>pipeline', source: {$: 'data<common>asIs', val: [{a: 1},{a: 2}]}, operators: ['%__a%']}`, equals('1', '%0/in/data/a%'))
// })

// Test('snippet.prompt', {
//   HeavyTest: true,
//   impl: snippetTest(`{$: 'messages<test>user', text: 'hello'}`, equals('hello', '%content%'))
// })

Test('snippet.runTest', {
  HeavyTest: true,
  impl: snippetTest(`{$: 'test<test>completionTest.param1'}`, '%success%')
})

Test('snippet.runReactTest', {
  HeavyTest: true,
  impl: snippetTest({
    profileText: `{$: 'test<test>reactTest', testedComp: ({},{react: {h, useState}}) => () => { const [text, setText] = useState('Click me'); return h('button', { onClick: () => setText('Clicked!') }, text) }, expectedResult: {$: 'boolean<common>contains', text: 'Clicked!'}, userActions: {$: 'ui-action<test>click', buttonText: 'Click me'}}`,
    expectedResult: '%success%',
  })
})

Test('genieTest.snippet.jb', {
  HeavyTest: true,
  impl: snippetTest(`{$: 'data<common>asIs', val: {name: 'Homer'} }`, equals('Homer','%name%'), {
    repoRoot: '/home/shaiby/projects/Genie',
    fetchByEnvHttpServer: 'http://localhost:3000'
  })
})
