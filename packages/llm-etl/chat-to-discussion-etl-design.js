import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'
import '@jb6/llm-guide/software-spec-dsl.js'
import './chat-to-discussion-etl-requirements.js'

const { 
  'llm-guide': { Doclet,
    doclet: { TopLevelDesign },
    diagram: { dataFlowDiagrams, mirableDiagrams }
  } 
} = dsls

// =============================================================================
// CHAT TO DISCUSSION ETL - BATCH PROCESSING DESIGN
// =============================================================================

Doclet('chatToDiscussionETLDesign', {
  impl: TopLevelDesign({
    forSpec: 'chatToDiscussionETL',
    scenario: 'Process WhatsApp message streams in 50-message batches using LLM batch classification for discussion boundary detection',
    diagrams: [
      dataFlowDiagrams({
        explain: 'Batch-oriented pipeline: collect messages in 50-message windows and process with LLM',
        diagram: `
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Message Streams │ →  │  50-Message     │ →  │  Batch LLM      │ →  │  Database       │
│  (WhatsApp, etc) │    │  Windows        │    │  Classification │    │  Insert with    │
│                 │    │  (per chat)     │    │                 │    │  Discussion IDs │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │                        │
                                ↓                        ↓                        ↓
                        ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
                        │  Batch Buffer   │    │  Context        │    │  Messages       │
                        │  Management     │    │  Assembly       │    │  Available      │
                        │  (per chat)     │    │  (chat history) │    │  for Search     │
                        └─────────────────┘    └─────────────────┘    └─────────────────┘

Note: Messages are also saved as they arrive without classifaction`
      }),
      dataFlowDiagrams({
        explain: 'Single-track batch processing: collect 50 messages, process with LLM, store results',
        diagram: `
Incoming Message Stream (per chat):
┌─────────────────────────────────────────────────────────────────────────────────┐
│ m1→m2→m3→...→m48→m49→m50 | m51→m52→...→m98→m99→m100 | m101→...                 │
└─────────────────────────────────────────────────────────────────────────────────┘
`
      }),
      dataFlowDiagrams({
        explain: 'Smart windowing with overlap and context for accurate boundary detection',
        diagram: `
Smart Batch Windowing (per chat):

Timeline: ←────────────────────────────────────────────────────────→

Messages: m1─m2─m3...─m45─m46─m47─m48─m49─m50─m51─m52─m53...─m95─m96─m97─m98─m99─m100

Batch 1:  [──────────────── 50 messages ────────────────]
          m1                                        m50

Batch 2:               [──────────────── 50 messages ────────────────]
                       m40                                        m89
                       └─ 10 msg overlap with Batch 1

Batch 3:                          [──────────────── 50 messages ────────────────]
                                  m80                                        m129
                                  └─ 10 msg overlap with Batch 2

Context Strategy:
├─ Include last 10 messages from previous batch
├─ Include chat metadata (participants, time gaps)
├─ Include discussion summaries from completed batches
└─ Provide boundary hints from overlapping region

Overlap Handling:
├─ Messages m40-m50 appear in both Batch 1 and Batch 2
├─ Use first classification (Batch 1) as authoritative
├─ Second classification (Batch 2) used for validation
└─ Conflicts flagged for manual review (rare <1%)`
      }),
      dataFlowDiagrams('Single LLM call processes 50 messages and returns discussion boundaries', '')
    ]
  })
})
