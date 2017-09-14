# ts-transform-css-modules

[![npm version](https://badge.fury.io/js/ts-transform-css-modules.svg)](https://badge.fury.io/js/ts-transform-css-modules)
[![travis](https://travis-ci.org/longlho/ts-transform-css-modules.svg?branch=master)](https://travis-ci.org/longlho/ts-transform-css-modules)

Extract css class names from required css module files for TypeScript. This plugin is based on [css-modules-require-hook](https://github.com/css-modules/css-modules-require-hook) and so constructor opts are from that repo.

This allows you to do this in TS files:

```ts
// Import works
import * as css from 'foo.css'
// require also works
const foo = require('foo.css')

console.log(css.foo)
```

Append this to `before` in your compilation step. See [compile.ts](https://github.com/longlho/ts-transform-css-modules-transform/blob/master/compile.ts#L30-L32) for more info.

Right now named imports will not work due to TS mangling import name after compilation.

```ts
// Those are NOT working
import css from 'foo.css'
import { button, badge } from 'foo.css'
```

## Options

See [css-modules-require-hook](https://github.com/css-modules/css-modules-require-hook#tuning-options) for a list of options.
