import { coreUtils } from '@jb6/core'   
import { existsSync } from 'fs'
import { provideCompletionItems, provideDefinition, provideReferences, vsCodelog, commands } from './tgp-lang-extension-utils.mjs'
jbVSCodeLog('utils loaded', commands)

const { logException } = coreUtils
 
export async function doActivate(context) {

    // 'openProbeResultPanel','openjBartStudio','openProbeResultEditor','closeProbeResultEditor'
    ;['moveUp','moveDown','openjBartTest','visitLastPath','delete','duplicate','applyCompChangeOfCompletionItem'
        ,'openProbeResultEditor','closeProbeResultEditor']
            .forEach(cmd => vscodeNS.commands.registerCommand(`jbart.${cmd}`, commands[cmd]))
    

	context.subscriptions.push(vscodeNS.languages.registerCompletionItemProvider('javascript', {
		provideCompletionItems() {
            try {
                return provideCompletionItems().then(res=>res.items)
            } catch(e) {
                debugger
                vsCodelog('exception provide completions',e)
                logException(e,'provide completions')
            }
		}
	}))
	context.subscriptions.push(vscodeNS.languages.registerDefinitionProvider('javascript', {
		provideDefinition() {
            try {
                return provideDefinition()
            } catch(e) {
                debugger
                vsCodelog('exception provide definition',e)
                logException(e,'provide definition')
            }
        }
	}))
	context.subscriptions.push(vscodeNS.languages.registerReferenceProvider('javascript', {
		provideReferences() {
            try {
                return provideReferences()
            } catch(e) {
                debugger
                vsCodelog('exception provide References',e)
                logException(e,'provide References')
            }
        }
	})) 
}

async function initConfig() {
    const configFile = `${VSCodeWorkspaceProjectRoot}/jb6.config.js`
    const exists = await existsSync(configFile)
    if (exists) {
        vsCodelog('local jb6.config.js found and loaded', configFile)
        const { setUpJb6 } = await import(configFile)
        setUpJb6(coreUtils)
    }
}
await initConfig()