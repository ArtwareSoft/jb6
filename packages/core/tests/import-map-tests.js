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
      '%repoRootName%',
      '%staticMappings/diskPath%',
      pipeline('%importMap/imports%', property('@jb6/common'))
    ),
    expectedResult: contains('jb6-monorepo', '/packages', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

Test('genieTest.staticServeConfigTest', {
  HeavyTest: true,
  impl: staticServeConfigTest({
    repo: Genie(),
    transform: list('%repoRootName%', '%staticMappings/diskPath%', pipeline('%importMap/imports%')),
    expectedResult: contains('genie', '/home/shaiby/projects/Genie/public/3rd-party/@jb6', '@wonder', {
      allText: json.stringify()
    })
  })
})

Test('genieTest.importMap', {
  HeavyTest: true,
  impl: calcImportDataTest('/home/shaiby/projects/Genie/public/tests/basic-tests.js', {
    transform: list('%repoRootName%','%staticMappings/diskPath%','%importMap/imports%'),
    expectedResult: contains('genie', '/home/shaiby/projects/Genie/public/3rd-party/@jb6', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

Test('genieTest.calcTgpModelData', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => {
      const {coreUtils} = await import('@jb6/core')
      await import('@jb6/lang-service')
      return coreUtils.calcTgpModelData({
        entryPointPaths: '/home/shaiby/projects/Genie/public/applets/sampleApplet/index.js', fetchByEnvHttpServer: 'http://localhost:3000'})
    },
    expectedResult: contains('/home/shaiby/projects/Genie/public/3rd-party/@jb6', '/jb6_packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

Test('genieTest.nodejs.calcTgpModelData', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => {
      if (!coreUtils.isNode) {
        const script = `
              const {coreUtils} = await import('@jb6/core')
      await import('@jb6/lang-service')
      const result = await coreUtils.calcTgpModelData({ entryPointPaths: '/home/shaiby/projects/Genie/public/applets/sampleApplet/index.js', fetchByEnvHttpServer: 'http://localhost:3000'})
        await coreUtils.writeToStdout(result)
        `
        const res = await coreUtils.runNodeCliViaJbWebServer(script, {projectDir: '/home/shaiby/projects/Genie', importMapsInCli: '/home/shaiby/projects/Genie/public/core/nodejs-importmap.js' })
        return res
      }
    },
    expectedResult: contains({
      text: ['/home/shaiby/projects/Genie/public/3rd-party/@jb6','/jb6_packages/common/index.js','bsg-tests'],
      allText: json.stringify()
    }),
    timeout: 1000
  })
})
