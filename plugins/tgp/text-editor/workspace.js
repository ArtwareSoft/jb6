import {lineColToOffset, closestComp } from './tgp-text-editor.js'
import { jb, utils } from '../../common/common-utils.js'

let activeUri
const openDocs = {}

let _lastEditForTester
export const lastEditForTester = () => _lastEditForTester

jb.ext.tgpTextEditor = { host: {
        type: 'jbWorkspace',
        async applyEdit(edit,{docUri, ctx} = {}) {
            const _docUri = docUri || activeUri
            const docText = openDocs[_docUri].text
            const from = lineColToOffset(docText, edit.range.start)
            const to = lineColToOffset(docText,edit.range.end)
            const newText = openDocs[_docUri].text = docText.slice(0,from) + edit.newText + docText.slice(to)
            _lastEditForTester = { edit }
            if (ctx?.vars?.editorCmpId && !ctx?.vars?.doNotRefreshEditor) {
              const selector = `[cmp-id="${ctx.vars.editorCmpId}"]`
              ctx.runAction({ $: 'runFEMethodFromBackEnd', selector, method: 'setText', Data: { $asIs: newText} })
            }
        },
        getActiveDoc: () => openDocs[activeUri],
        selectRange(start,{end, ctx} = {}) {
            end = end || start
            openDocs[activeUri].selection = { start, end: end || start }
            if (ctx?.vars?.editorCmpId && !ctx?.vars?.doNotRefreshEditor) {
                const selector = `[cmp-id="${ctx.vars.editorCmpId}"]`
                ctx.runAction({$: 'runFEMethodFromBackEnd', selector, method: 'selectRange', Data: {start, end}})
            }
        },
        compTextAndCursor() {
            const doc = openDocs[activeUri]
            return closestComp(doc.text, doc.selection.start.line, doc.selection.start.col, activeUri)                
        },
        async execCommand(cmd) {
            //console.log('exec command', cmd)
        },
        async saveDoc() {
        },
        initDoc(uri,text, selection = { start:{line:0,col:0}, end:{line:0,col:0} }) {
            openDocs[uri] = { text, selection}
            activeUri = uri
        },
        async getTextAtSelection() {
            const selection = openDocs[activeUri].selection
            const docText = openDocs[activeUri].text
            const from = lineColToOffset(docText, selection.start)
            const to = lineColToOffset(docText, selection.start)
            return docText.slice(from,to)
        },
        log(arg) { utils.log(arg,{})},
        async gotoFilePos(path,line,col) {}
}}

