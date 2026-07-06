import { dsls } from '@jb6/core'
import '@jb6/react'

const { tgp: { TgpType, Component } } = dsls

TgpType('visualized-data', 'react')

Component('jbScript', {
  type: 'visualized-data<react>',
  params: [
    {id: 'setup', type: 'ctx-enricher<tgp>', dynamic: true, byName: true},
    {id: 'steps', type: 'ctx-enricher<tgp>', dynamic: true, byName: true},
    {id: 'result', type: 'data<common>', dynamic: true},
    {id: 'visualizeResult', type: 'react-comp<react>', dynamic: true}
  ],
  impl: (ctx, {}, { setup, steps, result, visualizeResult }) => {
    const enrich = cctx => { const afterSetup = setup(cctx) || cctx; return steps(afterSetup) || afterSetup }
    return {
      calc:       cctx => result(enrich(cctx)),
      showResult: cctx => visualizeResult({ data: result(enrich(cctx)) })
    }
  }
})
