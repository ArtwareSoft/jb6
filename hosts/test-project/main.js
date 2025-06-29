import { dsls } from "@jb6/core"
import '@jb6/common'
import '@jb6/llm-guide'

const { 
    common: { Data, 
      data: { pipeline }
    }
} = dsls

Data('cmpA', {
  impl: pipeline('%% cmpA')
})

Data('cmpB', {
  impl: '%% cmpB'
})

Data('cmpC', { 
    impl: '%% cmpC'
})