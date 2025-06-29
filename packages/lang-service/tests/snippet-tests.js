import { dsls, ns } from '@jb6/core'
import './lang-service-testers.js'

const {
  tgp: { Const
  },
  test: { Test,
    test: { snippetTest }
  },
  common: { Data, Action, Boolean,
    data: { calcCompTextAndCursor, pipeline, list, filter, join, property, obj, delay, pipe, first, slice, asIs }, 
    boolean: { equals, contains, notContains, and, not },
    prop: { prop },
  },
} = dsls

Test('snippet.pipeline', {
  impl: snippetTest(`Data({ impl: pipeline('hello')}) `, equals('hello', '%result%'))
})
