import * as ts from 'typescript'
import { resolve, dirname } from 'path'

export type GenerateScopedNameFn = (name: string, filepath: string, css: string) => string

/**
 * Primarily from https://github.com/css-modules/css-modules-require-hook
 *
 * @export
 * @interface Opts
 */
export interface Opts {
    devMode?: boolean
    extensions?: string[]
    ignore?: string | Function | RegExp
    preprocessCss?(css: string, filePath: string): string
    processCss?(css: string, filePath: string): string
    processorOpts?: object
    camelCase?: boolean | 'dashes' | 'only' | 'dashesOnly'
    append?: any[]
    prepend?: any[]
    use?: any[]
    createImportedName?: Function
    generateScopedName?: string | GenerateScopedNameFn
    hashPrefix?: string
    mode?: string
    rootDir?: string
}

const CSS_EXTENSION_REGEX = /\.css['"]$/

function generateClassNameObj(sf: ts.SourceFile, cssPath: string): ts.ObjectLiteralExpression {
    // Bc cssPath includes ' or "
    cssPath = cssPath.substring(1, cssPath.length - 1)

    if (cssPath.startsWith('.')) {
        const sourcePath = sf.fileName
        cssPath = resolve(dirname(sourcePath), cssPath)
    }

    const css = require(cssPath)
    return ts.createObjectLiteral(
        ts.createNodeArray(
            Object.keys(css).map(k => ts.createPropertyAssignment(ts.createLiteral(k), ts.createLiteral(css[k])))
        )
    )
}

function importVisitor(sf: ts.SourceFile, node: ts.Node): ts.Node {
    let cssPath: string = (node as ts.ImportDeclaration).moduleSpecifier.getText()
    let classNameObj
    try {
        classNameObj = generateClassNameObj(sf, cssPath)
    } catch (e) {
        console.error(e)
        return
    }

    // No import clause, skip
    if (!(node as ts.ImportDeclaration).importClause) {
        return
    }

    // This is the "foo" from "import * as foo from 'foo.css'"
    const { namedBindings } = (node as ts.ImportDeclaration).importClause
    // Dealing with "import * as css from 'foo.css'" only since namedImports variables get mangled
    if (namedBindings.kind !== ts.SyntaxKind.NamespaceImport) {
        return
    }

    const importVar = namedBindings.name.getText()

    // Create 'var css = {}'
    return ts.createVariableStatement(
        undefined,
        ts.createVariableDeclarationList([ts.createVariableDeclaration(importVar, undefined, classNameObj)])
    )
}

function visitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
    const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
                if (CSS_EXTENSION_REGEX.test((node as ts.ImportDeclaration).moduleSpecifier.getText())) {
                    return importVisitor(sf, node) || ts.visitEachChild(node, visitor, ctx)
                }
                break
            case ts.SyntaxKind.CallExpression:
                if (
                    (node as ts.CallExpression).expression.getText() === 'require' &&
                    CSS_EXTENSION_REGEX.test((node as ts.CallExpression).arguments[0].getText())
                ) {
                    try {
                        return generateClassNameObj(sf, (node as ts.CallExpression).arguments[0].getText())
                    } catch (e) {
                        console.error(e)
                    }
                }
        }
        return ts.visitEachChild(node, visitor, ctx)
    }

    return visitor
}

export default function(opts: Opts) {
    require('css-modules-require-hook')(opts)
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, sf))
    }
}
