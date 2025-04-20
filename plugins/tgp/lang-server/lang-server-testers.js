using('ui-common')

component('probeOverlayTest', {
  type: 'test',
  params: [
    {id: 'overlay', type: 'overlay', dynamic: true},
    {id: 'expectedResult', type: 'boolean', dynamic: true, as: 'boolean'},
    {id: 'compId', as: 'string', byName: true},
    {id: 'line', as: 'number'},
    {id: 'col', as: 'number'}
  ],
  impl: dataTest({
    calculate: pipe(Var('forceLocalSuggestions', true), langServer.calcProbeOverlay('%$overlay()%')),
    expectedResult: '%$expectedResult()%',
    runBefore: async (ctx,{},{compId, line, col}) => {
        const loc = jb.comps[compId].$location
        const docContent = await jbHost.codePackageFromJson().fetchFile(loc.path)
        tgpEditorHost().initDoc(loc.path, docContent)
        tgpEditorHost().selectRange({line: loc.line + line,col})
        tgpModels[loc.path] = new tgpModelForLangService(jb.tgp.tgpModelData({plugin: jb.comps[compId].$plugin}))
    },
    includeTestRes: true
  })
})


