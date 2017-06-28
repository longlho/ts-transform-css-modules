import compile from '../compile'
import { resolve } from 'path'
import { expect } from 'chai'

describe('ts-transform-css-modules', function () {
    this.timeout(5000)
    it('should be able to compile CSS', function () {
        compile(resolve(__dirname, 'fixture/*.ts'))
        expect(require('./fixture/index.js').default()).to.deep.equal({
            bar: "foo__bar___3dUjP foo__foo___3p56d",
            bar2: "bar__bar2___2PTAu bar__foo2___3ly2x",
            foo: "foo__foo___3p56d",
            foo2: "bar__foo2___3ly2x",
            'foo-asd': "bar__foo-asd___9jX6V",
            goo: "baz__goo___1DlUX"
        })
    })
})
