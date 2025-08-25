import { dsls, ns, coreUtils } from '@jb6/core'
import './import-map-testers.js'

const { 
  test: { Test, 
    test: { dataTest, staticServeConfigTest, calcImportDataTest },
    repo: { Genie }
  }, 
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs,list }, 
    Boolean: { contains, equals },
    Prop: { prop }
  }
} = dsls
const { json } = ns

Test('importMapTest.jb6Monorepo', {
  impl: staticServeConfigTest({
    transform: list(
      '%environment%',
      '%staticMappings/diskPath%',
      pipeline('%importMap/imports%', property('@jb6/common'))
    ),
    expectedResult: contains('jb6-monorepo', '/packages', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

Test('importMapTest.genie', {
  impl: staticServeConfigTest({
    repo: Genie(),
    transform: list(
      '%environment%',
      '%staticMappings/diskPath%',
      pipeline('%importMap/imports%', property('@jb6/common'))
    ),
    expectedResult: contains('genie','/home/shaiby/projects/Genie/node_modules/@jb6', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

Test('importMapTest.genie_tests', {
  impl: calcImportDataTest({
    repo: Genie(),
    entryPointPaths: '/home/shaiby/projects/Genie/public/tests/basic-tests.js',
    transform: list(
      '%environment%',
      '%staticMappings/diskPath%',
      '%importMap/imports%'
    ),
    expectedResult: contains('genie', '/home/shaiby/projects/Genie/node_modules/@jb6', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

Test('importMapTest.genie_tests.calcTgpModelData', {
  doNotRunInTests: true,
  impl: dataTest({
    calculate: async () => {
      const {coreUtils} = await import('@jb6/core')
      await import('@jb6/lang-service')
      return coreUtils.calcTgpModelData({
        entryPointPaths: '/home/shaiby/projects/Genie/tests/basic-tests.js', fetchByEnvHttpServer: 'http://localhost:3000'})
    },
    expectedResult: contains('/home/shaiby/projects/Genie/node_modules/@jb6', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})
