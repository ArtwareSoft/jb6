import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/testing'
import '@jb6/llm-guide'

const { 
  tgp: { Const, var: { Var } }, 
  common: { data: { pipeline, filter, count, scrambleText }, Boolean: { and } },
  'llm-guide': { Doclet,
    'llm-guide': { exercise },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood, illegalSyntax }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology },
    problemStatement: {problem}
  },
  mcp: { 
    Tool,
    tool: { tgpModel, runSnippet, runSnippets, getFilesContent, replaceComponent, appendToFile, overrideFileContent, dslDocs, scrambleTextTool }
  }
} = dsls

Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])

Doclet('countUnder30', {
  impl: exercise(
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
  impl: ({},{items}) => items.length
})`,
      explain: 'notice the "items" param that allows using the count as function or operator inside the pipeline with the %% as default value'
    })
  )
})

Doclet('joinNames', {
  impl: exercise(
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
  impl: (ctx, { operators, source } ) => asArray(operators.profile).reduce( (dataArray, profile ,index) => runAsAggregator(ctx, operators, index,dataArray,profile), source())
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
  impl: exercise(
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
  impl: exercise(
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
        impl: (ctx, {filter}) => toArray(ctx.data).filter(item => filter(ctx.setData(item)))
      })`,
      explain: 'filter is aggregator operator the filters array of items'
    })
  )
})
  
Doclet('formatAndJoin', {
  impl: exercise(
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
  impl: exercise(
    problem({
      statement: 'Get names of children for each parent, formatted as "Child is child of Parent"',
      intro: `This exercise demonstrates how to use nested pipelines to process hierarchical data.
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
  impl: exercise(
    problem({
      statement: 'Demonstrate variable definition and usage',
      intro: `This exercise illustrates how to define and use variables within a pipeline.
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

Doclet('learnCommonDsl', {
  description: 'Master common DSL through structured learning with validation checkpoints',
  impl: exercise(
    problem({
      statement: 'Learn common DSL systematically through hands-on practice and self-validation',
      intro: 'The common DSL is the foundation of data processing in TGP. This structured learning path builds competency through progressive steps with quiz validation at each checkpoint.'
    }),
    proceduralSolution('Progressive Common DSL Mastery', {
      usefulPoints: [
        explanation('HOW TO USE THIS LEARNING SYSTEM WITH TURN BATCHING:'),
        methodology('BATCH PREPARATION PHASE:'),
        methodology('1. Read ALL steps and validation quizzes FIRST - get complete overview'),
        methodology('2. Prepare prediction document: Write down ALL quiz predictions at once'),
        methodology('3. Group MCP tools by logical batches (e.g., steps 1-3, steps 4-6, steps 7+)'),
        methodology('4. Plan verification sequence: Know which tools to run in which order'),
        methodology('BATCH EXECUTION PHASE:'),
        methodology('5. Execute entire MCP tool batch in single turn (runSnippets for multiple tests)'),
        methodology('6. Compare ALL batch results with predictions simultaneously'),
        methodology('7. Document insights and gaps for entire batch before next turn'),
        methodology('8. Use scrambleText batch for all quiz answers in one operation'),
        methodology('BATCH OPTIMIZATION STRATEGIES:'),
        methodology('9. Use runSnippets() instead of individual runSnippet() calls'),
        methodology('10. Combine related validation quizzes into single prediction session'),
        methodology('11. Group probe debugging: test multiple scenarios in one batch'),
        methodology('12. Prepare comprehensive setupCode once for multiple tests'),
        performance('Batching maximizes learning per turn while maintaining predict-then-verify methodology'),
        performance('Single turn can validate multiple concepts simultaneously')
      ],
      steps: [
        step({
          action: 'Master runSnippet and probe debugging - your primary learning tools',
          purpose: 'These are the instruments you use to learn everything else - master them first',
          details: 'Read the comprehensive guide on snippet execution and probe debugging methodology',
          validation: [
            multipleChoiceQuiz({
              question: 'How do you properly place a probe inside a variable expression?',
              options: [`'%$people%__'`,`'%$people/__%'`,`'%$people%,__'`,`probe('%$people%')`],
              scrambledAnswer: '=cyJ'
            }),
            predictResultQuiz({
              scenario: `Which shows data AFTER filtering: pipeline('%$people%', filter('%age% < 30'), __) or pipeline('%$people%', __, filter('%age% < 30'))?`,
              context: 'Understanding probe cursor position',
              scrambledAnswer: '==AdpBSZy9mZlJGIu9Wa0FmclB3bgUGa0BiclRnZhBSY0FGZgM3dvh2cgUmYvJHcg0CIl52bgQ3cylmR'
            }),
            explainConceptQuiz({
              prompt: 'Describe the 4-step debugging workflow using snippets and probes',
              scrambledKeyPoints: 'u9Wa0V3YlhXZgwWYulmZgwyZulGd0FWby9mZgQ3clRHIsMXZi9mcwBCa0l2dgMnbvlGdhJXZw9GI0NXZ0BCLlNmc192cgEGdhRGI5ZWayVmd',
              scrambledScoringCriteria: '=Q3cylmZg42bpRXYjlmZpJXZ2BSZjJXdvNHIsAXZ0NHIoNWYlBCdhBSZi9mcwBCLn5WakxWa1JGIsFGduVWblJ3YulGIu9Wa05WZtBCdzVXT'
            }),
            predictResultQuiz({
              scenario: `You run pipeline('%$people%', '%fullName%', count()) and get an error. What's your FIRST debugging step?`,
              context: 'Systematic debugging approach',
              scrambledAnswer: '==QZjJXdvNHIhRXYkBSemlmclZHIvRHIncCIuVnU'
            })
          ],
          mcpTool: getFilesContent('packages/core/llm-guide/how-to-use-snippet-and-probe.js', '/home/shaiby/projects/jb6'),
          points: [
            explanation('Snippet and probe are your primary learning instruments - master these before learning DSL'),
            methodology('Always verify data source first, then build incrementally with probes'),
            syntax('probe as cursor (__)', 'place exactly where you want to inspect data flow'),
            performance('Systematic debugging prevents errors and builds understanding'),
            comparison('guessing and checking', {
              advantage: 'methodical approach saves time and builds expertise'
            })
          ]
        }),
        step({
          action: 'Understand the DSL landscape and component organization',
          purpose: 'Get comprehensive context before diving into specific components',
          details: 'Load the complete common DSL documentation including TGP model, component definitions, and usage patterns',
          validation: [
            explainConceptQuiz({
              prompt: 'What is a TGP type and how does it enable safe component composition?',
              scrambledKeyPoints: '=cmbpRXdvJHI05WZu9Gct92YgwibvlGdpN3bw12bjBCTTRULzN3byNGIskHdlZWYzBSZwlHdgwibvlGdhpXauF2Zy9GIulWYt9GZ',
              scrambledScoringCriteria: 'zVGb1JHIu9Wa0l2cvBXbvNGIk5WYgwyc0lmZl5WZiBSe0VmZhNHIs42bpRXYjlmZpN3chx2YgUGc5RHIulWYsBHelBCdzVXT'
            }),
            multipleChoiceQuiz({
              question: 'What are the main TGP types in the common DSL?',
              options: ['data, boolean, action','pipeline, filter, count','source, transform, aggregate','input, process, output'],
              scrambledAnswer: 'u9Wa0NWYgwibhVGbv9mYgwSY0FGZ'
            })
          ],
          mcpTool: dslDocs('common', '/home/shaiby/projects/jb6'),
          points: [
            explanation('Understanding DSL organization prevents confusion when looking for specific components'),
            methodology('Always start with the big picture before diving into details'),
            performance('dslDocs provides complete context - component definitions, tests, and relationships')
          ]
        }),
        step({
          action: 'Master pipeline fundamentals through hands-on practice',
          purpose: 'Pipeline is the core pattern - all other operations build on this foundation',
          details: 'Practice basic pipeline operations: property extraction, simple transformations, and data flow',
          validation: [
            predictResultQuiz({
              scenario: `pipeline([{name: 'Alice', dept: 'Engineering'}, {name: 'Bob', dept: 'Sales'}], '%dept%')`,
              context: 'Array of employee objects with name and dept properties',
              scrambledAnswer: 'ddyclxWYTdCIscyZulmclVmbpdmbFdyW'
            })
          ],
          mcpTool: runSnippet({
            compText: `pipeline('%$people%', '%name%')`,
            setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`,
            filePath: 'packages/common/common-tests.js',
            repoRoot: '/home/shaiby/projects/jb6'
          }),
          points: [
            explanation('Pipeline creates data flow - source flows through operations to produce result'),
            syntax('pipeline(source, operator1, operator2, ...)', 'chains operations left to right'),
            whenToUse('Any time you need to transform or process data'),
            performance('Foundation pattern for all data operations in common DSL')
          ]
        }),
        step({
          action: 'Learn filtering and conditional operations',
          purpose: 'Filtering is essential for data selection and conditional processing',
          details: 'Practice filter operations with expressions and boolean components',
          validation: [
            predictResultQuiz({
              scenario: `pipeline('%$employees%', filter('%salary% > 50000'), count())`,
              context: 'employees = [{name: "A", salary: 60000}, {name: "B", salary: 40000}, {name: "C", salary: 70000}]',
              scrambledAnswer: '==gM'
            }),
            multipleChoiceQuiz({
              question: 'How do you combine multiple filter conditions?',
              options: ['filter("%age% < 30 && %dept% == Sales")','filter(and("%age% < 30", "%dept% == Sales"))','filter("%age% < 30").filter("%dept% == Sales")','Both B and C are correct'],
              scrambledAnswer: '0NWZyJ3bjBSZyFGIDBCZuFGICBCa09mQ'
            })
          ],
          mcpTool: runSnippet({
            compText: `pipeline('%$people%', filter('%age% < 30'), '%name%')`,
            setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`,
            filePath: 'packages/common/common-tests.js',
            repoRoot: '/home/shaiby/projects/jb6'
          }),
          points: [
            explanation('Filter selects items based on conditions - only matching items continue through pipeline'),
            syntax('filter("expression")', 'uses string expressions for conditions'),
            syntax('filter(boolean_component)', 'can use boolean<common> components like and(), or()'),
            methodology('Chain multiple filters OR use boolean components for complex conditions'),
            performance('Filter early in pipelines to reduce data processing in later operations')
          ]
        }),
        step({
          action: 'Master aggregation operations (count, join, groupBy)',
          purpose: 'Aggregations transform collections into summary data - essential for analytics',
          details: 'Practice counting, joining, and basic grouping operations',
          validation: [],
          mcpTool: runSnippet({
            compText: `pipeline('%$people%', filter('%age% < 30'), '%name%', join())`,
            setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`,
            filePath: 'packages/common/common-tests.js',
            repoRoot: '/home/shaiby/projects/jb6'
          }),
          points: [
            explanation('Aggregations reduce collections to single values or transformed structures'),
            syntax('count()', 'returns number of items'),
            syntax('join(separator)', 'concatenates strings with separator (default comma)'),
            syntax('splitByPivot(property)', 'groups items by property values'),
            whenToUse('count for totals, join for display, groupBy for analysis'),
            performance('Aggregations are final operations - they end the data flow')
          ]
        }),
        step({
          action: 'Learn advanced groupBy operations for data analytics',
          purpose: 'GroupBy is the most powerful common DSL feature for analytical data processing',
          details: 'Master splitByPivot and enrichGroupProps for complex data analysis',
          validation: [
            predictResultQuiz({
              scenario: `pipeline('%$orders%', splitByPivot('status'), enrichGroupProps(group.count()))`,
              context: 'orders = [{status: "pending"}, {status: "complete"}, {status: "pending"}]',
              scrambledAnswer: 'd1XMgoDduV3bjBCLiUGdlxGct92YiAiOzVHdhR3c7BCL9JDI6Qnb192YgwiIn5Wak5WZwJCI6MXd0FGdzt3W'
            })
          ],
          mcpTool: runSnippet({
            compText: `pipeline('%$sales%', splitByPivot('region'), enrichGroupProps(group.count(), group.sum('amount')))`,
            setupCode: `Const('sales', [{region: 'North', amount: 100}, {region: 'South', amount: 200}, {region: 'North', amount: 150}])`,
            filePath: 'packages/common/common-tests.js',
            repoRoot: '/home/shaiby/projects/jb6'
          }),
          points: [
            explanation('GroupBy operations enable analytical data processing - the foundation of reporting'),
            syntax('splitByPivot(property)', 'creates groups based on unique values of property'),
            syntax('enrichGroupProps(group.count(), group.sum(prop))', 'adds calculated fields to each group'),
            methodology('Build groupBy in layers: split into groups, then enrich with calculations'),
            performance('Essential for dashboard data, reports, and analytical summaries'),
            comparison('manual JavaScript grouping', { advantage: 'declarative, reusable, more maintainable' })
          ]
        }),
        step({
          action: 'Master debugging with probe (__) for understanding data flow',
          purpose: 'Debugging skills are essential for developing and troubleshooting complex pipelines',
          details: 'Learn to use probe cursor to inspect data at any point in pipeline execution',
          validation: [],
          mcpTool: runSnippet({
            compText: `pipeline('%$people%', filter('%age% < 30'), __, '%name%', join())`,
            setupCode: `Const('people', [{name: 'Homer', age: 42}, {name: 'Bart', age: 12}, {name: 'Lisa', age: 10}])`,
            filePath: 'packages/common/common-tests.js',
            repoRoot: '/home/shaiby/projects/jb6',
            probe: 'true'
          }),
          points: [
            explanation('Probe (__) reveals data at any point - your debugging superpower'),
            syntax('probe: "true"', 'enables probe mode in runSnippet'),
            syntax('__', 'place anywhere in pipeline to inspect data flow'),
            methodology('Use systematically: verify input, test each operation, confirm output'),
            whenToUse('debugging complex pipelines, learning new operations, validating data transformations'),
            performance('Probe shows execution metadata, timing, and component visits')
          ]
        })
      ],
      summaryPoints: [
        explanation('This systematic predict-then-verify methodology prevents passive learning'),
        explanation('Procedural learning builds competency systematically - each step enables the next'),
        evidence('Quiz validation ensures genuine understanding before progressing'),
        methodology('Use scrambleText to check quiz answers without seeing them during learning'),
        performance('This structured approach reduces learning time and increases retention')
      ]
    })
  )
})




