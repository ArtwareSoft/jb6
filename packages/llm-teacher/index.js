import './llm-teacher-dsl.js'
import './what-is-llm-pedagogy.js'

export { dsls } from '@jb6/core'

// Main TGP types available for import
export const {
  'llm-teacher': {
    // Mixin types
    Mixin,
    mixin: {
      fundamentalsMixin,
      executionModelMixin, 
      antiPatternsMixin,
      compositionPatternsMixin,
      practicalUsageMixin
    },
    
    // Summary level types
    SummaryLevel,
    summaryLevel: {
      reference,
      tutorial,
      comprehensive, 
      troubleshooting
    },
    
    // Prompt prefix types
    PromptPrefix,
    promptPrefix: {
      antiContaminationPrefix,
      contextSettingPrefix,
      verificationPrompt,
      attentionDirectionPrefix
    },
    
    // Context generation
    Context,
    context: {
      mixinComposition,
      generateFromSources
    },
    
    // Validation and testing
    ValidationResult,
    validationResult: {
      comprehensionScore
    },
    
    Quiz,
    quiz: {
      conceptComprehensionQuiz
    },
    
    // Knowledge organization
    KnowledgeCategory,
    knowledgeCategory: {
      fundamentals,
      executionModel,
      antiPatterns
    },
    
    // Database operations
    data: {
      findCompatibleMixins,
      selectPromptPrefixes
    },
    
    action: {
      saveMixinVersion,
      updateComprehensionScore
    }
  }
} = dsls
