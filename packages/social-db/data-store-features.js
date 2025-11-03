import { dsls,jb, coreUtils } from '@jb6/core'

const { 
  tgp: { TgpType },
  'social-db': { DataStoreFeature }
} = dsls


DataStoreFeature('binary', {
  impl: ({}, {}) => ({ props: { binary: true }})
})

DataStoreFeature('validator', {
  params: [
    {id: 'validator', type: 'boolean<common>', dynamic: true },
    {id: 'errorMessage', dynamic: true },
  ]
})

DataStoreFeature('llmGuide', {
  params: [
    {id: 'llmGuide', type: 'doclet<llm-guide>' },
  ]
})

DataStoreFeature('sampleData', {
  params: [
    {id: 'sampleData'}
  ]
})

DataStoreFeature('field', {
  params: [
    {id: 'field', type: 'field' },
  ]
})

DataStoreFeature('embedder', {
  params: [
    {id: 'embedder', type: 'embedder<llm>' },
  ]
})

DataStoreFeature('itemView', {
  params: [
    {id: 'id', as: 'string' },
    {id: 'ui', type: 'comp<react>' },
    {id: 'llmGuide', type: 'doclet<llm-guide>' },
  ]
})

DataStoreFeature('itemEditor', {
  params: [
    {id: 'id', as: 'string' },
    {id: 'ui', type: 'comp<react>' },
    {id: 'llmGuide', type: 'doclet<llm-guide>' },
  ]
})

DataStoreFeature('itemsView', {
  params: [
    {id: 'id', as: 'string' },
    {id: 'ui', type: 'comp<react>' },
    {id: 'llmGuide', type: 'doclet<llm-guide>' },
  ]
})

