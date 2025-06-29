
import { jb, dsls, coreUtils } from '@jb6/core'
	import '/home/shaiby/projects/jb6/packages/common/tests/pipelines-tests.js'
const {
	common:{ Data, 
		data: { join, pipeline }
	},
	tgp:{ 
		comp: { tgpComp }
	}
} = dsls
      ;(async () => {
        try {
          Const('people', [
  {name: 'Homer Simpson', age: 42, male: true},
  {name: 'Marge Simpson', age: 38, male: false},
  {name: 'Bart Simpson', age: 12, male: true}
])
          Data('x', {impl: pipeline('%/name%', join()) })
          const result = await dsls.common.data.x.$run()
          process.stdout.write(JSON.stringify(coreUtils.stripData(result), null, 2))
        } catch (e) {
          console.error(e)
        }
        process.exit(0)
      })()
    