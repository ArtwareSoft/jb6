import { dsls } from '@jb6/core'
import '@jb6/common'

const { 
  tgp: { TgpType, DefComponents },
  common: { Data, Action, Boolean }
} = dsls

// =============================================================================
// LLM-TEACHER DATABASE DSL - Mixin and Prompt Prefix Management
// =============================================================================

// Core TGP Types for LLM-Teacher database system
const Mixin = TgpType('mixin', 'llm-teacher')
const PromptPrefix = TgpType('promptPrefix', 'llm-teacher') 
const KnowledgeCategory = TgpType('knowledgeCategory', 'llm-teacher')
const SummaryLevel = TgpType('summaryLevel', 'llm-teacher')
const ValidationResult = TgpType('validationResult', 'llm-teacher')
const Context = TgpType('context', 'llm-teacher')
const Quiz = TgpType('quiz', 'llm-teacher')

// =============================================================================
// MIXIN COMPONENTS - Content mixins for orthogonal composition
// =============================================================================

Mixin('fundamentalsMixin', {
  description: 'Basic concepts that must be understood first',
  params: [
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'includeSource', as: 'boolean', defaultValue: false},
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'emphasizeTerminology', as: 'boolean', defaultValue: true}
  ]
})

Mixin('executionModelMixin', {
  description: 'How systems actually run and execute',
  params: [
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'emphasizeCtx', as: 'boolean', defaultValue: true},
    {id: 'includeTimeline', as: 'boolean', defaultValue: false},
    {id: 'domain', as: 'string', mandatory: true}
  ]
})

Mixin('antiPatternsMixin', {
  description: 'What NOT to do and why - contamination prevention',
  params: [
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'contaminationTypes', as: 'array', defaultValue: ['oop', 'functional', 'framework']},
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'intensity', as: 'string', options: 'light,medium,heavy', defaultValue: 'medium'}
  ]
})

Mixin('compositionPatternsMixin', {
  description: 'How to build complex things from simple parts',
  params: [
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'includeCrossDsl', as: 'boolean', defaultValue: true},
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'complexityLevel', as: 'string', options: 'basic,intermediate,advanced', defaultValue: 'intermediate'}
  ]
})

Mixin('practicalUsageMixin', {
  description: 'Real-world examples and patterns',
  params: [
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'domains', as: 'array', defaultValue: ['common-dsl', 'ui-dsl']},
    {id: 'includeTests', as: 'boolean', defaultValue: true},
    {id: 'exampleComplexity', as: 'string', options: 'simple,realistic,complex', defaultValue: 'realistic'}
  ]
})

// =============================================================================
// SUMMARY LEVEL COMPONENTS - Different depths of explanation
// =============================================================================

SummaryLevel('reference', {
  description: 'Quick syntax reference, minimal explanation',
  params: [
    {id: 'includeExamples', as: 'boolean', defaultValue: true},
    {id: 'maxTokens', as: 'number', defaultValue: 20000}
  ]
})

SummaryLevel('tutorial', {
  description: 'Step-by-step learning progression',
  params: [
    {id: 'includeProgressiveComplexity', as: 'boolean', defaultValue: true},
    {id: 'maxTokens', as: 'number', defaultValue: 80000}
  ]
})

SummaryLevel('comprehensive', {
  description: 'Deep understanding with full context',
  params: [
    {id: 'includeSourceCode', as: 'boolean', defaultValue: true},
    {id: 'includeVerification', as: 'boolean', defaultValue: true},
    {id: 'maxTokens', as: 'number', defaultValue: 180000}
  ]
})

SummaryLevel('troubleshooting', {
  description: 'Focus on common problems and solutions',
  params: [
    {id: 'includeAntiPatterns', as: 'boolean', defaultValue: true},
    {id: 'maxTokens', as: 'number', defaultValue: 60000}
  ]
})

// =============================================================================
// PROMPT PREFIX COMPONENTS - Context-setting and contamination prevention
// =============================================================================

PromptPrefix('antiContaminationPrefix', {
  description: 'Prevent external knowledge interference',
  params: [
    {id: 'contaminationType', as: 'string', options: 'oop,functional,framework,compile-time', mandatory: true},
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'intensity', as: 'string', options: 'light,medium,heavy', defaultValue: 'medium'}
  ]
})

PromptPrefix('contextSettingPrefix', {
  description: 'Establish learning context and goals',
  params: [
    {id: 'goal', as: 'string', mandatory: true},
    {id: 'scope', as: 'string'},
    {id: 'expectations', as: 'string'}
  ]
})

PromptPrefix('verificationPrompt', {
  description: 'Self-check instructions',
  params: [
    {id: 'concepts', as: 'array', mandatory: true},
    {id: 'checkType', as: 'string', options: 'concept-check,application-test,understanding-verification', defaultValue: 'concept-check'}
  ]
})

PromptPrefix('attentionDirectionPrefix', {
  description: 'Focus on specific aspects',
  params: [
    {id: 'focus', as: 'string', options: 'timing,relationships,mechanisms,terminology', mandatory: true},
    {id: 'domain', as: 'string', mandatory: true}
  ]
})

// =============================================================================
// KNOWLEDGE CATEGORY COMPONENTS - Domain organization
// =============================================================================

KnowledgeCategory('fundamentals', {
  params: [
    {id: 'domain', as: 'string', mandatory: true}
  ]
})

KnowledgeCategory('executionModel', {
  params: [
    {id: 'domain', as: 'string', mandatory: true}
  ]
})

KnowledgeCategory('antiPatterns', {
  params: [
    {id: 'domain', as: 'string', mandatory: true}
  ]
})

// =============================================================================
// CONTEXT GENERATION COMPONENTS - Orchestration
// =============================================================================

Context('mixinComposition', {
  description: 'Compose multiple mixins into unified teaching context',
  params: [
    {id: 'mixins', type: 'mixin[]', mandatory: true},
    {id: 'compositionStrategy', as: 'string', options: 'sequential,interleaved,hierarchical', defaultValue: 'hierarchical'},
    {id: 'maxTokens', as: 'number', defaultValue: 200000},
    {id: 'prefixes', type: 'promptPrefix[]', defaultValue: []}
  ]
})

Context('generateFromSources', {
  description: 'Generate teaching context from source code and existing docs',
  params: [
    {id: 'sourceFiles', as: 'array', mandatory: true},
    {id: 'concepts', as: 'array', mandatory: true},
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'includeAntiContamination', as: 'boolean', defaultValue: true}
  ]
})

// =============================================================================
// VALIDATION AND TESTING COMPONENTS
// =============================================================================

ValidationResult('comprehensionScore', {
  params: [
    {id: 'score', as: 'number', mandatory: true},
    {id: 'maxScore', as: 'number', defaultValue: 100},
    {id: 'passThreshold', as: 'number', defaultValue: 80},
    {id: 'failedConcepts', as: 'array', defaultValue: []},
    {id: 'testSession', as: 'string'}
  ]
})

Quiz('conceptComprehensionQuiz', {
  description: 'Test understanding of specific concepts',
  params: [
    {id: 'concepts', as: 'array', mandatory: true},
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'questionTypes', as: 'array', defaultValue: ['multiple-choice', 'explanation', 'prediction']},
    {id: 'difficulty', as: 'string', options: 'basic,intermediate,advanced', defaultValue: 'intermediate'}
  ]
})

// =============================================================================
// DATABASE OPERATIONS - CRUD and queries
// =============================================================================

Data('findCompatibleMixins', {
  description: 'Find mixins compatible with given requirements',
  params: [
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'categories', as: 'array', mandatory: true},
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'minScore', as: 'number', defaultValue: 80},
    {id: 'excludeConflicts', as: 'array', defaultValue: []}
  ]
})

Data('selectPromptPrefixes', {
  description: 'Select appropriate prompt prefixes for context',
  params: [
    {id: 'domain', as: 'string', mandatory: true},
    {id: 'categories', as: 'array', mandatory: true},
    {id: 'summaryLevel', type: 'summaryLevel', mandatory: true},
    {id: 'includeRequired', as: 'boolean', defaultValue: true}
  ]
})

Action('saveMixinVersion', {
  description: 'Save new version of mixin with metadata',
  params: [
    {id: 'mixinId', as: 'string', mandatory: true},
    {id: 'version', as: 'string', mandatory: true},
    {id: 'content', as: 'string', mandatory: true},
    {id: 'metadata', as: 'object', mandatory: true},
    {id: 'testResults', type: 'validationResult[]', defaultValue: []}
  ]
})

Action('updateComprehensionScore', {
  description: 'Update mixin effectiveness based on test results',
  params: [
    {id: 'mixinId', as: 'string', mandatory: true},
    {id: 'testResult', type: 'validationResult', mandatory: true}
  ]
})
