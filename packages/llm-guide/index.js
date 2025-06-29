import './llm-guide.js'
import './llm-guide-principles.js'
import './building-new-dsl.js'
import './extending-existing-dsl.js'
import './working-with-existing-dsl.js'
import './using-mcp-server.js'



// Export guide metadata for external consumption
export const guideMetadata = {
  'llm-guide': {
    description: 'Core DSL definition for creating documentation patterns',
    category: 'core',
    components: ['doclet', 'guidance', 'explanation', 'explanationPoint']
  },
  'building-llm-guide': {
    description: 'Principles and best practices for building effective LLM guides',
    category: 'methodology',
    components: ['principle definitions', 'evidence-based guidelines']
  },
  'building-new-dsl': {
    description: 'Guide for creating new DSL definitions from scratch',
    category: 'development',
    components: ['DSL creation patterns', 'type definitions']
  },
  'extending-existing-dsl': {
    description: 'How to extend and modify existing DSL definitions',
    category: 'development', 
    components: ['extension patterns', 'backwards compatibility']
  },
  'working-with-existing-dsl': {
    description: 'Best practices for using and documenting existing DSLs',
    category: 'usage',
    components: ['documentation patterns', 'example structures']
  },
  'using-mcp-server': {
    description: 'Integration with Model Context Protocol servers',
    category: 'integration',
    components: ['MCP integration', 'server communication']
  }
}

// Helper functions for guide discovery
export const getAvailableGuides = () => Object.keys(guideMetadata)

export const getGuidesByCategory = (category) => {
  return Object.entries(guideMetadata)
    .filter(([, meta]) => meta.category === category)
    .map(([name]) => name)
}

export const getGuideCategories = () => {
  return [...new Set(Object.values(guideMetadata).map(meta => meta.category))]
}

export const getGuideInfo = (guideName) => {
  return guideMetadata[guideName] || null
}
