import * as foo from './foo.css'
const bar = require('./bar.css')

export default function getCss () {
    return {
        ...foo,
        ...bar,
        ...require('./baz.css')
    }
}