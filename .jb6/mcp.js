import { dsls, coreUtils } from '@jb6/core'
import '@jb6/react/tailwind-utils.js'

const {
    common: { Data,
       data: { compileTailwindCSS, pipeline, split, first, list, dslDocs, tgpModel, bookletsContent, pipe, keys,filter, join }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool, 
      tool: { mcpTool }
     },
} = dsls

Tool('compileTailwindCSS', {
   params: [
     {id: 'html', as: 'text'}
   ],
   impl: mcpTool(compileTailwindCSS('%$html%'))
})
 