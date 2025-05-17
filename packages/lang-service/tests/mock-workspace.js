import { jb, coreUtils } from '@jb6/core'
import { langServiceUtils } from '@jb6/lang-service'
const { log } = coreUtils

const { lineColToOffset, closestComp } = langServiceUtils

jb.workspaceRegistry = {
    activeUri, 
    openDocs: {},
    lastEdit: null
}
const openDocs = jb.workspaceRegistry.openDocs

function activeUri() { return jb.workspaceRegistry.activeUri }
function activeDoc() { return openDocs[jb.workspaceRegistry.activeUri] }

jb.ext.tgpTextEditor = { host: {
        type: 'jbWorkspace',
        async applyEdit(edit,{docUri, ctx} = {}) {
            const _docUri = docUri || activeUri()
            const docText = openDocs[_docUri].text
            const from = lineColToOffset(docText, edit.range.start)
            const to = lineColToOffset(docText,edit.range.end)
            const newText = openDocs[_docUri].text = docText.slice(0,from) + edit.newText + docText.slice(to)
            jb.workspaceRegistry.lastEdit = { edit }
            if (ctx?.vars?.editorCmpId && !ctx?.vars?.doNotRefreshEditor) {
              const selector = `[cmp-id="${ctx.vars.editorCmpId}"]`
              ctx.runAction({ $: 'runFEMethodFromBackEnd', selector, method: 'setText', Data: { $asIs: newText} })
            }
        },
        getActiveDoc: () => activeDoc(),
        selectRange(start,{end, ctx} = {}) {
            end = end || start
            activeDoc().selection = { start, end: end || start }
            if (ctx?.vars?.editorCmpId && !ctx?.vars?.doNotRefreshEditor) {
                const selector = `[cmp-id="${ctx.vars.editorCmpId}"]`
                ctx.runAction({$: 'runFEMethodFromBackEnd', selector, method: 'selectRange', Data: {start, end}})
            }
        },
        compTextAndCursor() {
            const doc = activeDoc()
            return closestComp(doc.text, doc.selection.start.line, doc.selection.start.col, activeUri())                
        },
        async execCommand(cmd) {
            //console.log('exec command', cmd)
        },
        async saveDoc() {
        },
        initDoc(uri,text, selection = { start:{line:0,col:0}, end:{line:0,col:0} }) {
            openDocs[uri] = { text, selection}
            jb.workspaceRegistry.activeUri = uri
        },
        async getTextAtSelection() {
            const selection = activeDoc().selection
            const docText = activeDoc().text
            const from = lineColToOffset(docText, selection.start)
            const to = lineColToOffset(docText, selection.start)
            return docText.slice(from,to)
        },
        log(arg) { log(arg,{})},
        async gotoFilePos(path,line,col) {},
        lastEdit: () => jb.workspaceRegistry.lastEdit
}}

export const tgpEditorHost = jb.ext.tgpTextEditor