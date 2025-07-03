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
    {id: 'outro', as: 'string', newLinesInCode: true, description: 'Concluding explanation'}
  ]
})

// =============================================================================
// TYPE: problemStatement - Problem statement components
// =============================================================================

ProblemStatement('problem', {
  params: [
    {id: 'statement', as: 'string', newLinesInCode: true, mandatory: true, description: 'The core problem statement'},
    {id: 'intro', as: 'string', newLinesInCode: true, description: 'Introductory explanation for the problem'}
  ]
})

Doclet('principle', {
  description: 'Fundamental principle for effective LLM documentation',
  params: [
    { id: 'importance', as: 'string', mandatory: true, description: '1-5' },
    { id: 'rule', as: 'string', mandatory: true, description: 'The principle statement' },
    { id: 'rationale', as: 'string', mandatory: true, description: 'Why this principle matters' },
    { id: 'dslCompIds', type: 'data[]', description: "Full component IDs to use. E.g., 'guidance<doclet>doNot'" },
    { id: 'evidence', type: 'explanation<doclet>', description: 'Supporting evidence and examples' }
  ]
})

// =============================================================================
// TYPE: guidance - Solution and anti-pattern components
// =============================================================================

Guidance('solution', {
  params: [
    {id: 'code', newLinesInCode: true, mandatory: true, byName: true},
    {id: 'points', type: 'explanationPoint[]', secondParamAsArray: true}
  ]
})

Guidance('doNot', {
  params: [
    {id: 'badCode', as: 'string', mandatory: true},
    {id: 'reason', as: 'string', mandatory: true, byName: true}
  ]
})

Guidance('bestPractice', {
  params: [
    { id: 'suboptimalCode', as: 'string', mandatory: true, byName: true },
    { id: 'better', as: 'string', mandatory: true, byName: true },
    { id: 'reason', as: 'string', mandatory: true, byName: true }
  ]
})

Guidance('illegalSyntax', {
  description: 'Documents a piece of code that is syntactically invalid.',
  params: [
    { id: 'badCode', as: 'string', mandatory: true },
    { id: 'reason', as: 'string', mandatory: true, byName: true }
  ]
})

Guidance('mechanismUnderTheHood', {
  description: 'code snippets that explain the dsl implementation',
  params: [
    {id: 'snippet', newLinesInCode: true, as: 'text', mandatory: true},
    {id: 'explain', as: 'string'}
  ]
})


ExplanationPoint('explanation', {
  params: [
    {id: 'text', as: 'string', newLinesInCode: true, mandatory: true},
  ]
})

ExplanationPoint('syntax', {
  params: [
    {id: 'expression', as: 'string', mandatory: true},
    {id: 'explain', as: 'string', mandatory: true}
  ]
})

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

// ExplanationPoint('evidence', {
//   params: [
//     { id: 'evidence', as: 'string', mandatory: true }
//   ]
// })

// ExplanationPoint('impact', {
//   params: [
//     { id: 'impact', as: 'string', mandatory: true }
//   ]
// })

// ExplanationPoint('methodology', {
//   params: [
//     {id: 'steps', as: 'string', mandatory: true},
//     {id: 'tools', as: 'string'}
//   ]
// })

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