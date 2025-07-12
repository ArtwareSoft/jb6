// === COMPLETE DOCLET DSL DEFINITION ===

import { dsls } from '@jb6/core'
import '@jb6/mcp'

const { 
  common: { Data },
  tgp: { TgpType },
  mcp: { 
    Tool,
    tool: { tgpModel, runSnippet, runSnippets, getFilesContent, replaceComponent, appendToFile, overrideFileContent, dslDocs, scrambleText }
  }
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
const Validation = TgpType('validation', 'doclet')
const Spec = TgpType('spec', 'doclet')
const UseCase = TgpType('use-case', 'doclet')
const Actor = TgpType('actor', 'doclet')
const ActorFeature = TgpType('actor-feature', 'doclet')
const Scenario = TgpType('scenario', 'doclet')
const namingSystem = TgpType('naming-system', 'doclet')        // Naming convention systems
const namingCategory = TgpType('naming-category', 'doclet')     // Individual naming categories  
const namingCollision = TgpType('naming-collision', 'doclet')   // Collision examples with evidence


const McpTool = TgpType('tool', 'mcp')               // MCP tool components

// =============================================================================
// TYPE: doclet - Main documentation container
// =============================================================================

Doclet('exercise', {
  params: [
    {id: 'problem', type: 'problemStatement', mandatory: true},
    {id: 'guidance', type: 'guidance[]', secondParamAsArray: true},
    {id: 'validation', type: 'validation[]', description: 'verify exercise knowledge achieved'},
    {id: 'outro', as: 'text', description: 'Concluding explanation'}
  ]
})

Spec('specification', {
  params: [
    {id: 'introduction', as: 'text' },    
    {id: 'useCases', type: 'use-case[]', mandatory: true},
    {id: 'dataSamples', type: 'dataSample[]' },
    {id: 'expectedOutputs', type: 'dataSample[]' },
  ]
})

Actor('endUser', {
  params: [
    {id: 'description', as: 'text' },
    {id: 'features', type: 'actor-feature' },
  ]
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
    { id: 'guidance', type: 'guidance[]' },
    { id: 'validation', type: 'validation[]', description: 'verify principle is understood'},
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

Guidance('proceduralSolution', {
  description: 'Solution using step-by-step procedures and workflows',
  params: [
    {id: 'procedure', as: 'text', description: 'Name/description of the procedure'},
    {id: 'usefulPoints', type: 'explanationPoint[]', byName: true},
    {id: 'steps', type: 'step[]', mandatory: true, description: 'Ordered sequence of steps'},
    {id: 'summaryPoints', type: 'explanationPoint[]'}
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
    {id: 'methodology', as: 'text', mandatory: true},
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

// New step type for procedural solutions
const Step = TgpType('step', 'doclet')

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


// =============================================================================
// TYPE: naming-system - Structured naming convention documentation
// =============================================================================

namingSystem('namingSystem', {
  description: 'Comprehensive naming convention system with progressive categories and collision analysis',
  params: [
    {id: 'problem', as: 'text', mandatory: true, description: 'The core naming problem being solved'},
    {id: 'categories', type: 'naming-category[]', mandatory: true, description: 'Naming categories in dependency order'},
    {id: 'collision', type: 'naming-collision', description: 'Concrete collision example with evidence'},
    {id: 'solution', as: 'text', description: 'Overall solution approach'}
  ]
})

namingCategory('namingCategory', {
  description: 'Individual naming category with examples and reasoning',
  params: [
    {id: 'name', as: 'string', mandatory: true, description: 'Category name (e.g., "DSL Names")'},
    {id: 'pattern', as: 'string', mandatory: true, description: 'Naming pattern to follow'},
    {id: 'examples', as: 'text', mandatory: true, description: 'Real syntax examples with good/bad comparisons'},
    {id: 'reasoning', as: 'text', mandatory: true, description: 'Why this pattern matters'},
    {id: 'buildsToward', as: 'text', description: 'How this category connects to the next in the progression'}
  ]
})

namingCollision('namingCollision', {
  description: 'Concrete collision scenario with evidence and solution',
  params: [
    {id: 'scenario', as: 'text', mandatory: true, description: 'Concrete code showing the collision happening'},
    {id: 'explanation', as: 'text', mandatory: true, description: 'Technical explanation of why the collision occurs'},
    {id: 'fix', as: 'text', mandatory: true, description: 'How the naming rules prevent this collision'},
    {id: 'evidence', as: 'text', description: 'Real-world evidence this collision occurred'}
  ]
})