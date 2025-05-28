# jb6 – TGP DSL Framework

jBart is a JavaScript implementation of the TGP methodology for building DSLs (Domain Specific Languages).

TGP stands for:

- **Type**: abstraction  
- **Template** (or **Component**)  
- **Profile**: structured script code (serializable to JSON)  

TGP promotes a declarative syntax. It limits the language surface to ensure homogeneity and enable a powerful IDE experience for script development.


## Installation

Install the VS Code extension:

[artwaresoft.jb6-tgp-lang](https://marketplace.cursorapi.com/items?itemName=artwaresoft.jb6-tgp-lang)

## Test Sample

```js
import {} from "@jb6/testing"
import {} from "@jb6/common"
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
