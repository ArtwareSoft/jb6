// === COMPLETE DOCLET DSL DEFINITION ===

import { dsls } from '@jb6/core'

const { 
  common: { Data },
  tgp: { TgpType }
} = dsls

// ============================================================================= 
// DOCLET DSL - 
// Guidance LLM doclets codify expert task-solving patterns into structured, reusable templates 
// that teach LLMs how to perform complex tasks consistently and effectively.
// =============================================================================

// Define the DSL types
const Doclet = TgpType('doclet', 'doclet')           // Main documentation container
const Guidance = TgpType('guidance', 'doclet')       // Solution/anti-pattern components
const Evidence = TgpType('evidence', 'doclet') 
const ExplanationPoint = TgpType('explanationPoint', 'doclet') // Individual explanation components
const ProblemStatement = TgpType('problemStatement', 'doclet') // New: Problem statement container

// =============================================================================
// TYPE: doclet - Main documentation container
// =============================================================================

Doclet('exercise', {
  params: [
    {id: 'problem', type: 'problemStatement', mandatory: true},
    {id: 'guidance', type: 'guidance[]', secondParamAsArray: true},
    {id: 'outro', as: 'text', newLinesInCode: true, description: 'Concluding explanation'}
  ]
})

// =============================================================================
// TYPE: problemStatement - Problem statement components
// =============================================================================

ProblemStatement('problem', {
  params: [
    {id: 'statement', as: 'text', mandatory: true, description: 'The core problem statement'},
    {id: 'intro', as: 'text', description: 'Introductory explanation for the problem'}
  ]
})

Doclet('principle', {
  description: 'Fundamental principle for effective LLM documentation',
  params: [
    { id: 'importance', as: 'text', mandatory: true, options: 'critical,high,medium,low' },
    { id: 'rule', as: 'text', mandatory: true, description: 'The principle statement' },
    { id: 'rationale', as: 'text', mandatory: true, description: 'Why this principle matters' },
    { id: 'dslCompIds', as: 'text', description: "Full component IDs to use. E.g., 'guidance<doclet>doNot,data<common>pipeline'" },
    { id: 'guidance', type: 'guidance[]' }
  ]
})

// =============================================================================
// TYPE: guidance - Solution and anti-pattern components
// =============================================================================

Guidance('solution', {
  params: [
    {id: 'code', as: 'text', mandatory: true, byName: true},
    {id: 'points', type: 'explanationPoint[]', secondParamAsArray: true}
  ]
})

Guidance('doNot', {
  params: [
    {id: 'badCode', as: 'text', mandatory: true},
    {id: 'reason', as: 'text', mandatory: true, byName: true}
  ]
})

Guidance('bestPractice', {
  params: [
    { id: 'suboptimalCode', as: 'text', mandatory: true, byName: true },
    { id: 'better', as: 'text', mandatory: true, byName: true },
    { id: 'reason', as: 'text', mandatory: true, byName: true }
  ]
})

Guidance('illegalSyntax', {
  description: 'Documents a piece of code that is syntactically invalid.',
  params: [
    { id: 'badCode', as: 'text', mandatory: true },
    { id: 'reason', as: 'text', mandatory: true, byName: true }
  ]
})

Guidance('mechanismUnderTheHood', {
  description: 'code snippets that explain the dsl implementation',
  params: [
    {id: 'snippet', as: 'text', mandatory: true},
    {id: 'explain', as: 'text'}
  ]
})


ExplanationPoint('explanation', {
  params: [
    {id: 'text', as: 'text', mandatory: true},
  ]
})

ExplanationPoint('syntax', {
  params: [
    {id: 'expression', as: 'text', mandatory: true},
    {id: 'explain', as: 'text', mandatory: true}
  ]
})

ExplanationPoint('whenToUse', {
  params: [
    { id: 'context', as: 'text', mandatory: true }
  ]
})

ExplanationPoint('performance', {
  params: [
    { id: 'characteristic', as: 'text', mandatory: true },
    { id: 'details', as: 'text', byName: true }
  ]
})

ExplanationPoint('comparison', {
  params: [
    { id: 'comparedTo', as: 'text', mandatory: true },
    { id: 'advantage', as: 'text', mandatory: true, byName: true }
  ]
})

ExplanationPoint('tradeoff', {
  params: [
    { id: 'benefit', as: 'text', mandatory: true },
    { id: 'cost', as: 'text', mandatory: true, byName: true }
  ]
})

ExplanationPoint('evidence', {
  params: [
    { id: 'evidence', as: 'text', mandatory: true }
  ]
})

ExplanationPoint('impact', {
  params: [
    { id: 'impact', as: 'text', mandatory: true }
  ]
})

ExplanationPoint('methodology', {
  params: [
    {id: 'steps', as: 'text', mandatory: true},
    {id: 'tools', as: 'text'}
  ]
})

Evidence('research', {
  description: 'Research findings and evidence base',
  params: [
    { id: 'findings', as: 'text', mandatory: true, description: 'Key research conclusions' },
    { id: 'methodology', as: 'text', description: 'How the research was conducted' },
    { id: 'impact', as: 'text', description: 'Measured impact or improvement' }
  ]
})

Evidence('measurement', {
  description: 'Quantified performance or effectiveness data',
  params: [
    { id: 'metric', as: 'text', mandatory: true, description: 'What was measured' },
    { id: 'value', as: 'text', mandatory: true, description: 'The measured value' },
    { id: 'conditions', as: 'text', description: 'Under what conditions this was measured' }
  ]
})

Evidence('benchmark', {
  description: 'Comparative performance data against alternatives',
  params: [
    { id: 'baseline', as: 'text', mandatory: true, description: 'What was compared against' },
    { id: 'improvement', as: 'text', mandatory: true, description: 'How much better/worse' },
    { id: 'context', as: 'text', description: 'Testing context and conditions' }
  ]
})
