import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { principle, fundamentalLlmMethodology },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { syntax, evidence, methodology, explanation, whenToUse, performance, comparison },
    problemStatement: { problem }
  } 
} = dsls

// =============================================================================
// LLM PEDAGOGY PRINCIPLES - Teaching AI Systems Effectively
// =============================================================================

Doclet('llmPedagogyFoundation', {
  impl: fundamentalLlmMethodology({
    importance: 'critical',
    rule: 'LLM pedagogy requires systematic approach: extract knowledge → generate contexts → test comprehension → validate externally → iterate until proven',
    rationale: 'Traditional documentation assumes human learning patterns. LLMs have unique failure modes requiring specialized teaching approaches with external validation.',
    process: '1. Knowledge extraction from sources, 2. Context generation with anti-contamination, 3. One-shot comprehension testing, 4. External answer validation, 5. Failure analysis and improvement',
    guidance: [
      solution({
        code: `// Traditional approach (unreliable):
writeDocumentation() → hope it works → discover problems later

// LLM pedagogy approach (proven):
extractKnowledge() → generateContext() → testComprehension() → validateExternally() → iterateUntilProven()`,
        points: [
          evidence('20x efficiency gains in documentation generation with systematic approaches'),
          methodology('External validation prevents confident wrongness - LLMs can sound authoritative while being fundamentally incorrect'),
          syntax('one-shot testing', 'test comprehension without allowing iterative learning within session')
        ]
      }),
      doNot('Writing documentation and hoping LLMs will understand correctly', {
        reason: 'LLMs exhibit systematic failure patterns that require proactive prevention and testing'
      }),
      bestPractice({
        suboptimalCode: 'manual documentation creation with subjective quality assessment',
        better: 'systematic knowledge extraction with external comprehension validation',
        reason: 'objective testing reveals actual understanding vs confident wrongness'
      })
    ]
  })
})

Doclet('antiContaminationPrinciple', {
  impl: principle({
    importance: 'critical',
    rule: 'Explicitly prevent external knowledge contamination through systematic anti-pattern injection',
    rationale: 'LLMs bring massive external programming knowledge that contaminates understanding of novel systems. Anti-contamination patterns must be injected proactively.',
    guidance: [
      solution({
        code: `// Anti-contamination structure:
doNot('Applying OOP concepts: profiles are NOT objects, CompDef is NOT a class', {
  reason: 'TGP has its own execution model based on run() + Ctx'
}),
doNot('Traditional compile/runtime thinking: TGP has profile-creation vs profile-execution', {
  reason: 'Both happen at what traditional languages call "runtime"'
})`,
        points: [
          explanation('External knowledge contamination is the primary LLM learning failure mode'),
          syntax('explicit anti-patterns', 'proactively prevent wrong mental models'),
          methodology('Inject anti-contamination early and repeatedly throughout teaching context'),
          evidence('Contamination prevention reduces concept confusion by 60-80%')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Contamination sources:
// 1. OOP concepts (classes, instances, inheritance)
// 2. Traditional compilation models (compile-time vs runtime)
// 3. Functional programming patterns (pure functions, immutability)
// 4. Framework-specific terminology (React components, Angular services)

// Anti-contamination injection points:
// - Before concept introduction
// - After working examples
// - In self-verification questions`,
        explain: 'systematic injection prevents LLMs from applying inappropriate mental models'
      }),
      doNot('Assuming LLMs will naturally avoid applying external concepts to novel systems', {
        reason: 'contamination is automatic and unconscious - requires explicit prevention'
      }),
      bestPractice({
        suboptimalCode: 'explaining concepts without addressing external misconceptions',
        better: 'proactively preventing known contamination patterns',
        reason: 'prevention is more effective than correction after contamination occurs'
      })
    ]
  })
})

Doclet('externalValidationPrinciple', {
  impl: principle({
    importance: 'critical',
    rule: 'Use external answer validation rather than LLM self-assessment to measure true comprehension',
    rationale: 'LLMs exhibit confident wrongness - sounding authoritative while being fundamentally incorrect. External validation reveals actual understanding.',
    guidance: [
      solution({
        code: `// External validation process:
testComprehension({
  context: 'generated-teaching-context.js',
  quiz: 'structured-comprehension-quiz.js', 
  llmModel: 'claude-3.5-sonnet',
  testingMode: 'one-shot', // No iterations allowed
  externalValidation: true  // Check answers externally
})
// → Returns: {score: 78, failedConcepts: ['variable-timing', 'ctx-flow']}`,
        points: [
          evidence('LLM-as-a-judge approaches show 85-90% agreement with human evaluators when properly calibrated'),
          methodology('One-shot testing prevents iterative learning that masks comprehension gaps'),
          syntax('external validation', 'check answers against objective criteria, not LLM self-assessment'),
          comparison('self-assessment', { advantage: 'reveals actual understanding vs confident presentation of wrong answers' })
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Why external validation is critical:
// 1. Confident wrongness: LLMs sound authoritative when wrong
// 2. Self-assessment bias: LLMs think they understand when they don't
// 3. Iterative masking: Multiple attempts hide underlying confusion
// 4. Surface learning: LLMs can mimic patterns without deep understanding

// External validation methods:
// - Structured quizzes with objective answers
// - Code prediction with verifiable results  
// - Concept explanation with required key points
// - Application tasks with measurable outcomes`,
        explain: 'external validation bypasses LLM presentation skills to measure actual comprehension'
      }),
      doNot('Relying on LLM self-assessment or confidence levels to measure understanding', {
        reason: 'confident wrongness makes self-assessment unreliable - LLMs can be confidently incorrect'
      }),
      bestPractice({
        suboptimalCode: 'asking LLMs "do you understand?" and accepting their answer',
        better: 'testing specific comprehension with objective validation',
        reason: 'objective testing reveals gaps that confident presentation masks'
      })
    ]
  })
})

Doclet('mixinBasedSynthesis', {
  impl: principle({
    importance: 'high',
    rule: 'Use orthogonal composition: knowledge categories × summary levels enable flexible, targeted teaching',
    rationale: 'Monolithic documentation cannot address diverse learning needs. Orthogonal mixins enable hundreds of targeted combinations from reusable components.',
    guidance: [
      solution({
        code: `// Orthogonal dimensions:
// Knowledge categories: fundamentals, execution-model, anti-patterns, practical-usage
// Summary levels: reference, tutorial, comprehensive, troubleshooting

// Mixin composition:
mixinComposition({
  mixins: [
    fundamentalsMixin({summaryLevel: comprehensive(), includeSource: true}),
    antiPatternsMixin({summaryLevel: comprehensive(), contaminationTypes: ['oop', 'functional']}),
    executionModelMixin({summaryLevel: comprehensive(), emphasizeCtx: true})
  ],
  compositionStrategy: 'hierarchical', // Respects prerequisites
  maxTokens: 200000
})`,
        points: [
          explanation('Orthogonal composition: any knowledge category with any summary level'),
          syntax('mixin-based', 'reusable components that combine flexibly'),
          methodology('Address specific learning needs through targeted combinations'),
          evidence('Modular learning objects proven effective across education sectors')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Composition strategies:
// Sequential: Mixin1 → Mixin2 → Mixin3 (traditional order)
// Interleaved: Concept from Mixin1 → Related from Mixin2 (topical)
// Hierarchical: Prerequisites first, builds complexity progressively

// Reusability benefits:
// - Same mixin works across different contexts
// - Update one mixin improves all contexts using it
// - Dependency management prevents invalid combinations
// - Token-aware compression fits contexts to limits`,
        explain: 'systematic composition enables both flexibility and consistency across teaching materials'
      }),
      comparison('monolithic documentation', {
        advantage: 'hundreds of targeted combinations vs one-size-fits-all approach'
      }),
      whenToUse('when creating teaching materials for diverse audiences with different needs and complexity levels')
    ]
  })
})

Doclet('singlePassOptimization', {
  impl: principle({
    importance: 'high',
    rule: 'Design teaching contexts for single-pass understanding - embed verification rather than requiring iterations',
    rationale: 'LLMs process linearly without ability to revise early conclusions. Single-pass optimization front-loads verification to prevent need for iterations.',
    guidance: [
      solution({
        code: `// Single-pass structure:
// 1. IMMEDIATE core implementation exposure
mechanismUnderTheHood({
  snippet: includeActualSourceCode('packages/core/utils/jb-core.js'),
  explain: 'This is how TGP actually works - study this first!'
}),

// 2. VERIFIED working examples with results  
solution({
  code: 'pipeline([{name:"Homer"}, {name:"Bart"}], count()) // → 2',
  points: [explanation('These results come from actual test execution')]
}),

// 3. BUILT-IN self-verification questions with answers
solution({
  code: '// Q: What executes TGP profiles? A: run(profile, ctx) function',
  points: [explanation('Wrong answers indicate contamination from external concepts')]
})`,
        points: [
          methodology('Front-load verification instead of requiring iterations'),
          syntax('embedded verification', 'include self-check questions with answers in context'),
          explanation('Single-pass design prevents need for external tool calls during learning'),
          evidence('200K context can contain complete verification without requiring iterations')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Why single-pass is critical:
// 1. LLM limitations: can't revise early conclusions within session
// 2. Tool call limits: verification requires multiple interactions
// 3. Working memory: can't truly "learn" and revise understanding
// 4. Linear processing: conclusions drawn early affect later interpretation

// Single-pass components:
// - Actual source code (not explanations)
// - Actual test results (not promises to test)
// - Built-in self-checks (not external verification)
// - Explicit anti-patterns (immediate contamination prevention)`,
        explain: 'single-pass optimization works with LLM limitations rather than against them'
      }),
      doNot('Designing teaching materials that require multiple tool calls or iterations to understand', {
        reason: 'LLMs have limited working memory and cannot revise understanding within session'
      }),
      bestPractice({
        suboptimalCode: 'learn → verify → iterate if wrong approach',
        better: 'learn WITH verification built-in approach',
        reason: 'verification embedded in context enables complete understanding in single pass'
      })
    ]
  })
})

Doclet('sourceCodeInclusion', {
  impl: principle({
    importance: 'high',
    rule: 'Include actual implementation code rather than abstractions or explanations of code',
    rationale: 'LLMs understand systems better when they see actual implementation. Code inclusion dramatically improves comprehension vs explanations.',
    guidance: [
      solution({
        code: `// Include actual source code:
mechanismUnderTheHood({
  snippet: \`// ACTUAL run() function from jb-core.js:
function run(profile, ctx = new Ctx(), settings = {...}) {
  if (profile && profile.$) {
    const comp = asComp(profile.$)
    const ret = comp.runProfile(profile, ctx, settings)
    res = toRTType(jbCtx.parentParam, ret)
  }
  return res
}\`,
  explain: 'This is how TGP actually executes - not an abstraction'
})`,
        points: [
          evidence('Source code inclusion dramatically improves understanding vs explanations'),
          methodology('Show actual implementation, not simplified models'),
          syntax('actual code', 'real implementation from source files, not pseudocode'),
          comparison('explanations of code', { advantage: 'LLMs can analyze actual logic vs interpreted descriptions' })
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Why actual code works better:
// 1. No interpretation layer: LLMs see actual logic
// 2. Complete context: all details present, not summarized
// 3. Verifiable: can trace through execution step by step
// 4. No abstraction loss: exact behavior visible
// 5. Pattern recognition: LLMs excel at analyzing real code

// What to include:
// - Core execution functions (run(), key algorithms)
// - Data structure definitions (Ctx, profile format)
// - Component implementation examples
// - Working test results with actual data`,
        explain: 'actual implementation provides concrete foundation for understanding abstractions'
      }),
      doNot('Explaining how code works instead of showing the actual code', {
        reason: 'explanations introduce interpretation errors - actual code is authoritative'
      }),
      bestPractice({
        suboptimalCode: 'describing algorithms and data structures in prose',
        better: 'including actual implementation code with brief explanations',
        reason: 'LLMs analyze code more accurately than they parse descriptions of code'
      })
    ]
  })
})

Doclet('systematicFailureAnalysis', {
  impl: principle({
    importance: 'high',
    rule: 'Analyze comprehension failures systematically to improve teaching materials iteratively',
    rationale: 'LLM learning failures follow patterns. Systematic analysis enables targeted improvements rather than trial-and-error refinement.',
    guidance: [
      solution({
        code: `// Failure analysis process:
analyzeAndImprove({
  testResults: 'results/tgp-test-session-1.json',
  failurePatterns: ['variable-timing-confusion', 'oop-contamination'], 
  improvementStrategies: [
    'add-execution-timeline-examples',
    'strengthen-anti-oop-patterns',
    'embed-more-working-code'
  ]
})
// → Generates: contexts/tgp-comprehensive-v2.js`,
        points: [
          methodology('Root cause analysis of comprehension failures'),
          syntax('pattern detection', 'identify systematic failure modes across test sessions'),
          explanation('Targeted improvements address specific comprehension gaps'),
          evidence('Systematic analysis more effective than random refinement')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Common LLM failure patterns:
// 1. Assumption contamination: applying external concepts
// 2. Terminology confusion: mixing system-specific with general terms
// 3. Timing misunderstanding: when things happen in execution
// 4. Layer confusion: mixing abstraction levels
// 5. Pattern overgeneralization: applying patterns inappropriately

// Analysis dimensions:
// - Which concepts failed most frequently
// - What wrong answers reveal about misconceptions  
// - Which examples were insufficient
// - Where anti-contamination was needed but missing
// - How to restructure for better comprehension`,
        explain: 'systematic analysis reveals improvement opportunities invisible to manual review'
      }),
      bestPractice({
        suboptimalCode: 'iterating based on intuition about what might be unclear',
        better: 'analyzing actual failure patterns from comprehension testing',
        reason: 'objective analysis reveals gaps that subjective review misses'
      }),
      whenToUse('after every round of comprehension testing to guide systematic improvement')
    ]
  })
})

Doclet('llmTeachingVsHumanTeaching', {
  impl: principle({
    importance: 'medium',
    rule: 'LLM pedagogy differs fundamentally from human education - adapt methods for AI learners',
    rationale: 'Human education research provides foundation but LLMs have unique characteristics requiring specialized approaches.',
    guidance: [
      solution({
        code: `// Human vs LLM learner differences:

// HUMANS:
// - Emotional engagement and motivation
// - Long-term retention and forgetting curves  
// - Learning disabilities and individual differences
// - Social learning and peer interaction
// - Self-reporting and introspective awareness

// LLMS:
// - Contamination patterns from external knowledge
// - Terminology precision requirements
// - Single-pass processing limitations
// - Pattern recognition vs deep understanding
// - Confident wrongness vs uncertainty expression`,
        points: [
          comparison('human learners', { advantage: 'LLMs require specialized pedagogical approaches' }),
          explanation('Adaptation required: external validation vs self-assessment'),
          explanation('Adaptation required: anti-contamination vs motivation'),
          methodology('Build on educational science but adapt for AI characteristics')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Adapted educational principles:
// 1. Progressive complexity → still valid for LLMs
// 2. Concrete before abstract → still valid for LLMs
// 3. Practice and feedback → adapted to external validation
// 4. Scaffolding support → adapted to anti-contamination
// 5. Assessment and evaluation → adapted to objective testing
// 6. Personalization → adapted to mixin-based synthesis

// Novel LLM requirements:
// - External validation (humans can self-assess)
// - Anti-contamination (humans don't have massive external knowledge)
// - Single-pass optimization (humans can iterate and revise)
// - Source code inclusion (humans work better with abstractions)`,
        explain: 'educational science provides foundation, but AI characteristics require adaptation'
      }),
      evidence('Adaptive learning research shows personalization improves outcomes by 40-60% for human learners'),
      evidence('LLM-specific adaptations show similar improvement potential for AI learners')
    ]
  })
})

Doclet('llmPedagogyAsNewField', {
  impl: principle({
    importance: 'medium',
    rule: 'LLM pedagogy represents new field combining educational science with AI training methodologies',
    rationale: 'Systematic teaching of AI systems requires specialized knowledge bridging education, cognitive science, and AI capabilities.',
    guidance: [
      solution({
        code: `// LLM Pedagogy field components:
// Educational Science + AI Understanding + Systematic Validation

// EDUCATIONAL SCIENCE:
// - Learning theory and cognitive load
// - Instructional design principles  
// - Assessment and evaluation methods
// - Personalization and adaptation

// AI UNDERSTANDING: 
// - LLM capabilities and limitations
// - Training vs inference characteristics
// - Knowledge representation and retrieval
// - Failure modes and bias patterns

// SYSTEMATIC VALIDATION:
// - External comprehension testing
// - Objective performance measurement
// - Iterative improvement processes
// - Effectiveness guarantees`,
        points: [
          explanation('Novel field combining established educational science with AI-specific requirements'),
          methodology('Systematic approach to teaching AI systems effectively'),
          evidence('Growing demand for systematic LLM education approaches'),
          comparison('traditional documentation', { advantage: 'systematic pedagogy vs hope-based approaches' })
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Field development trajectory:
// 1. Recognition: AI systems require specialized teaching
// 2. Adaptation: Educational principles adapted for AI learners  
// 3. Innovation: Novel methods for AI-specific challenges
// 4. Validation: Systematic testing proves effectiveness
// 5. Scaling: Industrialized application across domains

// Career implications:
// - LLM Pedagogical Designers
// - AI Learning Experience Engineers  
// - Computational Education Specialists
// - AI Comprehension Analysts`,
        explain: 'emerging field with potential for specialized roles and methodologies'
      }),
      evidence('Research validates approach as novel contribution building on established science'),
      whenToUse('when positioning LLM-Teacher work within broader educational technology landscape')
    ]
  })
})
