import { dsls, coreUtils, ns } from '@jb6/core'
import '@jb6/testing'
import '@jb6/llm-guide'
import '@jb6/common'
import '@jb6/core/misc/pretty-print.js'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/core/misc/jb-remote.js'
import '@jb6/core/misc/import-map-services.js'

const {
  tgp: { Const, Component,
    'ctx-enricher': { Var, setVars, enrichCtx, setVar, setData }
  },
  common: { Data,
    action: { delay, runActions },
    boolean: { contains, equals },
    data: { asIs, filter, join, obj, pipeline, property, split },
    prop: { prop }
  },
  test: { Test,
    test: { dataTest }
  }
} = dsls
const { prettyPrintComp, prettyPrint, getCompField, enrichCtxWithDataContext } = coreUtils
const { math } = ns

Const('person', {
    name: 'Homer Simpson',
    male: true,
    isMale: 'yes',
    age: 42
})

Const('peopleWithChildren', [
  {
    name: 'Homer',
    children: [{name: 'Bart'}, {name: 'Lisa'}],
  },
  {
    name: 'Marge',
    children: [{name: 'Bart'}, {name: 'Lisa'}],
  }
])

Const('personWithChildren', {
    name: "Homer Simpson",
    children: [{ name: 'Bart' }, { name: 'Lisa' }, { name: 'Maggie' } ],
    friends: [{ name: 'Barnie' } ],
})
  
Const('people', [
    {name: 'Homer Simpson', age: 42, male: true},
    {name: 'Marge Simpson', age: 38, male: false},
    {name: 'Bart Simpson', age: 12, male: true}
])

Test('coreTest.datum2', {
  impl: dataTest(pipeline('%%', { data: 'hello' }), equals('hello'))
})

Data('math2.abs', {
  impl: ctx => Math.abs(ctx.data)
})

const { math2 } = ns
Test('coreTest.ns', {
  impl: dataTest(math2.abs({data: -2}), equals(2))
})

Data('ns1.nsWithRun', {
  params: [
    {id: 'inp', as: 'string'}
  ],
  impl: '%$inp%'
})
const {ns1} = ns

Test('coreTest.nsWith$run', {
  impl: dataTest(() => ns1.nsWithRun.$run('hello'), equals('hello'))
})

Test('coreTest.forwardWith$run', {
  impl: dataTest(() => Data.forward('forward1').$run('hello'), equals('hello'))
})

Data('forward1', {
  params: [
    {id: 'inp', as: 'string'}
  ],
  impl: '%$inp%'
})

Test('coreTest.propertyPassive', {
  impl: dataTest(property('name', obj(prop('name', 'homer')), { useRef: true }), equals('homer'))
})

const withDefaultValueComp = Component('withDefaultValueComp', {
  type: 'data<common>',
  params: [
    {id: 'val', defaultValue: pipeline('5')}
  ],
  impl: '%$val%'
})

Test('coreTest.DefaultValueComp', {
  impl: dataTest(withDefaultValueComp(), equals(5))
})

const withVarUsingParam = Data('withVarUsingParam', {
  params: [
    {id: 'val', defaultValue: pipeline('5')}
  ],
  impl: pipeline(Var('val1', '%$val%'), '%$val1%')
})

Test('coreTest.withVarUsingParam', {
  impl: dataTest(withVarUsingParam(), equals(5))
})

const getAsBool = Data({
  params: [
    {id: 'val', as: 'boolean', type: 'boolean'}
  ],
  impl: (ctx, {}, {val}) => val
})

Test('coreTest.getExpValueAsBoolean', {
  impl: dataTest(getAsBool('%$person/name%==Homer Simpson'), ({data}) => data === true)
})

Test('coreTest.getValueViaBooleanTypeVar', {
  impl: dataTest({
    vars: [Var('a', 'false')],
    calculate: getAsBool('%$a%'),
    expectedResult: ({data}) => data === false
  })
})

const nullParamPt = Data({
  params: [
    {id: 'tst1', as: 'string'}
  ],
  impl: (ctx, {}, {tst1}) => tst1
})
Test('coreTest.emptyParamAsString', {
  impl: dataTest(nullParamPt(), ctx => ctx.data == '' && ctx.data != null)
})

Test('coreTest.asArrayBug', {
  impl: dataTest({
    vars: Var('items', [{id: 1}, {id: 2}]),
    calculate: ctx => ctx.exp('%$items/id%','array'),
    expectedResult: ctx => ctx.data[0] == 1 && !Array.isArray(ctx.data[0])
  })
})

Test('coreTest.varsCases', {
  impl: dataTest({
    vars: [
      Var('items', [{id: 1}, {id: 2}])
    ],
    calculate: pipeline(Var('sep', '-'), '%$items/id%', '%% %$sep%', join()),
    expectedResult: equals('1 -,2 -')
  })
})

Test('coreTest.asyncVar', {
  impl: dataTest(pipeline(Var('b', 5), Var('a', delay(1, 3)), '%$a%,%$b%'), equals('3,5'))
})

Test('coreTest.vars.setDataEnricher', {
  impl: dataTest(pipeline({ vars: setData('hello'), source: '%%' }), equals('hello'))
})

Test('coreTest.vars.arraySequentialRefs', {
  impl: dataTest(pipeline({ vars: [Var('a', 5), Var('b', '%$a%!')], source: '%$a%,%$b%' }), equals('5,5!'))
})

Test('coreTest.vars.asyncSingle', {
  impl: dataTest(pipeline({ vars: [Var('a', delay(1, 3))], source: '%$a%' }), equals('3'))
})

Test('coreTest.vars.awaitsBetweenStages', {
  // await-by-default: stage 2 (b) must see the resolved value of the async stage 1 (a)
  impl: dataTest(pipeline({ vars: [Var('a', delay(1, 3)), Var('b', '%$a%0')], source: '%$a%,%$b%' }), equals('3,30'))
})

Test('coreTest.vars.setVarsEnricher', {
  impl: dataTest(pipeline({ vars: setVars(asIs({a: 1, b: 2})), source: '%$a%,%$b%' }), equals('1,2'))
})

Test('coreTest.vars.leadingEnricherInPipeline', {
  // non-Var leading ctx-enricher folds into vars via the ctx-enricher abstraction (no Var literal in parse)
  impl: dataTest(pipeline(setData('hi'), '%%!'), equals('hi!'))
})

Test('coreTest.waitForInnerElements.promiseInArray', {
  impl: dataTest(()=> [coreUtils.delay(1,1)], equals(()=>[1]))
})

Test('coreTest.waitForInnerElements.doublePromiseInArray', {
  impl: dataTest(()=> [coreUtils.delay(1).then(()=>[coreUtils.delay(1,5)])], equals(5))
})

const withArrayParam = Data({
  params: [
    {id: 'arr', type: 't1[]'}
  ],
  impl: '%$arr%'
})

const withArrayParam2 = Data({
  params: [
    {id: 'arr', type: 't1[]'}
  ],
  impl: withArrayParam('%$arr%')
})

const t1 = Data({
  type: 't1',
  impl: 'txt'
})

Test('coreTest.usingArrayParam', {
  impl: dataTest(withArrayParam2(t1(), t1()), equals(join(','), 'txt,txt'))
})

Test('coreTest.asIsArray', {
  impl: dataTest(pipeline(asIs([{a: 1}, {a: 2}]), '%a%', join()), equals('1,2'))
})

// Test('coreTest.and', {
//   impl: dataTest({
//     calculate: pipeline('%$people%', filter(and('%age% < 30', '%name% == Bart Simpson')), '%name%', join()),
//     expectedResult: equals('Bart Simpson')
//   })
// })

Test('expTest.select', {
  impl: dataTest({
    calculate: pipeline('%$peopleWithChildren%', pipeline(Var('parent'), '%children%', '%name% is child of %$parent/name%'), join()),
    expectedResult: equals(
      'Bart is child of Homer,Lisa is child of Homer,Bart is child of Marge,Lisa is child of Marge'
    )
  })
})

Test('expTest.boolean', {
  impl: dataTest(pipeline('%$people%', filter('%age%==42'), '%name%'), contains('Homer'))
})

Test('expTest.dynamicExp', {
  impl: dataTest(pipeline('name','%$people/{%%}%'), contains('Homer'))
})

Test('expTest.expWithArray', {
  impl: dataTest('%$personWithChildren/children[0]/name%', equals('Bart'))
})

Test('expTest.arrayLength', {
  impl: dataTest('%$personWithChildren/children/length%', equals(3))
})

Test('expTest.stringLength', {
  impl: dataTest('%$personWithChildren/name/length%', equals(13))
})

Test('expTest.activateMethod', {
  impl: dataTest({
    vars: [
      Var('o1', () => ({ f1: () => ({a:5}) }))
    ],
    calculate: '%$o1/f1()/a%',
    expectedResult: equals(5)
  })
})

Test('expTest.setVars', {
  impl: dataTest({
    vars: setVars(asIs({ full: 'full', 'empty': '' })),
    calculate: '{?%$full% is full?}{?%$empty% is empty?}',
    expectedResult: equals('full is full')
  })
})

Test('expTest.conditionalText', {
  impl: dataTest({
    vars: [
      Var('full', 'full'),
      Var('empty', '')
    ],
    calculate: '{?%$full% is full?}{?%$empty% is empty?}',
    expectedResult: equals('full is full')
  })
})

Test('expTest.expWithArrayVar', {
  impl: dataTest({
    vars: [
      Var('children', '%$personWithChildren/children%')
    ],
    calculate: '%$children[0]/name%',
    expectedResult: equals('Bart')
  })
})

Test('prettyPrintTest.comp', {
  impl: dataTest({
    calculate: () => prettyPrintComp(dsls.test.test['coreTest.asyncVar'], {tgpModel: jb} ),
    expectedResult: equals(asIs(`Test('coreTest.asyncVar', {
  impl: dataTest(pipeline(Var('b', 5), Var('a', delay(1, 3)), '%$a%,%$b%'), equals('3,5'))
})`))
  })
})

Test('prettyPrintTest.leadingEnricher', {
  // pretty-print renders the real ctx-enricher comp (no hardcoded Var synthesis)
  impl: dataTest({
    calculate: () => prettyPrint(pipeline(setData('hi'), '%%!'), { type: 'data<common>', singleLine: true }),
    expectedResult: equals(asIs(`pipeline(setData('hi'), '%%!')`))
  })
})

Test('prettyPrintTest.varsByName', {
  impl: dataTest({
    calculate: () => prettyPrint(split({ vars: Var('a', 100), separator: ',' }), { type: 'data<common>', singleLine: true }),
    expectedResult: equals(asIs(`split({ vars: Var('a', 100), separator: ',' })`))
  })
})

Test('runActions', {
  impl: dataTest({
    vars: Var('res', () => ({ counter: 0})),
    expectedResult: '%$res/counter% == 2',
    runBefore: runActions(({},{res}) => { res.counter++ }, ({},{res}) => res.counter++)
  })
})

// Test('prettyPrintTest.compNoMacros', {
//   impl: dataTest({
//     calculate: () => { 
//       debugger
//       const res = prettyPrintComp(dsls.test.test['coreTest.asyncVar'], {tgpModel: jb, tgpNoMacros: true} ) 
//       debugger
//       return res
//     },
//     expectedResult: equals(asIs(`tgpComp('coreTest.asyncVar', {
//   impl: dataTest(pipeline(Var(), Var(), '%$a%,%$b%'), equals('3,5'))
// })`))
//   })
// })


Test('vmTest.minimal', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => {
      await coreUtils.calcJb6RepoRootAndImportMapsInCli()
      return jb.testingUtils.runTestVm({ testID: 'coreTest.ns', resources: { 
          entryPointPaths: `${jb.coreRegistry.jb6Root}/packages/core/tests/core-tests.js`}})
    },
    expectedResult: equals(2, '%testRes%'),
    timeout: 2000,
    logger: 'vmLogger'
  })
})

const asIsParam = Data({
  params: [
    {id: 'param', as: 'string', asIs: true}
  ],
  impl: (ctx, {}, {param}) => param
})

Test('expTest.asIsParam', {
  impl: dataTest(asIsParam('%%'), contains('%'))
})

// asIs: a query string may contain literal %a% tokens (its own host syntax, not jb vars), so the param is asIs:true —
const asIsQuery = Data({
  params: [
    {id: 'minTotal', as: 'number'},
    {id: 'query', as: 'string', asIs: true}
  ],
  impl: (ctx, {}, {query}) => query.replace(/\{%\$(\w+)%\}/g, (_, name) => coreUtils.calcVar(name, ctx))
})
Test('expTest.asIsQueryArg', {
  impl: dataTest(asIsQuery({ minTotal: 5, query: 'rows where total >= {%$minTotal%} and kind = %a%' }), equals('rows where total >= 5 and kind = %a%'))
})

// the query resolves both an arg (minTotal, in jbCtx.args) and a run-time var (inputFile, supplied via vars:) — all
// in the comp's own frame via calcVar. asIs keeps the raw string; resolution is the comp's own, not the engine's.
const dynamicAsIsQuery = Data({
  params: [
    {id: 'minTotal', as: 'number'},
    {id: 'query', as: 'string', dynamic: true, asIs: true}
  ],
  impl: (ctx, {}, {query}) => query.replace(/\{%\$(\w+)%\}/g, (_, name) => coreUtils.calcVar(name, ctx))
})
Test('expTest.dynamicAsIsQuery', {
  impl: dataTest({
    calculate: dynamicAsIsQuery({
      vars: Var('inputFile', '/tmp/data.json'),
      minTotal: 5,
      query: 'read {%$inputFile%} where total >= {%$minTotal%}'
    }),
    expectedResult: equals('read /tmp/data.json where total >= 5')
  })
})

const sCalc = Data('sCalc', {
  params: [
    {id: 'p1', as: 'string'},
    {id: 'pDyn1', dynamic: true, defaultValue: '%$v1%-%$p1%'}
  ],
  impl: '%$v1%-%$p1%-%$pDyn1()%'
})

const s2Calc = Data('s2Calc', {
  params: [
    {id: 'pDyn2', dynamic: true }
  ],
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

// a VAR (v1, built-in vars) and an ARG (p1) cross the wire; pDyn1 falls to its server-side defaultValue (%$v1%-%$p1%),
// resolved remotely. jb6 semantics: a dynamic body reads its lexical VARS (v1), not a sibling ARG (p1) → its %$p1% empty.
Test('stripCtxTest.var', {
  impl: dataTest(stripAndRun({ vars: Var('v1', 'V'), prof: sCalc('P') }), equals('V-P-V-'))
})

// a nested comp profile (s2Calc, which itself calls sCalc) rides inside the dynamic pDyn1 and resolves remotely;
// its %$v1% var crosses the wire. Result threads through both comps' impls + defaults.
Test('stripCtxTest.doubleDynamicTrue', {
  impl: dataTest({
    calculate: stripAndRun({ vars: Var('v1', 'V'), prof: sCalc('P', s2Calc('%$v1%')) }),
    expectedResult: equals('V-P-V-s2-V-V-')
  })
})


Test('coreUtilsTest.resolveRefs', {
  impl: dataTest({
    calculate: () => {
      const shared = { id: 'shared', value: 42 }
      const dag = {root: [shared,shared], a: {id: 'a', shared}, b : {shared} }

      const stripped = coreUtils.stripData(dag)
      const resolved = coreUtils.resolveRefs(stripped)
      const ref = stripped.root[1]
      return `${ref}-${prettyPrint(resolved)}`      
    },
    expectedResult: equals(`[jbReference: root.0]-{\n  root: [\n    {id: 'shared', value: 42},\n    {id: 'shared', value: 42}\n  ],\n  a: {id: 'a', shared: {id: 'shared', value: 42}},\n  b: {shared: {id: 'shared', value: 42}}\n}`)
  })
})

const dynamicParamForTest = Data('dynamicParamForTest', {
  params: [
    {id: 'func', as: 'string', dynamic: true, defaultValue: 'hello'}
  ]
})

Test('coreUtilsTest.dynamicParamWithErrorSecondParam', {
  impl: dataTest(ctx => dynamicParamForTest.$run().func(ctx, ctx.vars), equals('hello'))
})

const trackOriginForTest = Data('trackOriginForTest', {
  params: [
    {id: 'p1', as: 'string'},
    {id: 'p2', as: 'string'},
  ],
  impl: pipeline(Var('v2','$track:varvar'), '$track:start %$p1% %$p2% %$v2% end')
})

Test('coreUtilsTest.trackOrigin', {
  doNotRunInTests: true,
  impl: dataTest({
    vars: Var('stringsOrigins', obj()),
    calculate: pipeline(trackOriginForTest('hello', 'world'), (ctx) => coreUtils.trackOrigins('start hello world varvar end', ctx)),
    expectedResult: equals(asIs([
        {text: 'start ', range: [0,5], source: 'data<common>trackOriginForTest~impl~source', posInExp: 0},
        {
          text: 'hello',
          range: [6,10],
          source: 'test<test>coreUtilsTest.trackOrigin~impl~calculate~source~p1'
        },
        {text: ' ', range: [11,11], source: 'data<common>trackOriginForTest~impl~source', posInExp: 11},
        {
          text: 'world',
          range: [12,16],
          source: 'test<test>coreUtilsTest.trackOrigin~impl~calculate~source~p2'
        },
        {text: ' ', range: [17,17], source: 'data<common>trackOriginForTest~impl~source', posInExp: 17},
        {text: 'varvar', range: [18,23], source: 'data<common>trackOriginForTest~impl~vars~0~val'},
        {text: ' end', range: [24,27], source: 'data<common>trackOriginForTest~impl~source', posInExp: 23}
    ]))
  })
})

// Test('coreUtilsTest.forLangService', {
//   impl: dataTest(pipeline(Var('val1', '%$val%'), obj(), bookletsContent(), obj()))
// })

// --- color coerce tests ---
import '@jb6/testing/ui-dsl-for-tests.js'

const { ui: { color: { rgb, hexColor, namedColor } } } = dsls
const { colorBox } = dsls.common.data

// test 1: rgb component works
Test('colorTest.rgb', {
  impl: dataTest(rgb(255, 0, 0), equals('%r%', 255))
})

// test 2: hexColor component works
Test('colorTest.hexColor', {
  impl: dataTest(hexColor('#00ff00'), equals('%g%', 255))
})

// test 3: namedColor component works
Test('colorTest.namedColor', {
  impl: dataTest(namedColor('blue'), equals('%b%', 255))
})

// test 4: coerce hex string → hexColor profile (needs jb-args coerce support)
Test('colorTest.coerceHex', {
  impl: dataTest(colorBox('#ff0000'), equals('%color/r%', 255))
})

// test 5: coerce named string → namedColor profile (needs jb-args coerce support)
Test('colorTest.coerceNamed', {
  impl: dataTest(colorBox('red'), equals('%color/r%', 255))
})

// test 6: prettyPrint round-trip — coerced string should print as original string
Test('colorTest.prettyPrintCoerce', {
  impl: dataTest({
    calculate: () => prettyPrintComp(dsls.test.test['colorTest.coerceNamed'], {tgpModel: jb}),
    expectedResult: contains("colorBox('red')")
  })
})


// runBashScript streaming: onStdoutLine / onStderrLine fire per complete line
Test('coreTest.runBashScriptStreamingLines', {
  impl: dataTest({
    calculate: async () => {
      const lines = []
      await coreUtils.runBashScript(
        'echo line1; echo line2 >&2; echo line3',
        {
          onStdoutLine: l => lines.push(`out:${l}`),
          onStderrLine: l => lines.push(`err:${l}`)
        }
      )
      return lines.sort().join('|')
    },
    expectedResult: equals('err:line2|out:line1|out:line3'),
    timeout: 5000
  })
})

// runBashScriptStreamViaJbWebServer: live SSE streaming through the express server.
// requires the dev server running on http://localhost:8083 (with serveCliStream mounted).
// Script has explicit sleeps to force chunks to arrive over time (not in one flush) so we can
// assert the chunks really stream live (verified by gap timing between first/last chunk).
Test('coreTest.runBashScriptStreamViaJbWebServer', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async (ctx, {cliLogger}) => {
      const lines = []
      const chunks = []
      const t0 = Date.now()
      const result = await coreUtils.runBashScriptStreamViaJbWebServer(
        'echo line1; sleep 0.3; echo line2 >&2; sleep 0.3; echo line3',
        {
          onStdoutLine: l => { lines.push(`out:${l}`); cliLogger?.info?.({t:'line', stream:'stdout', line: l, atMs: Date.now()-t0}, {}, {ctx}) },
          onStderrLine: l => { lines.push(`err:${l}`); cliLogger?.info?.({t:'line', stream:'stderr', line: l, atMs: Date.now()-t0}, {}, {ctx}) },
          onStatus:    c => { chunks.push({...c, atMs: Date.now()-t0}); cliLogger?.info?.({t:'chunk', stream: c.stream, bytes: (c.text||'').length, atMs: Date.now()-t0}, {}, {ctx}) }
        },
        { expressUrl: 'http://localhost:8083' }
      )
      const firstAt = chunks[0]?.atMs ?? 0
      const lastAt  = chunks.at(-1)?.atMs ?? 0
      cliLogger?.info?.({t:'done', firstChunkAt: firstAt, lastChunkAt: lastAt, gap: lastAt - firstAt, chunkCount: chunks.length}, {}, {ctx})
      return {
        lines:   lines.sort().join('|'),
        stderr:  String(result.stderr || '').trim(),
        chunkStreams: [...new Set(chunks.map(c=>c.stream))].sort().join(','),
        streamed: (lastAt - firstAt) > 200 // chunks span >200ms => SSE actually streamed
      }
    },
    expectedResult: equals({ lines: 'err:line2|out:line1|out:line3', stderr: 'line2', chunkStreams: 'stderr,stdout', streamed: true }),
    timeout: 15000,
    logger: 'cliLogger'
  })
})

// Regression: ctx.run(profile) should expose the original profile at ctx.jbCtx.profile inside the impl.
// Currently broken — Ctx.run() calls top-level run() with the existing jbCtx (where profile is undefined),
// and inside run() jbCtx.newComp(comp,args) does not carry the original profile forward.
// The impl only sees ctx.jbCtx.args (resolved compArgs), losing the source profile.
const captureJbCtxProfile = Data('captureJbCtxProfile', {
  params: [{id: 'x', as: 'string'}],
  impl: ctx => ({hasProfile: ctx.jbCtx.profile != null, profile$: ctx.jbCtx.profile?.$, hasArgs: ctx.jbCtx.args != null, argsX: ctx.jbCtx.args?.x})
})

Test('coreTest.ctxRunProfileVisibleInImpl', {
  description: 'desc test',
  impl: dataTest(ctx => ctx.run(captureJbCtxProfile({x: 'hello'})), equals(true, '%hasProfile%'))
})

// Regression: Var(name, <profile>) inside enrichCtx must throw — Var stores val literally; use setVar for dynamic profile evaluation.
Test('coreTest.varInEnrichCtx', {
  impl: dataTest({
    calculate: async ctx => (await ctx.run(enrichCtx(Var('x', '3')))).vars.x,
    expectedResult: equals(3)
  })
})

Data('compFieldTest.target', { sampleCtx: setVar('a', '1') })
Component('compFieldTest.target#sampleCtx#2', { type: 'ctx-enricher<tgp>', impl: setVar('c', '3') })
Component('compFieldTest.target#sampleCtx#1', { type: 'ctx-enricher<tgp>', impl: setVar('b', '2') })

Test('compFieldTest.sampleCtx', {
  impl: dataTest({
    setup: ctx => getCompField('data<common>compFieldTest.target', 'sampleCtx').reduce((ctx, enricher) => ctx.run(enricher), ctx),
    calculate: '%$a%,%$b%,%$c%',
    expectedResult: equals('1,2,3')
  })
})

// primitive (non-comp) element type: getCompField returns the inline string, no #-contribution scan
Data('compFieldTest.descTarget', { description: 'hello' })
Test('compFieldTest.description', {
  impl: dataTest({
    calculate: () => getCompField('data<common>compFieldTest.descTarget', 'description').join(),
    expectedResult: equals('hello')
  })
})
