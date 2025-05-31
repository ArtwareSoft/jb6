import { coreUtils, dsls, ns } from '@jb6/core'
import { langServiceUtils } from '@jb6/lang-service'
import {} from '@jb6/core/utils/probe.js'
import { readFile } from 'fs/promises'

const { jb, logError, asArray, log, Ctx } = coreUtils
const { calcHash, closestComp, applyCompChange } = langServiceUtils
const { langService } = ns

let lastEdit
let lastEditedCompId
function host() { return jb.ext.tgpTextEditor.host }

jb.ext.tgpTextEditor = { host:  {
    async applyEdit(edit, { uri, hash, activeTextEditor } = {}) {
        const editor = activeTextEditor || vscodeNS.window.activeTextEditor
        if (!editor) return logError('No active editor found.')
    
        uri = uri || editor.document.uri
        if (hash) {
            const { compText } = closestComp(
                editor.document.getText(), editor.selection.active.line, editor.selection.active.character, editor.document.uri.path)
            const code = '{\n' + (compText || '').split('\n').slice(1).join('\n').slice(0, -1)
            if (hash !== calcHash(code))
                return logError('applyEdit - hash mismatch, edits not applied.', { hash, compText, text: code })
        }

        const wEdit = new vscodeNS.WorkspaceEdit()
        const edits = Array.isArray(edit) ? edit : [edit]
        asArray(edit).forEach(edit => {
            if (!edit.range || edit.newText == null)
                return logError('applyEdit - Invalid edit format.', { edit })
            const range = { start: toVscodeFormat(edit.range.start), end: toVscodeFormat(edit.range.end) }
            wEdit.replace(uri, range, edit.newText)
        })
    
        log('vscode applyEdit', { wEdit, edits, uri })
        lastEdit = edits.map(e => e.newText).join('\n')            
        await vscodeNS.workspace.applyEdit(wEdit)
    },
    getActiveDoc: () => vscodeNS.window.activeTextEditor.document,
    async selectRange(start,{end}={}) {
        end = end || start
        const editor = vscodeNS.window.activeTextEditor
        const line = start.line
            editor.revealRange(new vscodeNS.Range(line, 0,line, 0), vscodeNS.TextEditorRevealType.InCenterIfOutsideViewport)
            editor.selection = new vscodeNS.Selection(line, start.col, end.line, end.col)
    },
    compTextAndCursor() {
        const editor = vscodeNS.window.activeTextEditor
        const path = editor.document.uri.fsPath

        const docProps = closestComp(editor.document.getText().replace(/\r\n/g,'\n'),
            editor.selection.active.line, editor.selection.active.character, path)
        if (docProps?.shortId) {
            if (lastEditedCompId != docProps.shortId) {
                vsCodelog('clean tgpModels cache')
                jb.langServiceRegistry.tgpModels = {} // clean cache
            }
            lastEditedCompId = docProps.shortId
        }
        return docProps
    },
    async execCommand(cmd) {
        vscodeNS.commands.executeCommand(cmd)
    },
    saveDoc() {
        return vscodeNS.window.activeTextEditor.document.save()
    },
    async gotoFilePos({path,line,col}) {
        const targetUri = vscodeNS.Uri.file(path)
        const position = new vscodeNS.Position(line, col)
        const doc = await vscodeNS.workspace.openTextDocument(targetUri)
        const editor = await vscodeNS.window.showTextDocument(doc, { preview: false })
        editor.selection = new vscodeNS.Selection(position, position)
        await editor.revealRange(new vscodeNS.Range(position, position))
        vsCodelog(`gotoFilePos ${path}:${line},${col}`)
    },
    lastEdit() { return lastEdit },
    log(...args) {
        return vsCodelog(...args)
    }
}}

vscodeNS.workspace.onDidChangeTextDocument(({document, reason, contentChanges}) => {
    if (!contentChanges || contentChanges.length == 0) return
    if (!document.uri.toString().match(/^file:/)) return
    log('vscode onDidChangeTextDocument clean cache',{document, reason, contentChanges})
    if (contentChanges?.[0]?.text == lastEdit)
        lastEdit = ''
})

export function vsCodelog(...args) {
    asArray(args).map(x=>jbVSCodeLog(tryStringify(x)))
//    jbHost.log([...args,`time: ${new Date().getTime() % 100000}`])

    function tryStringify(x) {
        if (!x) return ''
        if (typeof x == 'string') return x
        try {
            return JSON.stringify(x)
        } catch(e) {
            return x.toString && x.toString()
        }
    }
}

export async function provideCompletionItems() {
    return langService.completionItems.$run()
}

export async function provideDefinition() {
    const loc = await langService.definition.$run()
    if (loc.error == 'definition - bad format') {
        const choice = await vscodeNS.window.showInformationMessage('format?', 'OK', 'Cancel')
        if (choice == 'OK') {
            const loc = await langService.definition.$run()
            if (loc.reformatEdits)
                await applyCompChange({ edit: loc.reformatEdits, cursorPos: loc.cursorPos })
        }
        return
    }
    if (!loc || loc.error)
        return logError('provideDefinition - no location returned', {})
    const path = loc.path
    return new vscodeNS.Location(vscodeNS.Uri.file(path), new vscodeNS.Position((+loc.line) || 0, 0))
}

export async function provideReferences() {
    const locations = await langServer.references.$run()
    const res = locations.map(({path, line, col}) => new vscodeNS.Location(vscodeNS.Uri.file(path), new vscodeNS.Position(line-1, col)))
    return res
}

async function moveInArray(diff) {
    const {edit, cursorPos} = await new Ctx({data: diff}).run(langService.moveInArrayEdits('%%'))
    await host().applyEdit(edit)
    cursorPos && host().selectRange(cursorPos)
}

let testingHtmlTemplate = null
async function getTestingHtmlTemplate() {
    if (!testingHtmlTemplate) {
        const importmap = await calcImportMapsFromVSCodeExt()
        const jbTestingDir = importmap.imports['@jb6/testing']
        testingHtmlTemplate = await readFile(`${jbTestingDir}/tests-in-vscode.html`,'utf-8')
        testingHtmlTemplate = testingHtmlTemplate.replace('VS_CODE_IMPORT_MAP', JSON.stringify(importmap,null,2))
    }
    return testingHtmlTemplate
}

const panels = {}
export const commands = {
    async applyCompChangeOfCompletionItem(item) {
        const editAndCursor = item.edit ? item : await langService.editAndCursorOfCompletionItem.$run({item})
        return applyCompChange(editAndCursor)
    },
    moveUp() {
        return moveInArray(-1)
    },
    moveDown() { 
        return moveInArray(1)
    },

    async openProbeResultEditor() { // ctrl-I
        vscodeNS.commands.executeCommand('workbench.action.editorLayoutTwoRows')        
        const compProps = await langService.calcCompProps.$run() // IMPORTANT - get comp props here. opening the view will change the current editor
        if (!panels.inspect) {
            panels.inspect = vscodeNS.window.createWebviewPanel('jbart.inpect', 'inspect', vscodeNS.ViewColumn.Two, { enableScripts: true })
            panels.inspect.onDidDispose(() => { delete panels.inspect })
        }
        const { path, filePath } = compProps
        const queryParams = {
            probe: path,
            modulePath: filePath
        }
     
        const probeResultTemplate = await getTestingHtmlTemplate()
        const html = probeResultTemplate.replace('QUERY_PARAMS_JSON', JSON.stringify(queryParams) + ';debugger;')
        vsCodelog(html)
        panels.inspect.webview.html = 'hello'
    },

    visitLastPath() { // ctrl-Q
//        jb.tgpTextEditor.visitLastPath()
    },

    closeProbeResultEditor() { // ctrl-shift-I
        delete panels.inspect
        // delete jb.jbm.childJbms.vscode_inspect
        vscodeNS.commands.executeCommand('workbench.action.editorLayoutSingle')
    },

    openLiveProbeResultPanel() {
    },

    // async openjBartStudio() { // ctrl-j - should open quick menu
    //     const compProps = await langService.calcCompProps.$run({includeCircuitOptions: true})
    //     if (compProps.path)
    //         new Ctx({data: compProps}).run(jbMenu())

    // // const url = await jb.calc(langServer.studioCircuitUrl())
    // // vscodeNS.env.openExternal(vscodeNS.Uri.parse(url))
    // },

    openjBartTest() { // ctrl-shift-j - should open menu
        const docProps = host().compTextAndCursor()
        const testID = docProps.shortId
        // todo: move base url to setup
        vscodeNS.env.openExternal(`http://localhost8083/packages/tests-runner/tests.html?test=${testID}&show&spy=test`)
    },

    async delete() {
        const {edit, cursorPos, hash} = await langService.deleteEdits.$run()
        await host().applyEdit(edit,{hash})
        cursorPos && host().selectRange(cursorPos)
    },

    // async disable() {
    //     const {edit, cursorPos, hash} = await jb.calc(langService.disableEdits())
    //     await host().applyEdit(edit,{hash})
    //     cursorPos && host().selectRange(cursorPos)
    // },

    async duplicate() {
        const {edit, cursorPos, hash} = await langService.duplicateEdits().$run()
        await host().applyEdit(edit,{hash})
        cursorPos && host().selectRange(cursorPos)
    }
}

function toVscodeFormat(pos) {
    return { line: pos.line, character: pos.col }
}
