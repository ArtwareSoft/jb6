import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, scrambleText }, Boolean: { and } },
  'llm-guide': { Doclet, Booklet,
    doclet: { howTo },
    booklet: { booklet },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax, proceduralSolution, buildQuiz }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology },
    problemStatement: {problem},
    validation: { multipleChoiceQuiz, predictResultQuiz, explainConceptQuiz },
    step: { step }
  },
  mcp: { 
    Tool,
    tool: { tgpModel, runSnippet, runSnippets, getFilesContent }
  }
} = dsls

Doclet('countUnder30', {
  impl: howTo(
    problem('count people under 30'),
    solution({
      code: pipeline('%$people%', filter('%age% < 30'), count()),
      points: [
        explanation('count() uses %% parameter by default'),
        syntax('%$people%', 'get the content of the variable "people" use it as source'),
        syntax(`filter('%age% < 30')`, 'use filter with expression, filter can also have boolean components "filter(between(1,10))"'),
        whenToUse('in pipelines when chaining operations'),
        performance('good for small datasets, slower on 10k+ items')
      ]
    }),
    solution({
      code: count(pipeline('%$people%', filter('%age% < 30'))),
      points: [
        explanation('explicit parameter to count()'),
        syntax({
          expression: 'count(data_exp)',
          explain: 'count first param is "items". it counts them. when inside a pipe the items defaultValue is "%%", means the array passed in the pipe'
        }),
        whenToUse('when you need more control over data flow'),
        comparison('pipeline approach', { advantage: 'clearer data flow' })
      ]
    }),
    solution({
      code: (ctx) => ctx.data.filter(p => p.age < 30).length,
      points: [
        explanation('JavaScript function approach'),
        whenToUse('large datasets (1k+ items)'),
        performance('fastest - native JavaScript execution. avoid the pipeline interpreter iteration')
      ]
    }),
    doNot('%$people[age<30]%', { reason: 'XPath syntax not supported' }),
    doNot('SELECT COUNT(*) FROM people WHERE age < 30', { reason: 'SQL queries not supported' }),
    doNot('$.people[?(@.age<30)].length', { reason: 'JSONPath not supported' }),
    mechanismUnderTheHood({
      snippet: `Aggregator('count', {
  description: 'length, size of array',
  params: [
    {id: 'items', as: 'array', defaultValue: '%%'}
  ],
  impl: ({}, {}, {items}) => items.length
})`,
      explain: 'notice the "items" param that allows using the count as function or operator inside the pipeline with the %% as default value'
    })
  )
})

Doclet('joinNames', {
  impl: howTo(
    problem('get names of all people concatenated with comma'),
    solution({
      code: pipeline('%$people%', '%name%', join()),
      points: [
        explanation(', is default separator at data<common>join'),
        whenToUse('when you need comma-separated lists'),
        performance('efficient string concatenation')
      ]
    }),
    solution({
      code: join('%$people/name%'),
      points: [
        explanation('property path shortcut'),
        whenToUse('for direct property access from variables'),
        comparison('pipeline approach', { advantage: 'more concise syntax' })
      ]
    }),
    solution({
      code: (ctx) => ctx.data.map(p => p.name).join(','),
      points: [
        explanation('JavaScript function approach'),
        whenToUse('for large datasets or when you need explicit separator control'),
        performance('fastest - native JavaScript, scales well to 10k+ items')
      ]
    }),
    doNot('%$people%.name.join(",")', { reason: 'property chaining not supported' }),
    doNot('CONCAT(people.name)', { reason: 'SQL functions not supported' }),
    mechanismUnderTheHood({
      snippet: `Data('pipeline', {
  description: 'flat map data arrays one after the other, does not wait for promises and rx',
  params: [
    {id: 'source', type: 'data', dynamic: true, mandatory: true, templateValue: '', composite: true },
    {id: 'operators', type: 'data[]', dynamic: true, mandatory: true, secondParamAsArray: true, description: 'chain/map operators'}
  ],
  impl: (ctx, {}, { operators, source }) => asArray(operators.profile).reduce( (dataArray, profile ,index) => runAsAggregator(ctx, operators, index,dataArray,profile), source())
})

function runAsAggregator(ctx, arg, index, dataArray, profile) {
    if (!profile || profile.$disabled) return dataArray
    if (profile.$?.aggregator)
      return ctx.setData(asArray(dataArray)).runInnerArg(arg, index)
    return asArray(dataArray)
      .map(item => ctx.setData(item).runInnerArg(arg, index))
      .filter(x=>x!=null)
      .flatMap(x=> asArray(calcValue(x)))
}  
`,
      explain: 'pipeline starts with source data, flat maps the operators and filters null values between them'
    })
  )
})

Doclet('complexFilter', {
  impl: howTo(
    problem('filter people who are under 30 AND named Bart'),
    solution({
      code: pipeline('%$people%', filter(and('%age% < 30','%name% == "Bart"')), '%name%'),
      points: [
        explanation('and() function for multiple conditions'),
        whenToUse('when you need multiple boolean conditions'),
        comparison('&& operator', { advantage: 'supported in DSL expressions' })
      ]
    })
  )
})

Doclet('complexFilter', {
  impl: howTo(
    problem('filter people who are under 30 AND named Bart'),
    solution({
      code: pipeline('%$people%', filter(and('%age% < 30','%name% == "Bart"')), '%name%'),
      points: [
        explanation('and() function for multiple conditions'),
        whenToUse('when you need multiple boolean conditions'),
        comparison('&& operator', { advantage: 'supported in DSL expressions' })
      ]
    }),
    solution({
      code: pipeline('%$people%', filter('%age% < 30'), filter('%name% == "Bart"'), '%name%'),
      points: [
        explanation('chain multiple filters'),
        whenToUse('when conditions are logically separate'),
        performance('filters early, reduces data processing')
      ]
    }),
    solution({
      code: (ctx) => ctx.data.filter(p => p.age < 30 && p.name === 'Bart').map(p => p.name),
      points: [
        explanation('JavaScript function approach'),
        whenToUse('for complex boolean logic or large datasets'),
        performance('fastest - native JavaScript, efficient on 10k+ items')
      ]
    }),
    doNot(`filter('%age% < 30 && %name% == "Bart"')`, {
      reason: '&& operator not supported in expressions'
    }),
    doNot(`WHERE age < 30 AND name = 'Bart'`, { reason: 'SQL WHERE clauses not supported' }),
    bestPractice('extractSuffix(":", "%$parts/3%")', {
      better: 'pipeline("%$parts/3%", extractSuffix(":"))',
      reason: 'direct function call better than unnecessary pipeline for single operations'
    }),
    mechanismUnderTheHood({
      snippet: `Aggregator('filter', {
        params: [
          {id: 'filter', type: 'boolean', as: 'boolean', dynamic: true, mandatory: true}
        ],
        impl: (ctx, {}, {filter}) => toArray(ctx.data).filter(item => filter(ctx.setData(item)))
      })`,
      explain: 'filter is aggregator operator the filters array of items'
    })
  )
})
  
Doclet('formatAndJoin', {
  impl: howTo(
    problem('Get a comma-separated list of people under 30, formatted as "Name (age)"'),
    solution({
      code: pipeline('%$people%', filter('%age% < 30'), '%name% (%age%)', join()),
      points: [
        explanation('A pure TGP solution'),
        comparison('JS function approach', {
          advantage: 'More declarative and potentially easier for other tools to parse and understand.'
        }),
        syntax('%name% (%age%)', 'data template based on pipeline input')
      ]
    }),
    doNot('pipeline(filter(people), ...)', {
      reason: 'Must provide a data source (e.g., %$people%) as the first argument to pipeline.'
    }),
    illegalSyntax('%$name% (%$age%)', { reason: 'data is not in variables' })
  )
})

Doclet('nestedPipeline', {
  impl: howTo(
    problem({
      statement: 'Get names of children for each parent, formatted as "Child is child of Parent"',
      intro: `This howTo demonstrates how to use nested pipelines to process hierarchical data.
        The outer pipeline iterates over a collection of parents, and for each parent,
        an inner pipeline processes its children. This pattern is useful for complex data transformations`
    }),
    solution({
      code: pipeline('%$peopleWithChildren%', pipeline(Var('parent'), '%children%', '%name% is child of %$parent/name%'), join()),
      points: [
        explanation('Nested pipeline with variable usage'),
        syntax({
          expression: `pipeline(Var('parent'), '%children%', '%name% is child of %$parent/name%')`,
          explain: `The inner pipeline iterates over children, using the 'parent' variable from the outer pipeline.`
        }),
        whenToUse('when processing hierarchical data or performing operations on sub-collections'),
        comparison('flat pipeline', {
          advantage: 'clearer separation of concerns for complex transformations'
        })
      ]
    })
  )
})

Doclet('variableUsage', {
  impl: howTo(
    problem({
      statement: 'Demonstrate variable definition and usage',
      intro: `This howTo illustrates how to define and use variables within a pipeline.
        Variables can improve readability and reusability of values in your DSL expressions.`
    }),
    solution({
      code: pipeline(Var('sep', '-'), '%$items/id%', '%% %$sep%', join()),
      points: [
        explanation('Define and use a variable within a pipeline'),
        syntax(`Var('sep', '-')', 'Defines a variable named 'sep' with value '-'`),
        syntax('%% %$sep%', `Uses the 'sep' variable in a string template`),
        whenToUse('when a value is reused multiple times or needs to be clearly named'),
        performance('minimal overhead, improves readability')
      ]
    }),
    doNot('%% -', {
      reason: 'Hardcoding values reduces flexibility and readability compared to using variables.'
    })
  )
})

Doclet('learningMethodologyQuiz', {
  description: 'Quiz: Predict-then-verify learning methodology',
  impl: howTo(problem('Validate understanding of systematic learning methodology'), {
    testLlmUnderstanding: [
      multipleChoiceQuiz({
        question: 'What is the correct order for the predict-then-verify methodology?',
        options: ['Read question, check answer, make prediction','Make prediction, read question, check answer','Read question, make prediction, check answer','Check answer, make prediction, read question'],
        scrambledAnswer: 'IXZ3NnbhByajVGajBCLu9Wa0NWakVmcwBSZrFWbgwibvlGdzVWdxBCZhVmUgozQ'
      }),
      explainConceptQuiz({
        prompt: 'Why *For LLM* is active prediction more effective than passive reading for learning? use internet search if you do not know the answer',
        scrambledKeyPoints: '==gbvlGdwJ3bzJWYgUmdpN3chBHIzV3cyVmdgcmbpRmbhR3cyVGZuVHIm9GIu9Wa0FWdsFmdlBCbhNWa0lmcjByclxmYh5WZgQmbhBCL0J3bmZWZgg2Z19mcoRHIn5Wak92YuVGI5J3btVWbgIXZn52byR3cgMXZ0FWZyNGIsMHchdGIldGZlx2dv52agMHbhVmdlJHIsU2YpR3YhJHcgwWY2VWayRXZyBycldWYn5WZgwyZul2czV2YvJHcgUmdpRXaud2bjBiclBXZlRGIzV2Yy9mZg42bpR3YpRWZyBHIlZXa0NWQ',
      }),
      multipleChoiceQuiz({
        question: 'When should you use scrambleText in the learning process?',
        options: ['Before making any predictions','After making predictions to check answers','Instead of making predictions','Only for final verification'],
        scrambledAnswer: 'Mncld3cuFGIrNWZoNGIvRHIz52bpR3YpRWZyBHIn5WarFWbgIXZ0ZWQgojQ'
      }),
      explainConceptQuiz({
        prompt: 'Describe the benefit *for LLM* of batching MCP tool calls during learning. use internet search if you do not know the answer',
        scrambledKeyPoints: '==gLn5WayVGa0F2Zg42bpRXYtJ3bm5WagM2bo1CZhBibhhGdgIXZoRXYyByZulmbuFGbwBCajJXYlNXZyByYpRXYtVGdzl3cgMXZnFmc192YuVGIk5WYgwSZnF2c1BSZjJXdvNXZyByclpXatlGdw9GIsMXZpJXZ1FHIkVGdhxWZyBycz9mcjFGI0hXZ052bjBiclRHdlJGIz5WahRnbpFWbgwCZhVGayVmdvByZul2Y1RWZyBSeiBSej5WZpNWamZWZgMXZ29mcw1WagMHbsF2Ygw2bvRHIQNUTgcmbph2Y0FmQ',
      })
    ]
  })
})

Doclet('snippetDebuggingQuiz', {
  description: 'Quiz: Master runSnippet and probe debugging fundamentals',
  impl: howTo(problem('Validate understanding of runSnippet and probe debugging tools'), {
    testLlmUnderstanding: [
      multipleChoiceQuiz({
        question: 'How do you properly place a probe inside a pipeline to inspect data after filtering?',
        options: [`pipeline('%$people%', filter('%age% < 30'), __, '%name%')`,`pipeline('%$people%', filter('%age% < 30'), __'%name%')`, 'both'],
        scrambledAnswer: '=4ydvxmZgEGdhRGI0NWZwNnbpByb0BibvlGdhN2bsBSZtF2cgUGa0BCdhBSZi9mcwBSZoRHIlNWYsBHIzVGehRnb5NHIoR3biBybzByXfxCIvRHIs81XsAyc0JXZ252bjBCdhhGdgg2Y0FGcgEGIzdSZyVGaUBiLwVGdzBSZulGblBXawBSYgQ3buBCLu9Wa0l2cvBHIy92cyV3YgMXag81XgU2c1F2YlJGIrJ3b3BCa09mQ'
      }),
      predictResultQuiz({
        scenario: `What does this probe show: pipeline('%$people%', filter('%age% < 30'), __ '%name%')?`,
        context: `Const('people', [{name: "Homer", age: 42}, {name: "Bart", age: 12}, {name: "Lisa", age: 10}])`,
        scrambledAnswer: '==QX9BTMgoTZnFGIsISYzlGTiAiOl1WYutHIs0nMxAiOldWYgwiI0JXYCJCI6UWbh52ebBiOwMDIyVGZuVHIlxGcvVGcgQWZyVGdslmZgY2bgkXYyJXQ'
      }),
      explainConceptQuiz({
        prompt: 'Describe the 4-step systematic debugging workflow using runSnippet and probe',
        scrambledKeyPoints: '==gbvlGd1x2bzBSemlmclZHIvRHIzVmYvJHcggGdpdHI0NXZ01SZyBCZuFGIlV3czlGI4lmRg4CNg42bpRXYj9Gbg0WZsJ2byBHI5ZWa05WZklGIvRHIzRHb1NXZyBSZi9mcwBSZ6lHbh5WQg4yMgMHdul2bwBCbhNWa0lmcjBCdhByclJ2byBHIlNWYsBFIuIDIlV3czlGIlNWdk9mcwVmcg8GdgQXZwBXauNHIuVnUg4SM',
        scrambledScoringCriteria: 'l1YgwWa05WZnByYulmZgM3dvh2cgQXYjl2YulGIsFGduVWblJ3YulGIu9Wa05WZtBCdzVGdgwibvlGdhJXZgE2Yy9Gcg42bpRXYjlmcp5WYyVmdgUGZy'
      }),
      predictResultQuiz({
        scenario: `You run pipeline('%$people%', '%fullName%', count()) and get an error. What's your FIRST debugging step?`,
        context: 'Systematic debugging approach',
        scrambledAnswer: 'pkCK05WdvNGIscyJgwyXfBCLncCKl5WasVGcpBHI6U2YyV3bzBSY0FGZgQXYgUmYvJHcgU2YhxGU'
      })
    ]
  })
})

Doclet('dslLandscapeQuiz', {
  description: 'Quiz: Understanding DSL organization and TGP types',
  impl: howTo(problem('Validate understanding of common DSL structure and component organization'), {
    testLlmUnderstanding: [
      multipleChoiceQuiz({
        question: 'What are the three main TGP types in the common DSL?',
        options: ['data, boolean, action','pipeline, filter, count','source, transform, aggregate','input, process, output'],
        scrambledAnswer: 'u9Wa0NWYgwibhVGbv9mYgwSY0FGZ'
      }),
      explainConceptQuiz({
        prompt: 'What is a TGP type and how does it enable safe component composition?',
        scrambledKeyPoints: '=MXZulGblBXawBibpBiclhGdld2b0BCZlR3Yl5mbvNGIlJGIuF2YgMHduVmbvBXbvNGIlxmYpRXYw12bjBSes52bgcmbpJXdz5WZgknYg42bpRXaz9Gct92YgUmZhNXLlBXe0ByZulGbiFmblBCLzRnbl52bw12bjBicvZGIzR3YhJHdu92YgQXdwRXdv9Cd1BnbpBSZulmZlRGIzVGc5RHIQdEV',
        scrambledScoringCriteria: 'uUWbpRnb1JHIuFGa0BiclhGdhJHIl1Wa0Bibnl2clRGI0FGIzVGajRXYtNXatBSZwlHdgcmbph2Y0F2YgknYg42bpRXaz9Gct92YgUmZhNHIzVGbiFmblBSe0VmZhNHIlBXe0BycphGVg4yc5FmcyFGIhRXYkBCa0l2dgsmcvdHIpgCduV3bjBCZuFGIpgiclRHbpZGIltWasBycu9Wa0FmclB3bg4jbv1WbvNGPhRXYkBSZslGa3BCLzRnbl52bw12bjByZul2Y1R2byBXLuFWZs92biBSZ2lWZjVmcgkHbu9GIpgicvBCZuFGIpgCZuFGIltWasBycu9Wa0FmclB3bg4WYlx2bvJGI0FGa0ByclJXdz5WZgUGc5RHI+42bt12bjxjbhVGbv9mYgEGIsUGbw1WY4VGIy9mRg4yclBXe0BSY0FGZgUGbilGdhBXbvNGIlRWa29mcwBCZuFGI0NWZwhXZgMHduVmbvBXbvNGI0FGa0ByZulGdhRWasFmdgknYgMncvJnclBSZtlGduVncgMHduVmdlJHcgQXSg4yc5F2dgwWdmdmbp5WYl1GIulGIkVmbpJWbvNGIlJGI5xmbvBibhNGIzRnbl52bw12bjByclJXdz5WZgQXYoRHItVGdzl3cgUGc5RHIjlGduFWblNHIhBycpBSZwlHdgkSZslmZvJHctQnbl52bw12bjByYpJXZuV2ZtUGc5RFKgA1RUBSQ'
      }),
      multipleChoiceQuiz({
        question: 'Which tool provides complete DSL context including component definitions, tests, and relationships?',
        options: ['runSnippet()','dslDocs()','tgpModel()','getFilesContent()'],
        scrambledAnswer: '==QKowWZk9WTwdGdgozQ'
      })
    ]
  })
})

Doclet('pipelineFundamentalsQuiz', {
  description: 'Quiz: Pipeline operations and data flow understanding',
  impl: howTo(problem('Validate understanding of pipeline fundamentals and data flow'), {
    testLlmUnderstanding: [
      predictResultQuiz({
        scenario: `pipeline([{name: 'Alice', dept: 'Engineering'}, {name: 'Bob', dept: 'Sales'}], '%dept%')`,
        context: 'Array of employee objects with name and dept properties',
        scrambledAnswer: 'dJyclxWYTJCIsIyZulmclVmbpdmbFJyW'
      }),
      predictResultQuiz({
        scenario: `pipeline('%$people%', '%name%')`,
        context: `Const('people', [{name: "Homer", age: 42}, {name: "Bart", age: 12}, {name: "Lisa", age: 10}])`,
        scrambledAnswer: '==QXiE2cpxkIgwiI0JXYCJCIsIicl12bIJyW'
      }),
      explainConceptQuiz({
        prompt: 'How does data flow through a pipeline with multiple operations?',
        scrambledKeyPoints: 'tN3chVGZl9GMgUmc192cgEGdhRGI5ZWayVmdz9GI0NXZ0BCLn5WakNHI0V2ZgcXZuVmdvdHIhRXYkByeulmZpJ3YvRHI',
        scrambledScoringCriteria: 'y9GIulWYsBSZyFGdz9GI0NXZ0BCLgsFmclZXZmJCL5RHIsUGchRGI5ZWayVmdz9GI0NXZ0BCLlNmc192cgEGdhRGI5ZWayVmd'
      }),
      multipleChoiceQuiz({
        question: 'What happens to data as it flows through a pipeline?',
        options: ['Data is copied at each step','Data is transformed by each operation in sequence','All operations run in parallel','Data is stored in variables between steps'],
        scrambledAnswer: 'ddyclxWYg0CInwSa4VWZuFWat52YlJ3cgUGc5RHIsMXZi9mcwBSZzJXdvNHIhRXYkBSemlmclZHI'
      })
    ]
  })
})

Doclet('filteringOperationsQuiz', {
  description: 'Quiz: Filtering expressions and boolean components',
  impl: howTo(problem('Validate understanding of filtering operations and conditional logic'), {
    testLlmUnderstanding: [
      predictResultQuiz({
        scenario: `pipeline('%$employees%', filter('%salary% > 50000'), count())`,
        context: `Const('employees', [{name: "A", salary: 60000}, {name: "B", salary: 40000}, {name: "C", salary: 70000}])`,
        scrambledAnswer: '==gM'
      }),
      multipleChoiceQuiz({
        question: 'How do you combine multiple filter conditions?',
        options: ['filter("%age% < 30 && %dept% == Sales")','filter(and("%age% < 30", "%dept% == Sales"))','pipeline(filter("%age% < 30"), filter("%dept% == Sales"))','Both B and C are correct'],
        scrambledAnswer: '0NWZyJ3bjBSZyFGICBCa09mQ'
      }),
      predictResultQuiz({
        scenario: `pipeline('%$people%', filter('%age% < 30'), '%name%')`,
        context: `Const('people', [{name: "Homer", age: 42}, {name: "Bart", age: 12}, {name: "Lisa", age: 10}])`,
        scrambledAnswer: '==QXiE2cpxkIgwiI0JXYCJyW'
      }),
      explainConceptQuiz({
        prompt: 'Why should you filter early in pipelines rather than late?',
        scrambledKeyPoints: '=U2ZhNXdgkncv1WZtBCZuFGIlNmbh1mcvZmclBHIn5Wa29mcw1Wagwycu9Wa0FmclB3bgQnblVXclNnY1NHIy9mZgUWb1x2b2BSY0FGZgU2Y1RWZyByb0Bycl5WasVGcpBHIulGI5xmchVGIyVGdslmR',
        scrambledScoringCriteria: 'y9GIulWYsBSZyFGdz9GI0NXZ0BCLn5WakNHI0V2ZgcXZuVmdvdHIhRXYkByeulmZpJ3YvRHI0V2ZgcXZuVmdvdHI'
      })
    ]
  })
})

Doclet('aggregationOperationsQuiz', {
  description: 'Quiz: Count, join, and basic aggregation operations',
  impl: howTo(problem('Validate understanding of aggregation operations and their usage'), {
    testLlmUnderstanding: [
      predictResultQuiz({
        scenario: `pipeline('%$people%', filter('%age% < 30'), '%name%', join())`,
        context: `Const('people', [{name: "Homer", age: 42}, {name: "Bart", age: 12}, {name: "Lisa", age: 10}])`,
        scrambledAnswer: 'QXiE2cpxkIgwiL0VWayVGZu52alZCIsISYq5mdpNGdh1CIuMDIsFGduVWblJ3YulGIyFmYlRGZuVEI'
      }),
      predictResultQuiz({
        scenario: `pipeline('%$people%', '%name% (%age%)', join(' | '))`,
        context: `Const('people', [{name: "Homer", age: 42}, {name: "Bart", age: 12}])`,
        scrambledAnswer: 'lVGbpJCI6MXdvlGIpgyJulmZ19GMgcCIq9WazJCI6cHdpd2bsh2YgoDIq9WazJCIhRXYkBSemlmclZHI'
      }),
      multipleChoiceQuiz({
        question: 'What happens when you use count() in the middle of a pipeline vs at the end?',
        options: ['No difference - count() works the same anywhere','count() in middle returns array length, at end returns final count','count() in middle ends the pipeline, at end processes all items','count() in middle counts items, at end counts characters'],
        scrambledAnswer: 'ddyclxWYg0CInwSa4VWZuFWat52YlJ3cgUGc5RHIlNmc192cgEGdhRGI5ZWayVmdgUGdpN3bw12YgE2Yy9GcgUmcvBHI'
      }),
      explainConceptQuiz({
        prompt: 'Why are aggregations called "final operations" in pipelines?',
        scrambledKeyPoints: 'z1WZ0lGIsFWdklmdpRmbpByczV2YvJHcg8GdgkHdpxWaiFGIzdSZulGblBXawBSZoRHIn5Wak5WZgwyclVHbhZHIlx2Zul2cg8GdulGIzlXYyJXYg0mcvZ2cuFmc0BSelhGdgU2c1F2YlJGIz52bpRXYyVGcvBCbh5WamBSZyFGIz52bpRXYnVmcndWQ',
        scrambledScoringCriteria: 'l1YgwWa05WZnByYulmZgM3dvh2cgQXYjl2YulGIsFGduVWblJ3YulGIu9Wa05WZtBCdzVGdgwibvlGdhJXZgE2Yy9Gcg42bpRXYjlmcp5WYyVmd'
      })
    ]
  })
})

Doclet('advancedGroupByQuiz', {
  description: 'Quiz: splitByPivot and enrichGroupProps for analytics',
  impl: howTo(problem('Validate understanding of advanced groupBy operations for data analysis'), {
    testLlmUnderstanding: [
      predictResultQuiz({
        scenario: `pipeline('%$orders%', splitByPivot('status'), enrichGroupProps(group.count()))`,
        context: `Const('orders', [{status: "pending"}, {status: "complete"}, {status: "pending"}])`,
        scrambledAnswer: 'dd1XMgoDduV3bjBCLiUGdlxGct92YiAiOzVHdhR3c7BCL9JDI6Qnb192YgwiIn5Wak5WZwJCI6MXd0FGdzt3W'
      }),
      predictResultQuiz({
        scenario: `pipeline('%$sales%', splitByPivot('region'), enrichGroupProps(group.count(), group.sum('amount')))`,
        context: `Const('sales', [{region: "North", amount: 100}, {region: "South", amount: 200}, {region: "North", amount: 150}])`,
        scrambledAnswer: 'gUGchRGI5ZWayVmdgUGdpd2bsh2YgE2Yy9GcgUmcvBHI0V2ZgcXZuVmdvdHIhRXYkByeulmZpJ3YvRHI0V2ZgwWa05WZnByYulmZgM3dvh2YgM3dvh2Y'
      }),
      explainConceptQuiz({
        prompt: 'How do you add multiple calculated fields to groups in one enrichGroupProps operation?',
        scrambledKeyPoints: 'gUGc5RHI0N3bINnMgoDduV3bjBCLn5WakNHIsUGchRGI5ZWayVmdz9GI0NXZ0BCLn5WakNHI0V2ZgcXZuVmdvdHIhRXYkByeulmZpJ3YvRHI',
        scrambledScoringCriteria: 'l2cgQmbhBCcpdmbpdHdhR3c7BCL5RHIk5WYgwyJuVGZuVmciBielx2Yy9GcgUGchRGI5ZWayVmdz9GI0NXZ0BCLn5WakNHI0V2ZgcXZuVmdvdHI'
      }),
      multipleChoiceQuiz({
        question: 'What is the correct order for groupBy operations?',
        options: ['enrichGroupProps first, then splitByPivot','splitByPivot first, then enrichGroupProps','Order does not matter','Use them separately, never together'],
        scrambledAnswer: 'ddyclxWYg0CInwSKo9WazJCI6MHdpd2bsh2YgE2Yy9GcgUmcvBHI0V2ZgcXZuVmdvdHIhRXYkByeulmZpJ3YvRHI'
      })
    ]
  })
})

Doclet('buildComplexPipelineQuiz', {
  description: 'Quiz: Build complex pipelines from business requirements using groupBy, filtering, and aggregation',
  impl: howTo({
    problem: problem('Challenge users to construct sophisticated pipelines from scratch, integrating multiple DSL concepts'),
    guidance: [],
    testLlmUnderstanding: [
      buildQuiz({
        requirements: `Build a sales analysis pipeline that:
        1. Takes sales data with fields: region, amount, status
        2. Filters for sales > $500
        3. Groups by region
        4. Adds count and sum for each region
        5. Keeps only regions with more than 2 sales
        6. Formats as "Region has X sales worth $Y"
        7. Joins with " | " separator`,
        context: `Const('sales', [
          {region: "North", amount: 600, status: "completed"},
          {region: "South", amount: 300, status: "completed"},
          {region: "North", amount: 800, status: "completed"},
          {region: "East", amount: 700, status: "completed"},
          {region: "North", amount: 400, status: "pending"},
          {region: "East", amount: 900, status: "completed"}
        ])`,
        scrambledSolution: '==QKpcCI8ByJo4WavpGIscCJggGdy92dgMXZsF2cgAychhGInACLpciMg4DIngiclRHbpZGIskSKnQnb19WbhdCKtV3cuAXdvJ3ZgwSKoQnb192YuAXdvJ3ZoMHcvJHUwV3bydEajlmcuVGIskyJu9WanVmcngCdvZXaQlnQ0lGbwNHIskyJwATNg4DIngiclRHbpZGIscyJoUmbpxWZwlGc',
        scrambledHint: '=4WavpGIk5WYgQXYtJ3bmBSesxWYulmZgwycwV3bydGIyVGdslmZg4WZoRHIsMnbvlGdhdWZyd2ZhBCa0l2dgg2YpJnblBiblhGdgwCc19mcnBiblhGdgwSej5WZpNWamZWZgI3bmBCdzJXamBiclRHbpZGI6IXZi1WZtVmU'
      }),
      buildQuiz({
        requirements: `Build an employee analysis pipeline:
        1. Filter for active employees only (%active% == true)
        2. Group by department  
        3. Calculate count and maximum salary per department
        4. Sort departments by max salary (highest first)
        5. Take top 3 departments only
        6. Format as "Department: X people, max salary $Y"`,
        context: `Const('employees', [
          {department: "Engineering", salary: 120000, active: true},
          {department: "Sales", salary: 80000, active: true},
          {department: "Engineering", salary: 95000, active: false},
          {department: "Marketing", salary: 70000, active: true},
          {department: "Engineering", salary: 110000, active: true},
          {department: "Sales", salary: 85000, active: true}
        ])`,
        scrambledSolution: '==QKnQCI5JXYsF2cggXYtBCLlxGcvVGcgAiOnACLpMDK0NncpZGIskCKlNnclZXZyBCLpcSeyFGbhNFeh12JoQncvNHIskSKnknchxWYzdCK4FWbuAXdvJ3ZgwSKoQnb192YuAXdvJ3ZoMHcvJHUwV3bydEajlmcuVGIskyJ05WZtRnchBXZkdCK09mdpBVeCRXasB3cgwSKnUWdyRHI90DIngiclRHbpZGIscyJoUmbpxWZwlGc',
        scrambledHint: '=MHdsV3clJHIn5Wa0lWbpxGIk5WYgwyckxWZpZGIkVGdhxWdjxWYjBSeiByZulGdy92cgwycu9Wa0FmclB3bgknQwV3bydGI6QXdvJWYgsmbphGV'
      }),
      buildQuiz({
        requirements: `Create an advanced order analysis pipeline:
        1. Filter for completed orders from 2024 onwards using and() logic
        2. Group by month
        3. Calculate count, total revenue, and customer list per month
        4. Keep only months with revenue > $10,000
        5. Sort by revenue (highest first)
        6. Return the grouped data objects (no string formatting)`,
        context: `Const('orders', [
          {month: "Jan", status: "completed", date: "2024-01-15", total: 5000, customer: "A"},
          {month: "Jan", status: "completed", date: "2024-01-20", total: 8000, customer: "B"},
          {month: "Feb", status: "completed", date: "2024-02-10", total: 12000, customer: "C"},
          {month: "Jan", status: "pending", date: "2024-01-25", total: 3000, customer: "D"}
        ])`,
        scrambledSolution: '==QKpgSZzJXZ2VmcgwSKn0WdzdCK0J3bzBCLpcCMwADMxAiPgcCKyVGdslmZgwSKpcycyVWbvR3c1N2JgwyJyVWbvR3c1N2Jo4WavpmLwV3bydGIskyJsFGdvR3Jo0Wdz5Cc19mcnBCLpgCduV3bj5Cc19mcnhycw9mcQBXdvJ3RoNWay5WZgwSKngGdu9WbngCdvZXaQlnQ0lGbwNHIskSKnISMw0SMw0CNyAjMiAiPgcCIsciIkVGdlxGct92YiASP9AyJoQmbhhiclRHbpZGIscyJoUmbpxWZwlGc',
        scrambledHint: '==wZulWbh5GI5RnclB3byBHIy9mZgIXZ0VWbhJXYwByJzF2Jg4WYgMHZlVmbgkCKul2bq5Cc19mcnBiclJWbl1WZyBCLz52bpRXak52bjBSZsBXa0xWdtBicvZGIpgCZuFGIlNXV'
      }),
      buildQuiz({
        requirements: `Build a product category analysis pipeline:
        1. Filter products under $100
        2. Group by category
        3. Get count and list of product names per category (use proper group.join syntax)
        4. Keep categories with 3+ products
        5. Sort by count (ascending order)
        6. Format as "Category: product1,product2,product3"`,
        context: `Const('products', [
          {category: "Electronics", price: 50, name: "Mouse"},
          {category: "Books", price: 20, name: "Novel"},
          {category: "Electronics", price: 80, name: "Keyboard"},
          {category: "Electronics", price: 120, name: "Monitor"},
          {category: "Books", price: 15, name: "Guide"},
          {category: "Books", price: 25, name: "Manual"},
          {category: "Clothing", price: 30, name: "Shirt"}
        ])`,
        scrambledSolution: '==QKnAiOnACLpcCduV3bjdCK0J3bzBCLpcyMg0jPgcCKyVGdslmZgwSKpcycl1WYOR3Y1R2byB3JgwyJl1WYudCKul2bq5Cc19mcnBCLpgCduV3bj5Cc19mcnhycw9mcQBXdvJ3RoNWay5WZgwSKnkncvdWZ0F2YngCdvZXaQlnQ0lGbwNHIskyJwATMgwDIngiclRHbpZGIscyJoUmbpxWZwlGc'
      }),
      buildQuiz({
        requirements: `Performance optimization challenge - Build the MOST EFFICIENT pipeline:
        1. Large dataset of 10,000+ sales records
        2. Only interested in "electronics" category  
        3. Group by sales representative
        4. Calculate count and total amount for each rep
        5. Keep reps with 10+ sales
        6. Sort by total revenue (highest first)
        
        CRITICAL: Optimize for performance with large datasets`,
        context: 'Large dataset with fields: category, rep, amount, date',
        scrambledSolution: '=kSKoU2cyVmdlJHIskyJtV3cngCdy92cgwSKnATMg0jPgcCKyVGdslmZgwSKpcCduV3btF2Jo0Wdz5Cc19mcnBCLpgCduV3bj5Cc19mcnhycw9mcQBXdvJ3RoNWay5WZgwSKnAXZydCK09mdpBVeCRXasB3cgwSKnIycjlmbvJHdjVGblJCI90DIngiclRHbpZGIscyJoUmbpxWZwlGc',
        scrambledHint: 'hRXYkByczVGbgM3clN2byBHIvRHIn5WawV3bydGIFJ1TGVkQgkncvdWZ0F2YgI3bmBiclRHbpZGIzlXY3xWQgESesJXYlBiclRHbpZEI6QHanl2culGI5V2S'
      }),
      explainConceptQuiz({
        prompt: 'What are the key principles for building efficient groupBy pipelines? Explain the optimal operation sequence and why order matters.',
        scrambledKeyPoints: '==QKl1WYudCK09mdpBVeCRXasB3cgknctlmY1R2bsBSZuFGI09mdtl2JpcCZhVWZyJGI5RnclRHIhRXYkBSemlmclZHI09mdpBVe0VGdhRWZyBCL5F2cuVGcn5WZ0BHI09WZ252bm5WSgE2Yy9GcgUmcvBHI6cmbpJWZ05WZgk3YuhWa05WZgI3YlJGI5NmblhGdgEGdhRGI',
        scrambledScoringCriteria: 'Filter early for performance, proper sequence (filter→group→enrich→filter→sort), understanding of data flow, performance considerations for large datasets'
      }),
      explainConceptQuiz({
        prompt: 'Explain the difference between filtering before vs after groupBy operations. When should you use each approach?',
        scrambledKeyPoints: '=4WavpGIk5WYgUGchRGI5ZWayVmdgUGdpd2bsBSZyFGdz9GI0NXZ0BCLu9Wa0FGdhJXZgUGdpN3bw12YgE2Yy9GcgUmcvBHI6cmcl5WZpR3YsBiclRHbpZGI6UGdld2bkBCdhhGdgUGbllmZgM3clN2byBHI0V2ZgcXZuVmdvdHIhRXYkBSeul2Y1RWZyBi',
        scrambledScoringCriteria: 'Understanding of performance implications, correct use cases for each approach, data volume considerations, logical vs performance filtering'
      })
    ]
  })
})

Booklet('commonDslQuizzes', {
  impl: booklet('learningMethodologyQuiz,snippetDebuggingQuiz,dslLandscapeQuiz,pipelineFundamentalsQuiz,filteringOperationsQuiz,aggregationOperationsQuiz,advancedGroupByQuiz,buildComplexPipelineQuiz')
})

Booklet('commonDslBooklet', {
  impl: booklet('countUnder30,complexFilter,formatAndJoin,nestedPipeline,variableUsage')
})
