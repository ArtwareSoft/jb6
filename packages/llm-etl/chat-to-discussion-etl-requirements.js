import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'
import '@jb6/llm-guide/software-spec-dsl.js'

const { 
  'llm-guide': { Spec,
    'use-case': { useCase },
    actor: { endUser },
    'actor-feature': { goal, motivation },
    requirement: { functional, nonFunctional, systemConstraint, qualityAttribute },
    spec: { specification }
  } 
} = dsls

Doclet('chatToDiscussionETL', {
  impl: specification({
    introduction: 'Extract discussion boundaries from chat message streams for downstream knowledge systems.',
    
    useCases: [
      useCase({
        goal: 'Transform individual chat messages into coherent discussion groups',
        importance: 'critical',
        relevantActors: [
          endUser({
            description: 'Knowledge extraction system',
            features: [
              motivation('Needs semantically coherent message groups for search'),
              goal('Consume messages tagged with discussionId')
            ]
          })
        ],
        flow: 'Input message stream → Discussion boundary detection → Output tagged messages'
      })
    ],
    
    requirements: [
      // Functional Requirements
      functional('Group related messages into discussion units with discussionId'),
      functional('LLM semantic analysis for all discussion boundary decisions'),
      functional('Maintain context window for LLM: recent discussion summaries + message history'),
      functional('Handle out-of-order and duplicate messages'),
      functional('Process multiple independent chat streams'),
      
      // Scale Requirements  
      nonFunctional('Support 10-50 concurrent chats, 100-1000 messages/day total'),
      nonFunctional('Message processing: 1-10 typical, 100 peak messages/second'),
      nonFunctional('Data retention: 1-2 years for search, archive older'),
      nonFunctional('Target 90% meaningful discussion boundaries (good enough)'),
      
      // LLM Performance Requirements
      nonFunctional('LLM context strategy: 4K token models for speed/cost vs 200K models for accuracy'),
      nonFunctional('4K models: ~100ms latency, ~$0.001 per call - preferred for high volume'),
      nonFunctional('200K models: ~2000ms latency, ~$0.02 per call - use selectively for complex cases'),
      nonFunctional('LLM cost budget: target <$0.01 per 100 messages processed'),
      nonFunctional('Processing delay acceptable: batch/windowed not real-time'),
      
      // Discussion Structure Constraints
      systemConstraint('Discussion size: 3-30 messages, maximum 4 hours duration'),
      systemConstraint('One message belongs to exactly one discussion (no overlap)'),
      systemConstraint('No discussion merging or splitting after creation'),
      systemConstraint('Discussion lifecycle: active for 4 hours maximum then auto-close'),
      
      // LLM System Constraints
      systemConstraint('Time gaps provide context hints to LLM, not primary classification'),
      systemConstraint('LLM failure handling: fallback to time-based classification when LLM unavailable'),
      systemConstraint('LLM provider: must support batch processing for cost efficiency'),
      
      // Context and Processing Constraints
      systemConstraint('Context window: last 5-10 messages per discussion for analysis'),
      systemConstraint('Recent timeframe: last 24 hours for semantic analysis'),
      systemConstraint('Minimal context to maintain processing speed'),
      
      // Error Handling Constraints
      systemConstraint('No retroactive fixes - immutable assignment once made'),
      systemConstraint('Prefer splitting discussions over merging (easier to combine later)'),
      systemConstraint('Graceful degradation: assign to fallback discussion vs dropping messages'),
      
      // Quality Attributes
      qualityAttribute('Optimize for common cases, handle edge cases separately'),
      qualityAttribute('Chat-based partitioning for horizontal scaling')
    ]
  })
})
