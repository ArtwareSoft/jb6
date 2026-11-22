import { coreUtils, dsls, ns } from '@jb6/core'
import { reactUtils } from './react-utils.js'
import '@jb6/common/bucket-api.js'

const {
  tgp: { TgpType, 'ctx-enricher': { Var } },
  common: {
    data: { filter, pipe }
  },
  react: { ReactComp,
    'react-comp': { comp },
    'progress-indicator': { dots, spinner }
  }
} = dsls
const { bucket } = ns
const { asArray } = coreUtils
const { h } = reactUtils

const FormField = TgpType('form-field', 'react', { typescript: '{id, label, placeholder, initialValue, multiline}' })

const field = FormField('field', {
  params: [
    {id: 'id', as: 'string', mandatory: true},
    {id: 'label', as: 'string'},
    {id: 'placeholder', as: 'string'},
    {id: 'initialValue', as: 'string'},
    {id: 'multiline', as: 'boolean', type: 'boolean<common>'},
    {id: 'options', dynamic: true, description: 'picklist options, evaluated with the record as data - a dependent list reads another field from it'}
  ]
})

// the form knows nothing about buckets: it collects the fields into a record and hands it to onSubmit as ctx data.
// onSubmit's result is rendered as the submit outcome, so a bucket refusal (over budget) shows in the ui as it is.
const inputForm = ReactComp('inputForm', {
  params: [
    {id: 'fields', type: 'form-field[]', mandatory: true},
    {id: 'title', as: 'string'},
    {id: 'subtitle', as: 'string'},
    {id: 'submitLabel', as: 'string', defaultValue: 'Submit'},
    {id: 'onSubmit', type: 'action<common>', dynamic: true},
    {id: 'setup', type: 'ctx-enricher<tgp>', dynamic: true,
      description: `loads once, before the first render, what the field options read - e.g. Var('cities', bucket.get('cities.json'))`},
    {id: 'progressIndicator', type: 'progress-indicator<react>', dynamic: true, defaultValue: spinner(), description: 'shown while setup loads'},
    {id: 'failureText', as: 'string', description: `what to tell the user when onSubmit fails, e.g. 'write is blocked in the demo'; the server's own error follows it`}
  ],
  impl: comp({
    hFunc: (ctx, {react: {useState, useEffect}, uiLogger}, {fields, title, subtitle, submitLabel, onSubmit, failureText}) => () => {
    const [record, setRecord] = useState(Object.fromEntries(fields.map(f => [f.id, f.initialValue || ''])))
    const [optionsByField, setOptionsByField] = useState({})
    const [outcome, setOutcome] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const pickFields = fields.filter(f => f.options.profile)
    useEffect(() => {
      let live = true
      Promise.all(pickFields.map(async f => [f.id, asArray(await f.options(ctx.setData(record)))])).then(entries => {
        if (!live) return
        setOptionsByField(Object.fromEntries(entries))
        uiLogger?.info?.({t: 'options', counts: entries.map(([id, list]) => `${id}:${list.length}`).join(',')}, {}, {ctx})
      })
      return () => { live = false }
    }, [pickFields.map(f => record[f.id]).join('|')])
    const submit = async () => {
      setSubmitting(true)
      uiLogger?.info?.({t: 'submit', record}, {}, {ctx})
      const result = await onSubmit(ctx.setData(record))
      uiLogger?.info?.({t: 'submitted', ...result}, {}, {ctx})
      setSubmitting(false)
      setOutcome(result?.ok ? {ok: true, text: `stored ${result.key} (${result.size} bytes)`}
        : {ok: false, text: `${failureText || 'failed'}: ${result?.error || result?.status}`})
    }
    const fieldClass = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900'
    const onFieldChange = f => event => setRecord({...record, [f.id]: event.target.value})
    return h('div:flex justify-center bg-slate-100 p-6 min-h-full', {},
      h('div:w-full max-w-md self-start rounded-2xl bg-white p-6 shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/5', {},
        title && h('h2:text-lg font-semibold tracking-tight text-slate-900', {}, title),
        subtitle && h('p:mt-1 text-sm text-slate-500', {}, subtitle),
        h('div:mt-5 flex flex-col gap-4', {}, fields.map(f => h('label:block', {key: f.id},
          h('span:mb-1.5 block text-sm font-medium text-slate-700', {}, f.label || f.id),
          f.options.profile
            ? h('select', {className: fieldClass, name: f.id, value: record[f.id], onChange: onFieldChange(f),
                disabled: !(optionsByField[f.id] || []).length},
                h('option', {value: ''}, (optionsByField[f.id] || []).length ? (f.placeholder || `Select ${f.label || f.id}`) : 'no options'),
                (optionsByField[f.id] || []).map(option => h('option', {key: option, value: option}, option)))
            : h(f.multiline ? 'textarea' : 'input', {className: fieldClass, placeholder: f.placeholder || '', name: f.id,
                value: record[f.id], rows: f.multiline ? 3 : null, onChange: onFieldChange(f)})
        ))),
        h('button:mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
          {onClick: submit, disabled: submitting},
          submitting && h('L:loader-circle', {size: 15, className: 'animate-spin'}),
          submitting ? 'Submitting' : submitLabel),
        outcome && h(`div:mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${outcome.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-800 ring-rose-200'}`, {},
          h(outcome.ok ? 'L:circle-check' : 'L:circle-alert', {size: 15, className: 'mt-0.5 shrink-0'}),
          h('span:break-all', {}, outcome.text))
      )
    )
  },
    enrichCtx: '%$setup()%',
    progressIndicator: '%$progressIndicator()%'
  })
})

ReactComp('bucketForm', {
  description: 'contact form whose submissions are objects in the bucket, one object per email',
  params: [
    {id: 'requestsKey', as: 'string', defaultValue: 'data/requests.jsonl', description: 'the submissions line'},
    {id: 'citiesKey', as: 'string', defaultValue: 'metadata/cities.json', description: 'the reference data the picklists read'}
  ],
  impl: inputForm({
    fields: [
      field('name', 'Name', { placeholder: 'Homer Simpson' }),
      field('email', 'Email', { placeholder: 'homer@springfield.com' }),
      field('state', 'State', { placeholder: 'Select a state', options: pipe('%$cities%', '%state%') }),
      field('city', 'City', {
        placeholder: 'Select a city',
        options: pipe(Var('pickedState', '%state%'), '%$cities%', filter('%state% == %$pickedState%'), '%cities%')
      }),
      field('message', 'Message', { placeholder: 'What a form!', multiline: true })
    ],
    title: 'Contact us',
    subtitle: 'Every request is a line in data/requests.jsonl',
    onSubmit: bucket.append('%$requestsKey%'),
    setup: Var('cities', bucket.get('%$citiesKey%')),
    progressIndicator: dots('Loading cities'),
    failureText: 'Write is blocked in this demo'
  })
})
