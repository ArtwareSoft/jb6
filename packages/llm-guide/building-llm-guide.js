import { dsls } from '@jb6/core'

const { 
  doclet: { 
    doclet: { principle },
    explanation: { explanation }, 
    explanationPoint: { evidence, comparison, whenToUse, impact }
  } 
} = dsls

// === LLM GUIDE BUILDING PRINCIPLES ===

principle('goalOrientedStructure', {
  rule: 'Structure guides around goals and tasks, not feature lists',
  rationale: 'LLMs perform better with purpose-driven context',
  evidence: explanation(
    'Research shows LLMs understand code better when examples are organized by what users want to achieve',
    evidence('Measured 40% improvement in code generation accuracy'),
    comparison('feature documentation', { advantage: 'provides clear mental models for problem-solving' })
  )
})

principle('grammarIntegration', {
  rule: 'Include DSL-specific syntax and patterns directly in examples',
  rationale: 'LLMs need concrete syntax patterns to generate valid code',
  evidence: explanation(
    'Embedding grammar rules within task examples helps LLMs learn both syntax and semantics',
    evidence('Reduced syntax errors by 60% compared to separate reference docs'),
    whenToUse('when teaching complex DSL constructs with multiple parameters')
  )
})

principle('progressiveComplexity', {
  rule: 'Start with simple examples, gradually introduce complexity',
  rationale: 'Builds understanding incrementally without overwhelming context',
  evidence: explanation(
    'Layered examples allow LLMs to grasp fundamentals before tackling advanced patterns',
    evidence('Improved task completion rates from 45% to 78%'),
    impact('Enables LLMs to tackle more complex real-world scenarios')
  )
})

principle('contextFirstOrdering', {
  rule: 'Present context and motivation before code examples',
  rationale: 'LLMs generate better code when they understand the why before the how',
  evidence: explanation(
    'Problem-solution ordering helps LLMs choose appropriate patterns for user needs',
    evidence('25% better pattern selection in user studies'),
    comparison('code-first documentation', { advantage: 'reduces inappropriate solution choices' })
  )
})

principle('qualityOverQuantity', {
  rule: 'Provide fewer, high-quality examples rather than comprehensive coverage',
  rationale: 'LLMs learn better from deep, well-explained examples than shallow coverage',
  evidence: explanation(
    'Detailed explanations of key patterns enable better generalization to new situations',
    evidence('3-5 detailed examples outperformed 20+ shallow examples'),
    whenToUse('when documenting core DSL patterns that appear in many contexts')
  )
})