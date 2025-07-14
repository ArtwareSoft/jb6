import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join, obj, splitByPivot, enrichGroupProps }, prop },
  'llm-guide': { Doclet, Spec,
    doclet: { exercise, principle },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax, proceduralSolution }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology, tradeoff, evidence, impact },
    problemStatement: { problem },
    step: { step },
    validation: { multipleChoiceQuiz, predictResultQuiz, explainConceptQuiz },
    'use-case': { useCase },
    actor: { endUser, admin },
    'actor-feature': { goal, motivation, backgroundKnowledge }
  } 
} = dsls

// Sample WhatsApp data
Const('whatsappMessages', [
  {timestamp: '2024-01-15 10:00:00', sender: 'Alice', message: 'Hey team, what do you think about using React for the new dashboard?'},
  {timestamp: '2024-01-15 10:01:00', sender: 'Bob', message: 'I prefer Vue, it\'s simpler'},
  {timestamp: '2024-01-15 10:01:30', sender: 'Charlie', message: 'React has better ecosystem'},
  {timestamp: '2024-01-15 10:02:00', sender: 'Alice', message: 'Good point about ecosystem'},
  {timestamp: '2024-01-15 10:05:00', sender: 'Dave', message: 'btw, anyone for lunch?'},
  {timestamp: '2024-01-15 10:05:30', sender: 'Eve', message: 'Sure, where?'},
  {timestamp: '2024-01-15 14:00:00', sender: 'Alice', message: 'Back to React vs Vue - performance matters too'},
  {timestamp: '2024-01-15 14:02:00', sender: 'Bob', message: 'Vue 3 is very performant'},
])


Doclet('whatsappToKnowledge', {
  impl: exercise(
    problem({
      statement: 'Transform WhatsApp chat exports into searchable knowledge base',
      intro: 'WhatsApp groups contain valuable discussions and decisions buried in chronological message streams. This use case demonstrates how to extract meaningful conversation threads, enrich them with context, and build a searchable knowledge base using LLM-ETL components.'
    }),
    proceduralSolution('WhatsApp Messages to Semantic Knowledge Base', {
      steps: [
        step('Parse and prepare WhatsApp export', 'Convert raw chat export into structured message objects', {
          details: 'Handle various WhatsApp export formats, extract metadata',
          points: [
            explanation('WhatsApp exports come in different formats - text, JSON, or zip'),
            syntax('timestamp parsing', 'normalize different date/time formats'),
            methodology('preserve all metadata - sender, timestamp, media references')
          ]
        }),
        step('Enrich messages from urls in messages'),
        step({
          action: 'Segment messages into conversation threads',
          purpose: 'Group related messages that form coherent discussions',
          details: 'Use temporal and semantic clustering to identify conversation boundaries',
          points: [
            explanation('Conversations have natural boundaries - time gaps, topic shifts'),
            methodology('Combine time-based and content-based segmentation'),
            performance('Process in batches to manage LLM costs')
          ]
        }),
        step({
          action: 'Enrich conversation groups with semantic properties',
          purpose: 'Add searchable metadata and summaries to each conversation',
          details: 'Extract topics, participants, decisions, action items',
          points: [
            explanation('Each conversation becomes a knowledge unit with rich metadata'),
            impact('Enables powerful search and knowledge retrieval')
          ]
        }),
        step('merge whatup groups'),
        step('Generate embeddings and build search index', 'Enable semantic search across all conversations', {
          details: 'Create vector embeddings for similarity search',
          points: [
            explanation('Embeddings capture semantic meaning for similarity search'),
            performance('Balance between embedding quality and storage costs')
          ]
        })
      ],
      summaryPoints: [
        explanation('This pipeline transforms unstructured chat into structured knowledge'),
        impact('Makes historical discussions searchable and actionable'),
        methodology('this process is per whatup group. if you have many groups, add a merge step'),
        evidence('Organizations report 70% reduction in repeated discussions')
      ]
    })
  )
})

Doclet('conversationSegmentation', {
  impl: exercise(
    problem({
      statement: 'Segment continuous message stream into meaningful conversation groups',
      intro: 'The first challenge is identifying where one discussion ends and another begins. This requires understanding both temporal patterns and semantic coherence.'
    }),
    solution({
      code: `// Time-based initial segmentation
llmSegment.temporal({
  messages: '%$whatsappMessages%',
  rules: {
    maxGapMinutes: 5,        // New thread if > 5 min gap
    maxDurationHours: 24,    // Split long conversations
    minMessages: 2,          // Ignore single messages
    businessHours: true      // Consider work hours
  }
})`,
      points: [
        explanation('Start with temporal segmentation as a baseline'),
        syntax('gap detection', 'identify natural conversation breaks'),
        syntax('duration limits', 'prevent overly long threads'),
        whenToUse('initial rough segmentation before semantic analysis'),
        performance('fast, deterministic, works without LLM calls')
      ]
    }),
    solution({
      code: `// Semantic conversation detection
pipeline(
  '%$whatsappMessages%',
  llmSegment.semantic({
    method: 'sliding-window',
    windowSize: 10,
    overlap: 3,
    detectUsing: {
      topicShift: true,      // New topic started
      greetings: true,       // "Hi", "Good morning"
      closings: true,        // "Thanks", "Bye"
      contextSwitch: true,   // Participant change
      timeReference: true    // "Yesterday we discussed"
    },
    llmPrompt: \`
      Analyze these messages and identify if they form:
      1. A single coherent conversation
      2. Multiple separate conversations
      3. Continuation of a previous topic
      
      Consider: topic coherence, participant engagement, 
      temporal flow, and conversational markers.
    \`
  }),
  llmValidate.conversations({
    ensureCompleteness: true,
    mergeFragments: true
  })
)`,
      points: [
        explanation('LLM analyzes semantic coherence and conversation flow'),
        syntax('sliding window', 'analyze overlapping message groups'),
        syntax('detection criteria', 'multiple signals for conversation boundaries'),
        methodology('Combine multiple indicators for robust segmentation'),
        whenToUse('when temporal segmentation alone is insufficient'),
        performance('more accurate but requires LLM calls for each window')
      ]
    }),
    solution({
      code: `// Hybrid approach - best of both
pipeline(
  '%$whatsappMessages%',
  // Step 1: Temporal pre-segmentation
  temporalSegment({
    gapThreshold: 5,
    output: 'candidates'
  }),
  // Step 2: LLM boundary refinement
  llmRefine.boundaries({
    lookAround: 5,  // Check 5 messages before/after
    criteria: [
      'topic continuity',
      'participant overlap',
      'reference to previous'
    ]
  }),
  // Step 3: Merge related segments
  llmMerge.related({
    maxDistance: 60,  // minutes
    similarity: 0.7,
    considerReferences: true  // "as discussed earlier"
  })
)`,
      points: [
        explanation('Hybrid approach balances accuracy and efficiency'),
        methodology('Use cheap temporal segmentation, then refine with LLM'),
        syntax('boundary refinement', 'LLM adjusts segment boundaries'),
        performance('reduces LLM calls by 70% compared to pure semantic'),
        impact('produces high-quality conversation threads')
      ]
    }),
    doNot(`llmSegment.semantic({
  messages: '%$allMessages%',  // Processing entire history at once
  method: 'global-analysis'
})`, { reason: 'processing entire chat history in one LLM call exceeds context limits and costs' }),
    bestPractice('fixed-size message chunks (e.g., every 20 messages)', {
      better: 'dynamic segmentation based on temporal and semantic boundaries',
      reason: 'conversations have natural, irregular boundaries that fixed chunks miss'
    })
  )
})

Doclet('conversationEnrichment', {
  impl: exercise(
    problem({
      statement: 'Enrich conversation groups with semantic properties for searchability',
      intro: 'Once conversations are segmented, we need to extract meaningful metadata that enables powerful search and knowledge retrieval.'
    }),
    solution({
      code: `// Comprehensive conversation enrichment
pipeline(
  '%$conversationGroups%',
  llmEnrich.conversation({
    extract: obj(
      // Basic metadata
      prop('title', 'string:concise-descriptive'),
      prop('summary', 'string:2-3-sentences'),
      prop('participants', 'array:active-participants'),
      prop('duration', 'computed:end-start'),
      
      // Semantic properties
      prop('topics', 'array:main-topics-discussed'),
      prop('category', 'enum:technical|business|social|planning'),
      prop('sentiment', 'enum:positive|neutral|negative|mixed'),
      
      // Actionable insights
      prop('decisions', 'array:decisions-made'),
      prop('actionItems', 'array:tasks-assigned'),
      prop('questions', 'array:unresolved-questions'),
      prop('keyInsights', 'array:important-points'),
      
      // Knowledge connections
      prop('references', 'array:mentioned-projects-or-docs'),
      prop('expertise', 'array:knowledge-demonstrated'),
      prop('learnings', 'array:new-information-shared')
    ),
    llmPrompt: \`
      Analyze this conversation and extract structured insights.
      Focus on actionable information and knowledge value.
      Be concise but comprehensive.
    \`
  }),
  // Add computed properties
  enrichGroupProps(
    group.prop('messageCount', count('%messages%')),
    group.prop('uniqueParticipants', unique('%messages/sender%')),
    group.prop('avgResponseTime', avgTimeBetween('%messages%')),
    group.prop('participationRate', participantEngagement('%messages%'))
  )
)`,
      points: [
        explanation('Extract multi-dimensional metadata from each conversation'),
        syntax('structured extraction', 'define schema for consistent output'),
        syntax('computed properties', 'combine LLM extraction with calculations'),
        whenToUse('preparing conversations for knowledge base storage'),
        impact('enables filtering, faceted search, and knowledge graphs'),
        performance('batch multiple conversations per LLM call when possible')
      ]
    }),
    solution({
      code: `// Smart tagging and categorization
llmEnrich.tags({
  conversation: '%%',
  tagSets: {
    technical: ['framework', 'architecture', 'bug', 'performance'],
    business: ['budget', 'timeline', 'client', 'requirements'],
    knowledge: ['howto', 'explanation', 'learning', 'best-practice'],
    urgency: ['urgent', 'asap', 'deadline', 'blocker']
  },
  autoSuggest: true,  // LLM suggests new tags
  confidence: 0.7,
  maxTags: 10
})`,
      points: [
        explanation('Multi-faceted tagging enables flexible search'),
        syntax('tag sets', 'organize tags into semantic groups'),
        syntax('auto-suggest', 'LLM identifies new tag candidates'),
        whenToUse('building browsable knowledge taxonomies'),
        methodology('balance between predefined and emergent tags')
      ]
    }),
    solution({
      code: `// Extract knowledge graph connections
llmEnrich.knowledgeGraph({
  conversation: '%%',
  extract: {
    entities: {
      people: 'participants and mentioned persons',
      projects: 'project names and initiatives',
      technologies: 'tools, frameworks, languages',
      concepts: 'ideas, patterns, methodologies'
    },
    relationships: {
      discusses: 'person discusses technology',
      workingOn: 'person working on project',
      uses: 'project uses technology',
      recommends: 'person recommends concept'
    }
  },
  linkToPrevious: true  // Connect to existing knowledge graph
})`,
      points: [
        explanation('Build knowledge graph from conversation entities'),
        syntax('entity extraction', 'identify key nouns and concepts'),
        syntax('relationship mapping', 'how entities relate to each other'),
        whenToUse('creating navigable knowledge networks'),
        impact('enables "who knows about X" queries')
      ]
    })
  )
})

Doclet('embeddingAndSearch', {
  impl: exercise(
    problem({
      statement: 'Generate embeddings and build semantic search capabilities',
      intro: 'The final step transforms enriched conversations into a searchable knowledge base using vector embeddings for semantic similarity.'
    }),
    solution({
      code: `// Generate multi-level embeddings
pipeline(
  '%$enrichedConversations%',
  llmEmbed.multiLevel({
    levels: {
      // Full conversation embedding
      conversation: {
        input: join(['%title%', '%summary%', '%keyInsights%'], ' '),
        model: 'text-embedding-ada-002',
        dimensions: 1536
      },
      // Individual message embeddings
      messages: {
        input: '%messages/message%',
        model: 'text-embedding-ada-002',
        batchSize: 100
      },
      // Concept embeddings for tags/topics
      concepts: {
        input: '%topics%',
        model: 'text-embedding-ada-002',
        cache: true  // Reuse embeddings for same concepts
      }
    }
  }),
  // Store in vector database
  vectorDB.upsert({
    index: 'whatsapp-knowledge',
    documents: '%%',
    idField: 'conversationId',
    vectorFields: ['embedding.conversation', 'embedding.messages'],
    metadataFields: ['title', 'participants', 'topics', 'timestamp']
  })
)`,
      points: [
        explanation('Multi-level embeddings enable different search granularities'),
        syntax('embedding levels', 'conversation, message, and concept level'),
        syntax('vector storage', 'prepare for similarity search'),
        whenToUse('building production-ready semantic search'),
        performance('cache common embeddings to reduce API costs'),
        tradeoff('storage space', 'search flexibility and accuracy')
      ]
    }),
    solution({
      code: `// Hybrid search implementation
llmSearch.hybrid({
  query: 'How did we decide on the authentication approach?',
  strategies: [
    // Semantic search on embeddings
    {
      type: 'vector',
      fields: ['embedding.conversation'],
      topK: 20,
      weight: 0.6
    },
    // Keyword search on metadata
    {
      type: 'keyword',
      fields: ['title', 'summary', 'topics'],
      boost: {
        'decisions': 2.0,
        'authentication': 1.5
      },
      weight: 0.3
    },
    // Entity-based search
    {
      type: 'graph',
      traverse: 'authentication->discussedBy->person',
      weight: 0.1
    }
  ],
  rerank: {
    model: 'cross-encoder',
    considerContext: true
  },
  explainRelevance: true
})`,
      points: [
        explanation('Combine multiple search strategies for best results'),
        syntax('hybrid search', 'vector + keyword + graph traversal'),
        syntax('reranking', 'use cross-encoder for final ranking'),
        whenToUse('production search systems needing high accuracy'),
        performance('initial retrieval is fast, reranking adds quality'),
        evidence('hybrid search improves relevance by 40% over pure vector search')
      ]
    }),
    solution({
      code: `// Natural language Q&A interface
llmQA.conversational({
  question: '%$userQuestion%',
  searchStrategy: llmSearch.hybrid(),
  context: {
    previousQuestions: '%$chatHistory%',
    userRole: '%$currentUser%',
    projectContext: '%$activeProject%'
  },
  generateAnswer: {
    style: 'concise-with-references',
    includeSources: true,
    suggestFollowUp: true
  },
  example: {
    Q: "What did Alice say about React performance?",
    A: "Alice mentioned that 'performance matters too' when comparing React vs Vue 
        (Jan 15, 14:00). She was responding to the earlier discussion about 
        framework choice for the dashboard project.
        
        📎 Source: Technical Discussion - Jan 15, 2024
        👥 Participants: Alice, Bob, Charlie
        
        Related questions:
        - What were the other React vs Vue arguments?
        - What framework did we ultimately choose?"
  }
})`,
      points: [
        explanation('Natural language interface to conversation knowledge'),
        syntax('contextual Q&A', 'considers user context and history'),
        syntax('source attribution', 'links answers to conversations'),
        whenToUse('building ChatGPT-like interface to team knowledge'),
        impact('makes tribal knowledge accessible to new team members'),
        methodology('always provide sources for trust and verification')
      ]
    })
  )
})

Doclet('implementationConsiderations', {
  impl: exercise(
    problem({
      statement: 'Key considerations for production WhatsApp knowledge systems',
      intro: 'Building a production-ready system requires addressing privacy, performance, and continuous learning challenges.'
    }),
    solution({
      code: `// Privacy and compliance
llmPipeline.withPrivacy({
  stages: {
    extraction: {
      redact: ['phone-numbers', 'emails', 'addresses'],
      anonymize: ['person-names'],
      exclude: ['personal-conversations', 'hr-discussions']
    },
    enrichment: {
      llmProvider: 'azure-openai',  // Enterprise agreement
      dataResidency: 'eu-west-1',
      noTraining: true
    },
    storage: {
      encryption: 'at-rest',
      accessControl: 'role-based',
      auditLog: true
    }
  }
})`,
      points: [
        explanation('Privacy is critical when processing chat data'),
        syntax('staged privacy controls', 'apply at each pipeline stage'),
        whenToUse('any production deployment with real user data'),
        impact('ensures GDPR compliance and user trust'),
        methodology('design privacy-first, not as afterthought')
      ]
    }),
    solution({
      code: `// Incremental processing and updates
llmIncremental.process({
  source: 'whatsapp-export',
  strategy: {
    newMessages: 'append-to-existing',
    modifiedConversations: 'reprocess-affected',
    deletedMessages: 'update-embeddings'
  },
  optimization: {
    batchSize: 100,
    reuseEmbeddings: true,
    incrementalIndex: true
  },
  monitoring: {
    trackCosts: true,
    qualityMetrics: ['relevance', 'completeness'],
    alertOnDrift: true
  }
})`,
      points: [
        explanation('Handle continuous updates efficiently'),
        syntax('incremental processing', 'only process what changed'),
        performance('reduces costs by 90% vs full reprocessing'),
        whenToUse('production systems with regular updates'),
        methodology('design for continuous operation from the start')
      ]
    }),
    bestPractice({
      suboptimalCode: 'processing all messages with the same LLM prompt',
      better: 'use message type detection and specialized prompts',
      reason: 'different message types (technical, social, decision) benefit from tailored analysis'
    }),
    mechanismUnderTheHood({
      snippet: `// Conversation quality scoring
function scoreConversationQuality(enrichedConvo) {
  return {
    knowledgeValue: 
      enrichedConvo.decisions.length * 3 +
      enrichedConvo.keyInsights.length * 2 +
      enrichedConvo.actionItems.length * 1,
    
    searchability:
      enrichedConvo.title.quality * 0.3 +
      enrichedConvo.topics.length * 0.2 +
      enrichedConvo.summary.quality * 0.5,
      
    completeness:
      hasAllParticipants(enrichedConvo) &&
      hasTimerange(enrichedConvo) &&
      hasConclusion(enrichedConvo)
  }
}`,
      explain: 'Quality scoring helps prioritize which conversations to surface in search results'
    })
  )
})


Spec('whatsappSemanticSearch', {
  impl: specification({
    introduction: 'Enable semantic search over WhatsApp conversation groups to quickly find relevant messages and discussions. Focus on small conversation clusters (3-5 messages, up to 30 messages) where related topics are discussed.',
    
    useCases: [
      useCase({
        goal: 'Provide intelligent search and retrieval over conversation groups',
        importance: 'critical',
        relevantActors: [
          endUser({
            description: 'WhatsApp group members who need to find previous conversations',
            features: [
              motivation('Want to quickly find relevant past discussions without scrolling through chat history'),
              goal('Search using natural language to find conversation threads about specific topics'),
              backgroundKnowledge('Knows roughly what was discussed but not exact words or timing')
            ]
          }),
          admin({
            description: 'Group administrators managing searchable conversation data',
            adminFlow: 'Configure search parameters, manage conversation grouping, monitor search quality',
            features: [
              motivation('Ensure group conversations remain findable and useful over time'),
              goal('Maintain effective semantic search over group discussions'),
              backgroundKnowledge('Understanding of conversation patterns and group dynamics')
            ]
          })
        ],
        flow: 'User submits natural language search query, system searches conversation groups using semantic similarity, returns ranked conversation threads with context, shows original message sequence',
        exampleScenarios: [
          realClientStory({
          context: 'Israeli indie hackers WhatsApp group with entrepreneurs, developers, and business people sharing insights, tools, and experiences',
          actors: 'Idan (Group Admin), אודי TR (Business Strategist), גיא סימון OW (Product Builder), ליאור רביבו OW (Content Creator), אור זילברמן (Inventor)',
          motivation: 'Active community sharing business insights, product recommendations, marketing strategies, and technical tools - but valuable discussions get buried in chat history',
          interactionDescription: 'Real conversations cover diverse topics: Hormozi marketing strategies, creativity frameworks, validation techniques, Chrome extension development, semantic search applications. Members need to find specific discussions about topics like validation methods or Chrome extension frameworks from past conversations.',
          webSiteUrl: 'https://www.linkedin.com/in/idan-benaun-824a0759',
          crmId: 'BSG-2024-001',
          dataSamples: {
            searchScenarios: [
              {
                query: 'validation techniques for new products',
                relevantConversation: [
                  {
                    timestamp: '16/09/2024, 15:14:42',
                    sender: 'ליאור רביבו OW', 
                    message: 'בוא נשים שניה בצד את הרעיונות, כאלה יש בשפע, בוא נדבר על ולידציה - איך יודעים שזה רעיון ששווה להשקיע בו? איך יודעים שיש פה הזדמנות?'
                  },
                  {
                    timestamp: '16/09/2024, 15:15:48',
                    sender: 'אודי TR',
                    message: 'וגם מה בכלל ולידציה שנותנת סיגנל ששווה להשקיע בזה זאת גם שאלה קריטית'
                  },
                  {
                    timestamp: '16/09/2024, 15:15:49', 
                    sender: '~ uziel guy',
                    message: 'לדבר עם 50 לקוחות פוטנציאליים'
                  },
                  {
                    timestamp: '16/09/2024, 16:07:10',
                    sender: 'אודי TR',
                    message: 'הולידציה הכי חזקה זה לשים paywall ולראות שאשכרה מישהו מוכן לשים כרטיס אשראי גם אם אין מוצר עדיין. שלב לפני זה אימייל ברמת עניין.'
                  }
                ],
                searchResult: {
                  relevanceScore: 0.95,
                  conversationSummary: 'Discussion on product validation techniques: talk to 50 potential customers, use paywall testing, email interest validation',
                  messageCount: 4,
                  participants: ['ליאור רביבו OW', 'אודי TR', '~ uziel guy'],
                  timespan: '52 minutes'
                }
              },
              {
                query: 'Chrome extension development framework',
                relevantConversation: [
                  {
                    timestamp: '15/09/2024, 20:37:16',
                    sender: 'Idan',
                    message: 'אגב מחר אני משחרר איזה תוסף קטן לכרום גם לשימוש וגם באופן סורס, אשלח גם כאן בבוקר'
                  },
                  {
                    timestamp: '15/09/2024, 20:38:47',
                    sender: 'Idan', 
                    message: 'זה הפריימוורק שהשתמשתי בו עם typescript מאוד נוח https://github.com/PlasmoHQ/plasmo'
                  },
                  {
                    timestamp: '15/09/2024, 20:59:30',
                    sender: '~ Ziv',
                    message: 'וואי איך באת לי בול! בדיוק חיפשתי פריימוורק טוב לבניית תוסף לכרום'
                  }
                ],
                searchResult: {
                  relevanceScore: 0.92,
                  conversationSummary: 'Chrome extension development using Plasmo framework with TypeScript - recommendation and positive feedback',
                  messageCount: 3,
                  participants: ['Idan', '~ Ziv'],
                  timespan: '22 minutes'
                }
              },
              {
                query: 'creativity and idea generation techniques',
                relevantConversation: [
                  {
                    timestamp: '16/09/2024, 14:54:14',
                    sender: '~ Ben',
                    message: 'האם לדעתכם יצירתיות ומציאת רעיונות זה כמו שריר? ככל שתתרגל אותו יותר ככה זה יבוא יותר?'
                  },
                  {
                    timestamp: '16/09/2024, 14:56:57',
                    sender: 'Idan',
                    message: 'קרוב אבל לא בדיוק לדעתי, יצירתיות מגיעה מהמילה יצירה, ככול שאתה יוצר יותר ככה לדעתי היצירתיות תגדל'
                  },
                  {
                    timestamp: '16/09/2024, 15:02:48',
                    sender: 'אודי TR',
                    message: 'לדעתי גם כתיבה זה חלק גדול מזה. אם תתחיל לכתוב על נושאים רלוונטיים אלייך אתה תראה איך השריר הזה משתפר'
                  }
                ],
                searchResult: {
                  relevanceScore: 0.88,
                  conversationSummary: 'Discussion on developing creativity: practice creation, writing helps improve creative thinking, creativity grows through action',
                  messageCount: 8,
                  participants: ['~ Ben', 'Idan', 'אודי TR', 'שקד חג׳ג', 'תומר יצחקוב'],
                  timespan: '3 hours'
                }
              }
            ]
          }
        })
      ]
    })
  ]
  })
})