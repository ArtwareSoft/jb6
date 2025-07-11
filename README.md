# jb6 – TGP DSL Framework

jBart is a JavaScript implementation of the TGP methodology for building DSLs (Domain Specific Languages).

TGP stands for:

- **Type**: abstraction  
- **Generic Components** (or **Templates**)  
- **Profile**: structured script code (serializable to JSON)  

TGP promotes a declarative syntax. It limits the language surface to ensure homogeneity and enable a powerful IDE experience for script development.


## Installation

Install the VS Code extension:

[artwaresoft.jb6-tgp-lang](https://marketplace.cursorapi.com/items?itemName=artwaresoft.jb6-tgp-lang)

## Test Sample

```js
import "@jb6/testing"
import "@jb6/common"
import { dsls } from "@jb6/core"

const {
  tgp: {
    Const, TgpType,
    var: { Var }
  },
  common: {
    Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay },
    Boolean: { contains, equals },
    Prop: { prop }
  },
  test: {
    Test,
    test: { dataTest }
  }
} = dsls

Test('myTests.HelloWorld', {
  impl: dataTest(pipeline('hello world'), contains('world'))
})

##Profile Template (PT) example

Test('dataTest', {
  params: [
    {id: 'calculate', type:'data', dynamic: true},
    {id: 'expectedResult', type: 'boolean', dynamic: true},
    {id: 'runBefore', type: 'action', dynamic: true},
    {id: 'timeout', as: 'number', defaultValue: 200},
    {id: 'allowError', as: 'boolean', dynamic: true, type: 'boolean'},
    {id: 'cleanUp', type: 'action', dynamic: true},
    {id: 'expectedCounters', as: 'single'},
    {id: 'spy', as: 'string'},
    {id: 'includeTestRes', as: 'boolean', type: 'boolean'},
  ],
  impl: (ctx,{ calculate,expectedResult,runBefore,timeout,allowError,cleanUp,expectedCounters,spy: _spy,includeTestRes }) => {
    //...
  }
})