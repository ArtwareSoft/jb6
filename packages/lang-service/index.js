import '@jb6/core'
import '@jb6/core/misc/resolve-types.js'
import '@jb6/core/misc/calc-import-map.js'
import '@jb6/core/misc/probe.js'

import './src/tgp-model-data.js'
import './src/pretty-print.js'
import { langServiceUtils } from './src/lang-service-parsing-utils.js'
import './src/lang-service-utils.js'
import './src/lang-service.js'
import './src/tgp-snippet.js' // order is important here

export { langServiceUtils }