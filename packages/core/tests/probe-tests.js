import { dsls, coreUtils } from '@jb6/core'
import '../misc/probe.js'
import '@jb6/testing'

const { runProbe, runProbeCli } = coreUtils

const { 
  tgp: { Const, TgpType, 
    var : { Var } 
  },
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs }, 
    Boolean: { contains, equals, and },
    Prop: { prop }
  },
  test: { Test,
    test: { dataTest }
  }
} = dsls

Test('coreTest.HelloWorld', {
  impl: dataTest(pipeline('hello world', '%%', join('')), and(contains('hello'), contains('world')))
})

Test('probeTest.helloWorld', {
  impl: dataTest({
    calculate: () => runProbe('test<test>coreTest.HelloWorld~impl~expectedResult'),
    expectedResult: equals('hello world', '%result.0.in.data%')
  })
})

Test('probeTest.innerInArray', {
  impl: dataTest({
    calculate: () => runProbe('test<test>coreTest.HelloWorld~impl~expectedResult~items~0'),
    expectedResult: and(equals('hello world', '%result.0.in.data%'), equals('%result.0.out%', true))
  })
})

Test('probeTest.innerInPipeline', {
  impl: dataTest({
    calculate: () => runProbe('test<test>coreTest.HelloWorld~impl~calculate~operators~0'),
    expectedResult: and(equals('hello world', '%result.0.in.data%'), equals('%result.0.out%', 'hello world'))
  })
})

const cmpAA = Data('cmpAA', {
  impl: 'cmpAA'
})

Test('circuitForAA', {
  HeavyTest: true,
  impl: dataTest(cmpAA(), true)
})

Test('probeTest.calcCircuit', {
  impl: dataTest({
    calculate: () => runProbe('data<common>cmpAA~impl'),
    expectedResult: equals('test<test>circuitForAA', '%circuitCmpId%')
  })
})

Test('probeCliTest.helloWorld', {
  impl: dataTest({
    calculate: async () => {
      const repoRoot = await coreUtils.calcRepoRoot()
      const filePath = `${repoRoot}/hosts/test-project/a-tests.js`
      const { studioImportMap, projectImportMap } = await coreUtils.studioAndProjectImportMaps(filePath)
      return runProbeCli('test<test>myTests.HelloWorld~impl~expectedResult',filePath,{importMap: projectImportMap})
    },
    expectedResult: equals('hello world', '%probeRes.result.0.in.data%'),
    timeout: 1000
  })
})

Test('probeCliTest.requireNode', {
  impl: dataTest({
    calculate: async () => {
      const repoRoot = await coreUtils.calcRepoRoot()
      const filePath = `${repoRoot}/hosts/test-project/a-tests.js`
      const { studioImportMap, projectImportMap } = await coreUtils.studioAndProjectImportMaps(filePath)
      const res = await runProbeCli('test<test>myTests.HelloWorld~impl~expectedResult',filePath,{importMap: projectImportMap, requireNode: true})
      return res
    },
    expectedResult: equals('hello world', '%probeRes.result.0.in.data%'),
    timeout: 1000
  })
})

Test('probeCliTest.findTestFiles', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => {
      const repoRoot = await coreUtils.calcRepoRoot()
      const filePath = `${repoRoot}/hosts/test-project/a-tests.js`
      const tgpModelAll = await coreUtils.dslDocs({dsl: 'common', repoRoot})
      debugger
      const { studioImportMap, projectImportMap, testFiles } = await coreUtils.studioAndProjectImportMaps(filePath)
      const probeResArr = await Promise.all(['cmpA','cmpB','cmpC'].map(cmp => 
        runProbeCli(`data<common>${cmp}~impl`,filePath,{testFiles, importMap: projectImportMap, requireNode: true})))
      const allData = probeResArr.map(x=>x.probeRes.result[0].in.data).join(',')
      return allData
    },
    expectedResult: equals('hello,hello,hello'),
    timeout: 2000
  })
})
