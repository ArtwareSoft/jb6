import { dsls } from '@jb6/core'
import './llm-guide-dsl.js'

const { 
  common: { Data },
  tgp: { TgpType },
} = dsls

const Skill = TgpType('skill', 'llm-guide')
const SkillSet = TgpType('skill-set', 'llm-guide')
const Benchmark = TgpType('benchmark', 'llm-guide')
const BenchmarkResult = TgpType('benchmark-result', 'llm-guide')

Skill('skill', {
  params: [
    {id: 'name', as: 'string', madatory: true},
    {id: 'description', as: 'text', madatory: true}
  ]
})

SkillSet('skillSet', {
  params: [
    {id: 'name', as: 'string', madatory: true},
    {id: 'description', as: 'text', madatory: true},
    {id: 'skills', type: 'skill[]', madatory: true},
    {id: 'bestInQuality', type: 'booklet-and-model', madatory: true},
    {id: 'bestInSpeed', type: 'booklet-and-model', madatory: true},
    {id: 'bestInPrice', type: 'booklet-and-model', madatory: true},
    {id: 'guidance', type: 'guidance[]'}
  ]
})

Benchmark('benchmark', {
    params: [
        {id: 'validation', type: 'vaildation', madatory: true},
        {id: 'tested-guidance', type: 'guidance[]', byName: true },
        {id: 'tester-guidance', type: 'guidance[]' },
    ]
})

BenchmarkResult('benchmarkResult', {
    params: [
        {id: 'benchmark', type: 'benchmark', madatory: true},
        {id: 'tested', type: 'booklet-and-model', madatory: true},
        {id: 'answerSheet', as: 'text', madatory: true},
        {id: 'mark', as: 'string', madatory: true},
        {id: 'date', as: 'number', madatory: true},
    ]
})
