import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, join } },
  'llm-guide': { Doclet,
    doclet: { howTo, principle },
    guidance: { solution, proceduralSolution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology, evidence },
    problemStatement: { problem },
    validation: { externalValidation, practicalValidation, conceptualValidation },
    step: { step, synthesisCheckpoint }
  } 
} = dsls

// Sample data for examples
Const('sessionLogs', [
  {sessionId: 'llm-session3', topic: 'DSL extension', issues: ['backwards compatibility', 'validation design', 'MCP integration']},
  {sessionId: 'llm-session2', topic: 'component design', issues: ['parameter types', 'TGP patterns']},
  {sessionId: 'llm-session1', topic: 'documentation', issues: ['learning methodology', 'spiral approach']}
])

Doclet('dslOwnerVsClient', {
  description: 'Understanding the fundamental distinction between DSL owners and DSL clients',
  impl: howTo(
    problem({
      statement: 'How to extend DSLs appropriately based on whether you own the DSL or are a client of it',
      intro: 'Different extension strategies apply based on your relationship to the DSL: owners can modify directly, clients must extend via namespaces.'
    }),
    solution({
      code: `// DSL OWNER: You control the DSL and can modify it directly

// Example: packages/common/ owns the common DSL
// Can add new components directly to the DSL:
Data('newDataOperation', {           // ✅ Direct DSL extension
  params: [{id: 'input', mandatory: true}],
  impl: (ctx, {input}) => processData(input)
})

Action('newAction', {                // ✅ Direct DSL extension  
  params: [{id: 'target', mandatory: true}],
  impl: (ctx, {target}) => performAction(target)
})

// Owner privileges:
// - Modify existing components safely (with compatibility)
// - Add new TgpTypes to the DSL
// - Change DSL structure and organization
// - Set DSL conventions and standards`,
      points: [
        explanation('DSL owners have direct modification rights and responsibility for compatibility'),
        syntax('Direct component addition', 'new components become part of the official DSL'),
        whenToUse('when you maintain and control the DSL package'),
        performance('direct extension is most efficient but carries compatibility responsibility'),
        comparison('client extension', { advantage: 'full control but must consider all users' })
      ]
    }),
    solution({
      code: `// DSL CLIENT: You use a foreign DSL and must extend via namespaces

// Example: packages/social-db/ extends common DSL (doesn't own it)
// CANNOT modify common DSL directly - must use namespace extension:

// 1. Define components in the foreign DSL:
DataStore('dataStore', {             // ✅ Adds component to common DSL
  params: [
    {id: 'fileName', as: 'string', mandatory: true},
    {id: 'sharing', type: 'sharing', mandatory: true}
  ]
})

// 2. Add operations via your package namespace:
Action('socialDb.get', { ... })     // ✅ Your namespace: ns.socialDb.get
Action('socialDb.put', { ... })     // ✅ Your namespace: ns.socialDb.put
Action('socialDb.refine', { ... })  // ✅ Your namespace: ns.socialDb.refine

// Client constraints:
// - Cannot modify foreign DSL structure
// - Must use namespace for operations
// - Cannot change foreign DSL conventions
// - Must respect foreign DSL compatibility`,
      points: [
        explanation('DSL clients extend via namespaces without modifying the foreign DSL'),
        syntax('Namespace operations', 'Action("packageName.operation") creates package-scoped operations'),
        whenToUse('when extending DSLs owned by other packages'),
        performance('namespace extension prevents conflicts and maintains DSL integrity'),
        comparison('direct modification', { advantage: 'no ownership conflicts, clean separation' })
      ]
    }),
    solution({
      code: `// USAGE PATTERNS: Owner vs Client differences

// DSL OWNER usage (packages/common/):
const result = pipeline(data, newDataOperation(), otherOperation())
// ↑ Direct DSL usage - operations are part of the DSL

// DSL CLIENT usage (packages/social-db/):
const store = dataStore('messages', {...})           // ← DSL component
await socialDb.get(store, userId, roomId)            // ← Package operation
await socialDb.put(store, userId, roomId, data)      // ← Package operation

// Clear separation:
// - DSL provides the components (dataStore)
// - Package provides the operations (socialDb.*)`,
      points: [
        explanation('Owner and client usage patterns reflect different extension mechanisms'),
        syntax('DSL vs namespace', 'dsls.common.data vs ns.socialDb operations'),
        whenToUse('understanding your role determines your extension strategy'),
        evidence('social-db, testing, llm-guide all follow client pattern with common DSL'),
        performance('separation enables multiple clients to extend same DSL independently')
      ]
    })
  )
})

Doclet('extendingDslsGuide', {
  description: 'Comprehensive guide for extending DSLs safely and effectively',
  impl: howTo(
    problem({
      statement: 'How to extend existing DSLs without breaking compatibility while adding valuable new functionality',
      intro: 'This guide captures lessons learned from extending the llm-guide DSL with validation, quiz systems, and MCP tool integration. It addresses the critical balance between innovation and stability.'
    }),
    principle({
      importance: 'critical',
      rule: 'Always consult before changing framework code - even for improvements',
      rationale: 'Framework changes affect multiple users and systems. What looks like an improvement might break existing workflows or have unintended consequences.',
      guidance: [
        solution({
          code: `// ❌ WRONG: Implementing changes without consultation
// "I found this issue and will fix it by replacing the implementation..."

// ✅ RIGHT: Consultation-first approach  
// "I found this issue. May I propose a fix? Here are the options:
// 1. Backwards-compatible enhancement
// 2. New additive functionality 
// 3. Breaking change with migration path
// Which approach would you prefer?"`,
          points: [
            explanation('Framework ownership requires consultation for any changes'),
            methodology('Present options rather than implementations - collaboration over assumption'),
            evidence('Prevented breaking changes to llm-guide DSL by consulting before major rewrite'),
            performance('Consultation prevents rework and maintains team alignment')
          ]
        }),
        doNot('making framework changes without explicit permission', {
          reason: 'violates collaborative development principles and can break dependent systems'
        })
      ]
    }),
    principle({
      importance: 'high', 
      rule: 'Adding parameters never breaks compatibility - leverage TGP flexibility',
      rationale: 'TGP systems handle missing parameters gracefully, making additive changes safe',
      guidance: [
        solution({
          code: `// ✅ SAFE: Adding optional parameters
Step('step', {
  params: [
    {id: 'action', as: 'text', mandatory: true},           // Existing
    {id: 'validation', as: 'text', type: 'validation'},    // Enhanced: supports both text AND objects
    {id: 'mcpTool', type: 'tool<mcp>'},                    // New: optional MCP integration
    {id: 'points', type: 'explanationPoint[]'}             // Existing
  ]
})

// Existing code continues to work:
step({action: 'Do something', validation: 'Check it works'})

// New code can use enhanced features:
step({
  action: 'Test understanding', 
  validation: externalValidation({
    quizFile: 'quiz.js',
    answerFile: 'answers.js'
  })
})`,
          points: [
            explanation('TGP gracefully handles missing parameters and extra parameters'),
            syntax('type and as together', 'supports both old (text) and new (validation object) usage'),
            performance('Zero migration cost - existing code runs unchanged'),
            comparison('breaking changes', { advantage: 'additive changes maintain all existing functionality' })
          ]
        }),
        mechanismUnderTheHood({
          snippet: `// TGP parameter resolution:
// 1. Required params checked first
// 2. Optional params use defaults if missing  
// 3. Extra params ignored gracefully
// 4. Type coercion handles multiple formats

// This makes additive evolution safe`,
          explain: 'TGP parameter system designed for evolutionary enhancement without breaking changes'
        })
      ]
    }),
    proceduralSolution({
      procedure: 'Systematic DSL Extension Methodology',
      steps: [
        step({
          action: 'Identify the real problem worth solving',
          purpose: 'Ensure extensions address genuine needs, not just theoretical improvements',
          details: `// Problem identification process:
// 1. Document specific pain points with examples
// 2. Assess impact: how many users affected?
// 3. Evaluate alternatives: can existing DSL handle this?
// 4. Consider complexity: is the solution proportional to the problem?`,
          validation: conceptualValidation({
            questions: 'What specific problem does this extension solve? Who benefits? What are the alternatives?',
            expectedUnderstanding: 'Clear problem statement with evidence of need and impact assessment',
            points: [
              methodology('Evidence-based extension decisions prevent feature bloat'),
              performance('Focus on high-impact, low-complexity additions first')
            ]
          }),
          points: [
            explanation('Many DSL extension requests come from theoretical needs rather than practical pain'),
            evidence('Quiz-based validation solved real LLM self-assessment problem, while some validation enhancements were nice-to-have'),
            whenToUse('before any design work - problem clarity prevents over-engineering')
          ]
        }),
        step({
          action: 'Analyze backwards compatibility impact',
          purpose: 'Understand exactly what will and won\'t break with proposed changes',
          details: `// Compatibility analysis framework:
// SAFE: Adding new TgpTypes, new parameters, new components
// SAFE: Enhancing existing parameters with additional types
// RISKY: Changing parameter signatures, removing parameters
// BREAKING: Changing component behavior, removing components`,
          validation: practicalValidation({
            task: 'Review existing DSL usage and test compatibility',
            tool: {
              $: 'tool<mcp>getFilesContent',
              filesPaths: 'search for existing DSL usage patterns',
              repoRoot: '%$REPO_ROOT%'
            },
            expectedResult: 'Comprehensive list of existing usage patterns that must continue working',
            points: [
              methodology('Concrete compatibility testing prevents surprises in production'),
              performance('Upfront compatibility analysis saves debugging time later')
            ]
          }),
          points: [
            explanation('TGP makes additive changes much safer than traditional APIs'),
            comparison('traditional APIs', { advantage: 'TGP parameter flexibility enables safe evolution' }),
            syntax('compatibility categories', 'helps make informed decisions about change risk levels')
          ]
        }),
        step({
          action: 'Design additive-first solutions',
          purpose: 'Prefer extending over replacing to maintain compatibility',
          details: `// Additive design patterns:
// 1. New TgpTypes for new functionality
// 2. Enhanced parameters supporting multiple types  
// 3. Optional new parameters for new features
// 4. Compose new with existing rather than replacing`,
          validation: externalValidation({
            concept: 'Additive vs replacement design patterns',
            quizFile: 'validation-quizzes/additive-design.js',
            answerFile: 'validation-answers/additive-design.js',
            executionRule: 'If unclear about additive patterns, run design examples',
            executionFallback: {
              $: 'tool<mcp>runSnippet',
              compText: 'pipeline(\'%$sessionLogs%\', filter(\'%topic% == "DSL extension"\'), \'%issues%\')',
              filePath: 'packages/core/llm-guide/extending-dsls.js',
              repoRoot: '%$REPO_ROOT%'
            },
            points: [
              methodology('External quiz prevents overconfidence in design understanding'),
              evidence('Validation and Quiz types were added, not replaced - maintained all existing functionality')
            ]
          }),
          points: [
            explanation('Additive design preserves existing investments while enabling new capabilities'),
            performance('Additive changes have zero migration cost'),
            whenToUse('whenever possible - replacement should be last resort for unfixable design problems')
          ]
        }),
        step({
          action: 'Integrate with existing infrastructure',
          purpose: 'Leverage existing systems rather than creating parallel implementations',
          details: `// Integration over duplication:
// ✅ Use existing 'tool<mcp>' type instead of creating 'tool-activation'
// ✅ Reference existing DSLs: 'validation' type references validation<llm-guide>
// ✅ Follow established patterns: params structure, naming conventions
// ❌ Create parallel systems that duplicate existing functionality`,
          validation: practicalValidation({
            task: 'Verify integration with existing MCP tools',
            tool: {
              $: 'tool<mcp>dslDocs',
              dsl: 'mcp', 
              repoRoot: '%$REPO_ROOT%'
            },
            expectedResult: 'Confirmation that existing MCP tools work with new DSL features',
            successCriteria: 'No need for new tool types - existing infrastructure sufficient',
            points: [
              explanation('Integration testing ensures new features work with existing ecosystem'),
              performance('Leveraging existing infrastructure reduces maintenance burden')
            ]
          }),
          points: [
            explanation('Good DSL extensions feel like natural evolution, not bolted-on additions'),
            evidence('MCP tool integration reused existing tool<mcp> type instead of creating new abstractions'),
            comparison('creating new systems', { advantage: 'integration leverages existing knowledge and tooling' })
          ]
        }),
        step({
          action: 'Implement with validation and testing',
          purpose: 'Ensure extensions work correctly and don\'t break existing functionality',
          details: `// Implementation validation process:
// 1. Test existing DSL usage continues working
// 2. Test new functionality works as designed  
// 3. Test integration points function correctly
// 4. Document new capabilities with examples`,
          validation: synthesisCheckpoint({
            integration: 'Synthesize learning: How do additive DSL changes maintain compatibility while adding value?',
            validation: 'Create a small DSL extension following the methodology',
            nextPrereq: 'Understanding of safe DSL evolution patterns and practical experience'
          }),
          points: [
            methodology('Systematic testing prevents regression and validates new functionality'),
            evidence('Enhanced llm-guide DSL maintained 100% backwards compatibility while adding validation, quiz, and MCP integration'),
            performance('Thorough testing upfront prevents expensive debugging later')
          ]
        })
      ],
      points: [
        explanation('Systematic methodology ensures consistent, safe DSL evolution'),
        evidence('Applied this process successfully to extend llm-guide DSL with complex new features'),
        performance('Structured approach scales to DSL extensions of any complexity')
      ]
    }),
    solution({
      code: `// CASE STUDY: Doclet DSL Extension Success Story
// Problem: LLM learning guides needed hands-on validation and assessment
// Challenge: Extend DSL without breaking existing documentation

// ✅ What worked:
// 1. Added new TgpTypes (Validation, Quiz) - pure addition
// 2. Enhanced Step with optional new parameters - backwards compatible
// 3. Integrated with existing MCP tools - leveraged infrastructure  
// 4. External answer files - solved LLM information leakage problem

// Before:
step({
  action: 'Learn concepts',
  validation: 'Read documentation and understand'  // Text only
})

// After (both work):
step({
  action: 'Learn concepts', 
  validation: 'Read documentation and understand'  // Still works!
})

step({
  action: 'Learn concepts',
  validation: externalValidation({              // Enhanced capability
    concept: 'Pipeline operations',
    quizFile: 'quiz/pipeline-basics.js',
    answerFile: 'answers/pipeline-basics.js',
    executionFallback: {
      $: 'tool<mcp>runSnippet',
      compText: 'pipeline(\'%$data%\', count())'
    }
  })
})`,
      points: [
        explanation('Real-world case study demonstrates successful DSL extension methodology'),
        evidence('Zero breaking changes while adding significant new capabilities'),
        performance('External answer file system solved previously unsolvable LLM assessment problem'),
        methodology('Consultation, compatibility analysis, additive design, and integration testing')
      ]
    }),
    doNot('changing DSL without considering existing usage', {
      reason: 'breaks existing code and disrupts user workflows'
    }),
    doNot('creating parallel systems instead of extending existing ones', {
      reason: 'fragments the ecosystem and increases maintenance burden'
    }),
    doNot('assuming compatibility - always test existing code paths', {
      reason: 'subtle breaking changes can be hard to detect without systematic testing'
    }),
    bestPractice({
      suboptimalCode: 'implementing DSL changes immediately when identifying problems',
      better: 'consulting first, analyzing compatibility, designing additively, then implementing',
      reason: 'systematic approach prevents breaking changes and ensures changes are actually valuable'
    }),
    mechanismUnderTheHood({
      snippet: `// DSL Extension Architecture:
// 1. TgpType system enables safe type addition
// 2. Parameter system handles missing/extra params gracefully
// 3. Component composition allows building on existing functionality
// 4. MCP integration provides execution infrastructure

// This architecture makes DSL evolution safe and powerful`,
      explain: 'TGP and MCP systems designed specifically to enable safe, powerful DSL extension'
    })
  )
})

Doclet('learningFromMistakes', {
  description: 'Key lessons learned about what NOT to do when extending DSLs',
  impl: howTo(
    problem({
      statement: 'Common mistakes in DSL extension and how to avoid them',
      intro: 'Real mistakes made during the llm-guide DSL extension process and the lessons learned.'
    }),
    solution({
      code: `// MISTAKE 1: Assuming compatibility instead of testing
// What happened: Thought changing parameter types would break compatibility
// Reality: TGP handles type flexibility gracefully
// Lesson: Test assumptions rather than avoiding potentially valuable changes

// MISTAKE 2: Over-engineering solutions  
// What happened: Designed complex validation hierarchy
// Reality: Simple additive approach was sufficient
// Lesson: Start simple, add complexity only when proven necessary

// MISTAKE 3: Reinventing existing infrastructure
// What happened: Almost created new 'tool-activation' type
// Reality: Existing 'tool<mcp>' type was perfect
// Lesson: Survey existing infrastructure before creating new abstractions`,
      points: [
        explanation('Real mistakes provide more valuable learning than theoretical best practices'),
        evidence('Each mistake led to better understanding of TGP flexibility and design principles'),
        methodology('Document and share mistakes to prevent others from repeating them'),
        performance('Learning from mistakes faster than discovering principles from scratch')
      ]
    }),
    solution({
      code: `// SESSION LOG ANALYSIS: What went wrong and right
${pipeline('%$sessionLogs%', filter('%sessionId% == "llm-session3"'), '%issues%', join())}

// Key insights from the session:
// 1. Consultation prevents wasted work on wrong approaches
// 2. Backwards compatibility fears were often unfounded  
// 3. Existing infrastructure more capable than initially understood
// 4. Value assessment crucial - not all improvements worth the complexity`,
      points: [
        explanation('Session logs provide concrete evidence of learning process'),
        methodology('Systematic logging enables post-session analysis and improvement'),
        evidence('Real session data shows evolution from uncertainty to clarity'),
        performance('Learning captured for future reference and sharing')
      ]
    })
  )
})
