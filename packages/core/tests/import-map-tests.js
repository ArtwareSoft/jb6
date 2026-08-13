import { dsls, ns, coreUtils } from '@jb6/core'
import './import-map-testers.js'

const { 
  test: { Test, 
    test: { dataTest, staticServeConfigTest, calcImportDataTest },
    repo: { Wonder }
  }, 
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs,list }, 
    Boolean: { contains, equals },
    Prop: { prop }
  }
} = dsls
const { json } = ns
const wonderPath = '/home/shaiby/projects/wonder'

Test('importMapTest.jb6Monorepo', {
  impl: staticServeConfigTest({
    transform: list(
      '%repoRootName%',
      '%staticMappings/diskPath%',
      pipeline('%importMap/imports%', property('@jb6/common'))
    ),
    expectedResult: contains('jb6-monorepo', '/packages', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

Test('wonderTest.staticServeConfigTest', {
  HeavyTest: true,
  impl: staticServeConfigTest({
    repo: Wonder(),
    transform: list('%repoRootName%', '%staticMappings/diskPath%', pipeline('%importMap/imports%')),
    expectedResult: contains('wonder', '@wonder', { allText: json.stringify() })
  })
})

// Test('wonderTest.calcTgpModelData', {
//   HeavyTest: true,
//   impl: dataTest({
//     calculate: async () => {
//       const {coreUtils} = await import('@jb6/core')
//       await import('@jb6/lang-service')
//       return coreUtils.calcTgpModelData({
//         entryPointPaths: `${wonderPath}/public/llm-flow/reports-dsl.js`, fetchByEnvHttpServer: 'http://localhost:3000'})
//     },
//     expectedResult: contains('/public/3rd-party/@jb6', '/jb6_packages/common/index.js', {
//       allText: json.stringify()
//     }),
//     timeout: 2000
//   })
// })

Test('wonderTest.nodejs.calcTgpModelData', {
  HeavyTest: true,
  nodeOnly: true,
  impl: dataTest({
    calculate: async ctx => {
        await import('@jb6/lang-service')
        const modelResources = {entryPointPaths: `${wonderPath}/wonder/db/db-drivers.js`,
        fetchByEnvHttpServer: 'http://localhost:3000'}
        return !!(await coreUtils.calcTgpModelData(modelResources, ctx)).dsls.wonder
    },
    expectedResult: '%%',
    timeout: 3000,
    logger: 'langServiceLogger'
  })
})
