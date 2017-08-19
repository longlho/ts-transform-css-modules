import * as foo from './foo.css'
const bar = require('./bar.css')
import './foo.css'

export default function getCss () {
    return {
        ...foo,
        ...bar,
        ...require('./baz.css')
    }
}