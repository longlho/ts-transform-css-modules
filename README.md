# ts-transform-css-modules-transform
Extract css class names from required css module files for TypeScript. This plugin is based on [css-modules-require-hook](https://github.com/css-modules/css-modules-require-hook) and so constructor opts are from that repo.

This allows you to do this in TS files:

```ts
import * as css from 'foo.css'

console.log(css.foo)
```
