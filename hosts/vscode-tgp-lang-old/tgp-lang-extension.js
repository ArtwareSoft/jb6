import * as vscodeNS from 'vscode'
import { coreUtils } from '@jb6/lang-service'
import { provideCompletionItems, provideDefinition, provideReferences, vsCodelog, commands } from './tgp-lang-extension-utils.js'

const { logException } = coreUtils
 
export async function activate(context) {
    //await jb.vscode.initVscodeAsHost({context})

    // 'openProbeResultPanel','openjBartStudio','openProbeResultEditor','closeProbeResultEditor'
    ;['moveUp','moveDown','openjBartTest','visitLastPath','delete','duplicate','applyCompChangeOfCompletionItem']
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
