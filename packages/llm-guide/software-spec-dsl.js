import { dsls } from '@jb6/core'
import './llm-guide-dsl.js'

const UseCase = TgpType('use-case', 'llm-guide')
const Requirement = TgpType('requirement', 'llm-guide')
const Actor = TgpType('actor', 'llm-guide')
const ActorFeature = TgpType('actor-feature', 'llm-guide')
const Scenario = TgpType('scenario', 'llm-guide')
const Diagram = TgpType('diagram', 'llm-guide')

Doclet('specification', {
  params: [
    {id: 'introduction', as: 'text'},
    {id: 'useCases', type: 'use-case[]'},
    {id: 'requirements', type: 'requirement[]'},
    {id: 'dataSamples', type: 'dataSample[]'},
    {id: 'expectedOutputs', type: 'dataSample[]'}
  ]
})

Actor('endUser', {
  params: [
    {id: 'description', as: 'text' },
    {id: 'features', type: 'actor-feature' },
  ]
})

Requirement('functional', {
  params: [ {id: 'req', as: 'text' } ]
})

Requirement('nonFunctional', {
  params: [ {id: 'req', as: 'text' } ]
})

Requirement('systemConstraint', {
  params: [ {id: 'req', as: 'text' } ]
})

Requirement('qualityAttribute', {
  params: [ {id: 'req', as: 'text' } ]
})


Actor('admin', {
  params: [
    {id: 'description', as: 'string' },
    {id: 'adminFlow', as: 'text' },
    {id: 'features', type: 'actor-feature' },
  ]
})

ActorFeature('motivation', {
  params: [
    {id: 'motivation', as: 'text' },
  ]  
})

ActorFeature('goal', {
  params: [
    {id: 'goal', as: 'text' },
  ]  
})

ActorFeature('backgroundKnowledge', {
  params: [
    {id: 'knowledge', as: 'text' },
  ]
})

UseCase('useCase', {
  description: 'abstraction of user scenarios. looking at the system from the outside',
  params: [
    {id: 'goal', as: 'text', description: 'the essence of user scenarios'},
    {id: 'importance', as: 'text', mandatory: true, options: 'critical,high,medium,low'},
    {id: 'relevantActors', type: 'actor[]'},
    {id: 'flow', as: 'text', description: 'abstract flow. the essence of user scenarios'},
    {id: 'exampleScenarios', type: 'scenario[]', description: 'can refer to data samples'}
  ]
})

Scenario('inventedUserStory', {
  description: 'very concrete story for the use case',
  params: [
    {id: 'context', as: 'text', description: 'detailed context of the example including names'},
    {id: 'actors', as: 'text', description: 'detailed including name & position'},
    {id: 'motivation', as: 'text', description: 'client and end user motivation'},
    {id: 'interactionDescription', as: 'text', description: 'detailed interaction with system from the user point of view'},
    {id: 'dataSamples'}
  ]
})

Scenario('realClientStory', {
  description: 'very concrete story for the use case',
  params: [
    {id: 'context', as: 'text', description: 'detailed context of the example including names'},
    {id: 'actors', as: 'text', description: 'detailed including name & position'},
    {id: 'motivation', as: 'text', description: 'client and end user motivation'},
    {id: 'interactionDescription', as: 'text', description: 'detailed interaction with system from the user point of view'},
    {id: 'dataSamples'},
    {id: 'webSiteUrl', as: 'string'},
    {id: 'crmId'}
  ]
})

Doclet('TopLevelDesign', {
  params: [
    {id: 'forSpec', type: 'doclet'},
    {id: 'scenario', as: 'text'},
    {id: 'diagrams', type: 'diagram[]'},
  ]
})

Diagram('dataFlowDiagrams', {
  description: 'from: rx/llm-guide/rx-visual-declarative-thinking-llm-guide.js /rx/llm-guide/rx-diagram-enhancement-llm-guide.js and ',
  params: [
    {id: 'explain', as: 'text'},
    {id: 'diagram', as: 'text'}
  ]
})

Diagram('mirableDiagrams', {
  description: 'from: rx/llm-guide/rx-visual-declarative-thinking-llm-guide.js /rx/llm-guide/rx-diagram-enhancement-llm-guide.js and ',
  params: [
    {id: 'explain', as: 'text'},
    {id: 'diagram', as: 'text'}
  ]
})