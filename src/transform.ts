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
    preprocessCss? (css: string, filePath: string): string
    processCss? (css: string, filePath: string): string
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

function generateClassNameObj (sf: ts.SourceFile, cssPath: string): ts.ObjectLiteralExpression {
    // Bc cssPath includes ' or "
    cssPath = cssPath.substring(1, cssPath.length - 1)

    if (cssPath.startsWith('.')) {
        const sourcePath = sf.fileName
        cssPath = resolve(dirname(sourcePath), cssPath)
    }

    const css = require(cssPath)
    const classNameObj = ts.createNode(ts.SyntaxKind.ObjectLiteralExpression) as ts.ObjectLiteralExpression
    classNameObj.properties = Object.keys(css).map(k => {
        const obj = ts.createNode(ts.SyntaxKind.PropertyAssignment) as ts.PropertyAssignment
        const key = ts.createNode(ts.SyntaxKind.Identifier) as ts.Identifier
        const value = ts.createNode(ts.SyntaxKind.StringLiteral) as ts.StringLiteral
        key.text = k
        value.text = css[k]
        obj.name = key
        obj.initializer = value
        return obj
    }) as ts.NodeArray<ts.ObjectLiteralElementLike>

    return classNameObj
}

function importVisitor (sf: ts.SourceFile, node: ts.Node): ts.Node {
    let cssPath: string = (node as ts.ImportDeclaration).moduleSpecifier.getText()
    const classNameObj = generateClassNameObj(sf, cssPath)

    // This is the "foo" from "import * as foo from 'foo.css'"
    const importVar = ((node as ts.ImportDeclaration).importClause.namedBindings as ts.NamespaceImport).name.getText()

    const cssVarStatement = ts.createNode(ts.SyntaxKind.VariableStatement) as ts.VariableStatement

    cssVarStatement.declarationList = ts.createNode(ts.SyntaxKind.VariableDeclarationList) as ts.VariableDeclarationList
    const varDecl = ts.createNode(ts.SyntaxKind.VariableDeclaration) as ts.VariableDeclaration
    varDecl.name = ts.createNode(ts.SyntaxKind.Identifier) as ts.Identifier
    varDecl.name.text = importVar
    varDecl.initializer = classNameObj
    cssVarStatement.declarationList.declarations = [varDecl] as ts.NodeArray<ts.VariableDeclaration>
    return cssVarStatement
}

function visitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
    const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
        switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
            if (CSS_EXTENSION_REGEX.test((node as ts.ImportDeclaration).moduleSpecifier.getText())) {
                return importVisitor(sf, node)
            }
            break
        case ts.SyntaxKind.CallExpression:
            if (
                (node as ts.CallExpression).expression.getText() === 'require' &&
                CSS_EXTENSION_REGEX.test((node as ts.CallExpression).arguments[0].getText())
            ) {
                return generateClassNameObj(sf, (node as ts.CallExpression).arguments[0].getText())
            }
            break
        }
        return ts.visitEachChild(node, visitor, ctx)
    }

    return visitor
}

export default function (opts: Opts) {
    require('css-modules-require-hook')(opts)
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, sf))
    }
}