import { dsls } from '@jb6/core'
import '@jb6/common'
import './social-db-tester.js'

const { 
  'social-db': {
    'data-store': { dataStore },
    'db-impl': { inMemoryTesting }
  },
  test: { Test, 
    test: {  }
  }, 
  common: { Boolean,
    Boolean: { equals, contains }
  }
} = dsls

