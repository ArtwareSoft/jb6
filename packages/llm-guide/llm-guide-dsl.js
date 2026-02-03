import { dsls, coreUtils } from '@jb6/core'
import '@jb6/core/misc/pretty-print.js'

const { 
  tgp: { TgpType, Component },
} = dsls

Object.assign(coreUtils, {bookletContent, docletContent})

// ============================================================================= 
// DOCLET DSL - 
// Guidance LLM doclets codify expert task-solving patterns into structured, reusable templates 
// that teach LLMs how to perform complex tasks consistently and effectively.
// =============================================================================

// Define the DSL types
const Doclet = TgpType('doclet', 'llm-guide')           // Main documentation container
const Guidance = TgpType('guidance', 'llm-guide')       // Solution/anti-pattern components
const Evidence = TgpType('evidence', 'llm-guide') 
const ExplanationPoint = TgpType('explanationPoint', 'llm-guide') // Individual explanation components
const ProblemStatement = TgpType('problemStatement', 'llm-guide') // New: Problem statement container
const Validation = TgpType('validation', 'llm-guide')
const Concept = TgpType('concept', 'llm-guide')
const Booklet = TgpType('booklet', 'llm-guide') // documentation package for llm prompt

// =============================================================================
// TYPE: doclet - Main documentation container
// =============================================================================
Component('howTo', {
  type: 'doclet<llm-guide>',
  params: [
    {id: 'problem', type: 'problemStatement', mandatory: true},
    {id: 'guidance', type: 'guidance[]', secondParamAsArray: true},
    {id: 'outro', as: 'text', description: 'Concluding explanation'},
    {id: 'testLlmUnderstanding', type: 'validation[]'}
  ]
})

Component('principle', {
  type: 'doclet<llm-guide>',
  description: 'Fundamental principle for effective LLM documentation',
  params: [
    {id: 'importance', as: 'text', mandatory: true, options: 'critical,high,medium,low'},
    {id: 'rule', as: 'text', mandatory: true, description: 'The principle statement'},
    {id: 'rationale', as: 'text', mandatory: true, description: 'Why this principle matters'},
    {id: 'guidance', type: 'guidance[]'},
    {id: 'testLlmUnderstanding', type: 'validation[]'}
  ]
})

Component('fundamentalLlmMethodology', {
  type: 'doclet<llm-guide>',
  description: 'Fundamental methodology for LLM guide writing process',
  params: [
    {id: 'importance', as: 'text', mandatory: true, options: 'critical,high,medium,low'},
    {id: 'rule', as: 'text', mandatory: true},
    {id: 'rationale', as: 'text', mandatory: true},
    {id: 'process', as: 'text', description: 'Step-by-step process'},
    {id: 'guidance', type: 'guidance[]'},
    {id: 'testLlmUnderstanding', type: 'validation[]'}
  ]
})

Component('situationalAwareness', {
  type: 'doclet<llm-guide>',
  params: [
    {id: 'youAre', as: 'text', mandatory: true, byName: true},
    {id: 'yourGoal', as: 'text', mandatory: true },
    {id: 'concepts', type: 'concept[]' },
    {id: 'context', as: 'text', description: 'Situational context, constraints, and operational modes'},
  ]
})

Component('outputFormat', {
  type: 'doclet<llm-guide>',
  params: [
    {id: 'YOU_MUST_REPLY_WITH_THIS_OUTPUT_FORMAT', as: 'text', mandatory: true, byName: true},
    {id: 'Do', type: 'guidance[]' },
    {id: 'explanation', type: 'explanationPoint[]' }
  ]
})

Concept('concept', {
  params: [
    {id: 'title', as: 'string' },
    {id: 'explanation', type: 'explanationPoint[]', byName: true },
    {id: 'guidance', type: 'guidance[]' },
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

ProblemStatement('context', {
  params: [
    {id: 'description', as: 'text', mandatory: true },
  ]
})

// =============================================================================
// TYPE: guidance - Solution and anti-pattern components
// =============================================================================

Guidance('proceduralSolution', {
  description: 'Solution using step-by-step procedures and workflows',
  params: [
    {id: 'procedure', as: 'text', description: 'Name/description of the procedure', templateValue: ''},
    {id: 'usefulPoints', type: 'explanationPoint[]', byName: true},
    {id: 'steps', type: 'step[]', mandatory: true, description: 'Ordered sequence of steps'},
    {id: 'summaryPoints', type: 'explanationPoint[]'}
  ]
})

const Step = TgpType('step', 'llm-guide')
Step('step', {
  params: [
    {id: 'action', as: 'text', mandatory: true, description: 'What to do'},
    {id: 'purpose', as: 'text', description: 'Why this step matters'},
    {id: 'details', as: 'text', description: 'How to implement this step'},
    {id: 'validation', type: 'validation[]', description: 'How to verify step completion - can be text or validation object'},
    {id: 'mcpTool', type: 'tool<mcp>', description: 'Optional MCP tool to execute as part of this step'},
    {id: 'points', type: 'explanationPoint[]', description: 'Detailed explanations for this step'}
  ]
})

Guidance('mustDo', {
  params: [
    {id: 'do', as: 'text', mandatory: true, templateValue: '' },
    {id: 'points', type: 'explanationPoint[]', secondParamAsArray: true }
  ]
})

Guidance('Do', {
  params: [
    {id: 'do', as: 'text', mandatory: true },
    {id: 'points', type: 'explanationPoint[]', secondParamAsArray: true }
  ]
})

Guidance('option', {
  params: [
    {id: 'do', as: 'text', mandatory: true },
    {id: 'points', type: 'explanationPoint[]', secondParamAsArray: true }
  ]
})

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

// =============================================================================
// TYPE: ExplanationPoint
// =============================================================================

ExplanationPoint('p', {
  description: 'Single line bullet-point',
  params: [
    {id: 'text', as: 'string', mandatory: true},
  ]
})

ExplanationPoint('explanation', {
  params: [
    {id: 'text', as: 'text', mandatory: true},
  ]
})

ExplanationPoint('implication', {
  params: [
    {id: 'implication', as: 'text', mandatory: true },
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

ExplanationPoint('detailedEvidence', {
  params: [
    { id: 'evidence', type: 'evidence', mandatory: true }
  ]
})

ExplanationPoint('impact', {
  params: [
    { id: 'impact', as: 'text', mandatory: true }
  ]
})

ExplanationPoint('methodology', {
  params: [
    {id: 'methodology', as: 'text', mandatory: true},
  ]
})

// =============================================================================
// TYPE: Evidence
// =============================================================================

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

// New step type for procedural solutions



Validation('multipleChoiceQuiz', {
  description: 'Multiple choice question with external answer key',
  params: [
    {id: 'question', as: 'text', mandatory: true, description: 'The question to answer'},
    {id: 'options', as: 'array', mandatory: true, description: 'Array of possible answers'},
    {id: 'scrambledAnswer', as: 'string', mandatory: true, description: 'use scrambleText with unscramble to check your result'},
  ]
})

Validation('predictResultQuiz', {
  description: 'Predict the outcome of a code snippet or operation',
  params: [
    {id: 'scenario', as: 'text', mandatory: true, description: 'Code or scenario to analyze'},
    {id: 'context', as: 'text', description: 'Additional context needed'},
    {id: 'scrambledAnswer', as: 'string', mandatory: true, description: 'use scrambleText with unscramble to check your result'}
  ]
})

Validation('explainConceptQuiz', {
  description: 'Explain a concept in your own words',
  params: [
    {id: 'prompt', as: 'text', mandatory: true, description: 'What to explain'},
    {id: 'scrambledKeyPoints', as: 'text', mandatory: true, description: 'Required concepts that must be mentioned'},
    {id: 'scrambledScoringCriteria', as: 'string', mandatory: true, description: 'use scrambleText with unscramble to check your result'}
  ]
})

Validation('buildQuiz', {
  description: 'Challenge to build complete solution from business requirements',
  params: [
    {id: 'requirements', as: 'text', mandatory: true, description: 'Business requirements to implement'},
    {id: 'context', as: 'text', description: 'Data structure, setup code, or environment context'},
    {id: 'scrambledSolution', as: 'string', mandatory: true, description: 'Complete working solution (scrambled)'},
    {id: 'scrambledHint', as: 'string', description: 'Optional hint about approach or key concepts (scrambled)'}
  ]
})

Booklet('booklet', {
  params: [
    {id: 'doclets', as: 'string', description: 'comma delimited names of doclets', mandatory: true},
    {id: 'whenToUse', as: 'text'}
  ]
})

function docletContent(docletId, ctx, tgpModel = jb) {
  const doclet = tgpModel.dsls['llm-guide'].doclet[docletId]
  if (!doclet) return null
  
  const docletCtx = ctx.setVars({doNotCalcExpression: true})
  return coreUtils.prettyPrintComp(doclet, {tgpModel})
    .replace(/<BOOKLET-EVALUATE>%\$([^%]+)%<\/BOOKLET-EVALUATE>/g, 
      (match, varName) => coreUtils.prettyPrint(docletCtx.vars[varName], {noMacros: true}) ?? match)
}

function bookletContent(bookletId, ctx, tgpModel = jb) {
  const booklet = tgpModel.dsls['llm-guide'].booklet[bookletId]
  if (!booklet) return null
  
  const doclets = booklet.$run().doclets.split(',')
    .map(id => id.trim()).filter(id => tgpModel.dsls['llm-guide'].doclet[id])
    .map(docletId => docletContent(docletId, ctx, tgpModel)).filter(Boolean).join('\n\n')
  
  return { bookletId, doclets }
}