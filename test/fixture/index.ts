import * as foo from './foo.css'
import * as bar from './bar.css'

export default function getCss () {
    return {
        ...foo,
        ...bar
    }
}