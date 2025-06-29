import { dsls } from '@jb6/core'
  
const {
    mcp: { Prompt }
} = dsls

Prompt('explainComponent', {
    description: 'Explain a JB6 component by fetching its code and providing context',
    params: [
      { id: 'componentName', as: 'string', mandatory: true, description: 'Name of the component to explain' },
      { id: 'filePath', as: 'string', mandatory: true, description: 'File path containing the component' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'Repository root path' }
    ],
    impl: async (ctx, { componentName, filePath, repoRoot }) => {
      // Fetch the file content
      const fileResult = await runNodeScript({
        script: `
  import { readFileSync } from 'fs'
  import { join } from 'path'
  
  try {
    const content = readFileSync(join('${repoRoot}', '${filePath}'), 'utf8')
    process.stdout.write(JSON.stringify({ result: content }))
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }))
  }
        `,
        repoRoot
      })
  
      if (fileResult.isError) {
        return {
          content: [{ type: 'text', text: `Error reading file: ${fileResult.content[0].text}` }],
          isError: true
        }
      }
  
      const fileContent = JSON.parse(fileResult.content[0].text).result
  
      // Get TGP model for additional context
      const tgpResult = await runNodeScript({
        script: `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'
  import '@jb6/lang-service'
  
  const res = await coreUtils.calcTgpModelData({ filePath: join('${repoRoot}', '${filePath}') })
  process.stdout.write(JSON.stringify(res))
        `,
        repoRoot
      })
  
      let componentInfo = ''
      if (!tgpResult.isError) {
        try {
          const tgpData = JSON.parse(tgpResult.content[0].text)
          // Find the specific component in the TGP data
          const allComponents = Object.values(tgpData.dsls || {}).flatMap(dsl => 
            Object.values(dsl).flatMap(type => Object.values(type))
          )
          const component = allComponents.find(comp => comp.id === componentName)
          
          if (component) {
            componentInfo = `
  
  **Component Type:** ${component.type}<${component.dsl}>
  **Parameters:** ${component.params?.map(p => `${p.id}${p.mandatory ? '*' : ''}: ${p.type || p.as}`).join(', ') || 'none'}
  **Description:** ${component.description || 'No description available'}`
          }
        } catch (e) {
          // TGP parsing failed, continue without component info
        }
      }
  
      return {
        content: [{
          type: 'text',
          text: `Please explain this JB6 component "${componentName}" from ${filePath}:
  
  \`\`\`javascript
  ${fileContent}
  \`\`\`
  ${componentInfo}
  
  Focus on:
  - What this component does and its purpose
  - How to use it with examples
  - Its role in the JB6 ecosystem`
        }],
        isError: false
      }
    }
})