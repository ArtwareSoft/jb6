import { dsls, coreUtils } from '@jb6/core'
import '@jb6/testing'
import '@jb6/common'

const {
  test: { Test, test: { dataTest } },
  common: { action: { delay }, data: { obj, asIs }, prop: { prop }, boolean: { equals } }
} = dsls

Test('asyncResult.dataTestResolvesObjectProperties', {
  impl: dataTest(obj(prop('rows', delay(1, [{id: 1}]))), equals(asIs({rows: [{id: 1}]})), {
    logger: 'testLogger'
  })
})

Test('asyncResult.defaultPreservesPromises', {
  impl: dataTest({
    calculate: () => !!coreUtils.isPromise(coreUtils.waitForInnerElements({rows: Promise.resolve([{id: 1}])}).rows),
    expectedResult: equals(true),
    logger: 'testLogger'
  })
})

Test('asyncResult.nestedObjectsAndArrays', {
  impl: dataTest({
    calculate: () => Promise.resolve({rows: [[{value: Promise.resolve(2)}]], total: Promise.resolve(3)}),
    expectedResult: equals(asIs({rows: [[{value: 2}]], total: 3})),
    logger: 'testLogger'
  })
})

Test('asyncResult.preservesInstancesAndSyncIdentity', {
  impl: dataTest({
    calculate: async () => {
      const instance = new (class { value = Promise.resolve(2) })()
      const input = {instance, rows: [[1]], value: null}
      return coreUtils.waitForInnerElements(input, {resolveObjectProperties: true}) === input
        && !!coreUtils.isPromise(instance.value)
    },
    expectedResult: equals(true),
    logger: 'testLogger'
  })
})

Test('asyncResult.arrayCompatibility', {
  impl: dataTest({
    calculate: async () => {
      const input = [Promise.resolve([Promise.resolve(5)])]
      return {
        original: await coreUtils.waitForInnerElements(input),
        optedIn: await coreUtils.waitForInnerElements(input, {resolveObjectProperties: true})
      }
    },
    expectedResult: equals(asIs({original: [5], optedIn: [5]})),
    logger: 'testLogger'
  })
})

Test('asyncResult.reactiveProperties', {
  impl: dataTest({
    calculate: async () => {
      const source = (start, sink) => { if (start === 0) { sink(0, () => {}); sink(1, 7); sink(2) } }
      const input = {source}
      return {
        preserved: coreUtils.waitForInnerElements(input, {resolveObjectProperties: true, passRx: true}) === input,
        resolved: await coreUtils.waitForInnerElements(input, {resolveObjectProperties: true})
      }
    },
    expectedResult: equals(asIs({preserved: true, resolved: {source: [7]}})),
    logger: 'testLogger'
  })
})

Test('asyncResult.propertyRejection', {
  impl: dataTest({
    calculate: () => coreUtils.waitForInnerElements({value: Promise.reject(new Error('property failed'))}, {resolveObjectProperties: true})
      .then(() => 'unexpected success', error => error.message),
    expectedResult: equals('property failed'),
    logger: 'testLogger'
  })
})
