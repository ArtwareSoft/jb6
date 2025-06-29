// === COMPLETE DOCLET DSL DEFINITION ===

import { dsls } from '@jb6/core'

const { 
  common: { Data },
  tgp: { TgpType }
} = dsls

// ============================================================================= 
// DOCLET DSL - A language to describe documentation patterns for LLMs
// =============================================================================

// Define the DSL types
const Doclet = TgpType('doclet', 'doclet')           // Main documentation container
const Guidance = TgpType('guidance', 'doclet')       // Solution/anti-pattern components
const Explanation = TgpType('explanation', 'doclet') // Structured explanation container
const ExplanationPoint = TgpType('explanationPoint', 'doclet') // Individual explanation components

// =============================================================================
// TYPE: doclet - Main documentation container
// =============================================================================

Doclet('exercise', {
  params: [
    { id: 'problem', as: 'string', mandatory: true },
    { id: 'guidance', type: 'guidance[]', secondParamAsArray: true }
  ]
})

Doclet('principle', {
  description: 'Fundamental principle for effective LLM documentation',
  params: [
    { id: 'importance', as: 'string', mandatory: true, description: '1-5' },
    { id: 'rule', as: 'string', mandatory: true, description: 'The principle statement' },
    { id: 'rationale', as: 'string', mandatory: true, description: 'Why this principle matters' },
    { id: 'evidence', type: 'explanation<doclet>', description: 'Supporting evidence and examples' }
  ]
})

// =============================================================================
// TYPE: guidance - Solution and anti-pattern components
// =============================================================================

Guidance('solution', {
  params: [
    {id: 'code', type: 'data<common>', mandatory: true}, // dynamicTypeFromParent: "(parent, dsls, topComp) => topComp?.impl?.resultType || 'data<common>'"
    {id: 'expl', type: 'explanation<doclet>'}
  ]
})

Guidance('doNot', {
  params: [
    { id: 'badCode', as: 'string', mandatory: true },
    { id: 'reason', as: 'string', mandatory: true, byName: true }
  ]
})

Guidance('bestPractice', {
  params: [
    { id: 'suboptimalCode', as: 'string', mandatory: true },
    { id: 'better', as: 'string', mandatory: true, byName: true },
    { id: 'reason', as: 'string', mandatory: true, byName: true }
  ]
})

Guidance('research', {
  description: 'Research findings and evidence base',
  params: [
    { id: 'findings', as: 'string', mandatory: true, description: 'Key research conclusions' },
    { id: 'methodology', as: 'string', description: 'How the research was conducted' },
    { id: 'impact', as: 'string', description: 'Measured impact or improvement' }
  ]
})

// =============================================================================
// TYPE: explanation - Structured explanation container
// =============================================================================

Explanation('explanation', {
  params: [
    { id: 'text', as: 'string', mandatory: true },
    { id: 'points', type: 'explanationPoint[]', as: 'array', composite: true, secondParamAsArray: true }
  ]
})

// =============================================================================
// TYPE: explanationPoint - Individual explanation components
// =============================================================================

ExplanationPoint('whenToUse', {
  params: [
    { id: 'context', as: 'string', mandatory: true }
  ]
})

ExplanationPoint('performance', {
  params: [
    { id: 'characteristic', as: 'string', mandatory: true },
    { id: 'details', as: 'string', byName: true }
  ]
})

ExplanationPoint('comparison', {
  params: [
    { id: 'comparedTo', as: 'string', mandatory: true },
    { id: 'advantage', as: 'string', mandatory: true, byName: true }
  ]
})

ExplanationPoint('tradeoff', {
  params: [
    { id: 'benefit', as: 'string', mandatory: true },
    { id: 'cost', as: 'string', mandatory: true, byName: true }
  ]
})

ExplanationPoint('evidence', {
  description: 'Research evidence supporting a claim',
  params: [
    { id: 'data', as: 'string', mandatory: true, description: 'Specific evidence or measurement' }
  ]
})

ExplanationPoint('impact', {
  description: 'Real-world impact or consequence',
  params: [
    { id: 'effect', as: 'string', mandatory: true, description: 'What effect this has in practice' }
  ]
})

ExplanationPoint('methodology', {
  description: 'How to apply this principle or technique',
  params: [
    { id: 'steps', as: 'string', mandatory: true, description: 'Practical application steps' },
    { id: 'tools', as: 'string', description: 'Tools or components to use' }
  ]
})

// =============================================================================
// DOCLET DSL STRUCTURE CREATED:
// =============================================================================

// dsls.doclet.doclet.exercise                 - Problem + solution container
// dsls.doclet.doclet.principle                - LLM guide principle
// dsls.doclet.guidance.solution               - Solution component  
// dsls.doclet.guidance.doNot                  - Anti-pattern component
// dsls.doclet.guidance.bestPractice           - Best practice component
// dsls.doclet.guidance.research               - Research findings
// dsls.doclet.explanation.explanation         - Structured explanation container
// dsls.doclet.explanationPoint.whenToUse     - When to use this approach
// dsls.doclet.explanationPoint.performance   - Performance characteristics
// dsls.doclet.explanationPoint.comparison    - Comparison with alternatives
// dsls.doclet.explanationPoint.tradeoff      - Benefits and costs
// dsls.doclet.explanationPoint.evidence      - Research evidence
// dsls.doclet.explanationPoint.impact        - Real-world impact
// dsls.doclet.explanationPoint.methodology   - Application steps