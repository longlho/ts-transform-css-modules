import * as ts from "typescript";
import { resolve, dirname } from "path";

export type GenerateScopedNameFn = (
  name: string,
  filepath: string,
  css: string
) => string;

/**
 * Primarily from https://github.com/css-modules/css-modules-require-hook
 *
 * @export
 * @interface Opts
 */
export interface Opts {
  devMode?: boolean;
  extensions?: string[];
  ignore?: string | Function | RegExp;
  preprocessCss?(css: string, filePath: string): string;
  processCss?(css: string, filePath: string): string;
  processorOpts?: object;
  camelCase?: boolean | "dashes" | "only" | "dashesOnly";
  append?: any[];
  prepend?: any[];
  use?: any[];
  createImportedName?: Function;
  generateScopedName?: string | GenerateScopedNameFn;
  hashPrefix?: string;
  mode?: string;
  rootDir?: string;
  resolve?: {
    alias?: { [path: string]: string };
    extensions?: string[];
    modules?: string[];
    mainFile?: string;
    preserveSymlinks?: boolean;
  };
  /**
   * Custom resolver for css import declaration. This is primarily used
   * for project that uses absolute import.
   * When https://github.com/Microsoft/TypeScript/issues/28276 is fixed this
   * might not be necessary.
   *
   * @param {string} path path to be resolved
   * @returns {string} resolved path. Returning invalid string will fall back to our default resolver.
   * @memberof Opts
   */
  tsImportResolver?(path: string): string;
}

const CSS_EXTENSION_REGEX = /\.css['"]$/;

function generateClassNameObj(
  sf: ts.SourceFile,
  cssPath: string,
  tsImportResolver: Opts["tsImportResolver"]
): ts.ObjectLiteralExpression {
  // Bc cssPath includes ' or "
  cssPath = cssPath.substring(1, cssPath.length - 1);

  let resolvedPath: string;
  let css: any;
  if (typeof tsImportResolver === "function") {
    resolvedPath = tsImportResolver(cssPath);
  }
  if (typeof resolvedPath !== "string") {
    if (cssPath.startsWith(".")) {
      const sourcePath = sf.fileName;
      resolvedPath = resolve(dirname(sourcePath), cssPath);
    } else {
      resolvedPath = cssPath;
    }
  }

  css = require(resolvedPath);
  return ts.createObjectLiteral(
    ts.createNodeArray(
      Object.keys(css).map(k =>
        ts.createPropertyAssignment(
          ts.createLiteral(k),
          ts.createLiteral(css[k])
        )
      )
    )
  );
}

function importVisitor(
  sf: ts.SourceFile,
  node: ts.Node,
  tsImportResolver: Opts["tsImportResolver"]
): ts.Node {
  let cssPath: string = (node as ts.ImportDeclaration).moduleSpecifier.getText();
  let classNameObj;
  try {
    classNameObj = generateClassNameObj(sf, cssPath, tsImportResolver);
  } catch (e) {
    console.error(e);
    return;
  }

  // No import clause, skip
  if (!(node as ts.ImportDeclaration).importClause) {
    return;
  }

  // This is the "foo" from "import * as foo from 'foo.css'"
  const { namedBindings } = (node as ts.ImportDeclaration).importClause;
  // Dealing with "import * as css from 'foo.css'" only since namedImports variables get mangled
  if (namedBindings.kind !== ts.SyntaxKind.NamespaceImport) {
    return;
  }

  const importVar = namedBindings.name.getText();

  // Create 'var css = {}'
  return ts.createVariableStatement(
    undefined,
    ts.createVariableDeclarationList([
      ts.createVariableDeclaration(importVar, undefined, classNameObj)
    ])
  );
}

function visitor(
  ctx: ts.TransformationContext,
  sf: ts.SourceFile,
  tsImportResolver: Opts["tsImportResolver"]
) {
  const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
        if (
          CSS_EXTENSION_REGEX.test(
            (node as ts.ImportDeclaration).moduleSpecifier.getText()
          )
        ) {
          return (
            importVisitor(sf, node, tsImportResolver) ||
            ts.visitEachChild(node, visitor, ctx)
          );
        }
        break;
      case ts.SyntaxKind.CallExpression:
        if (
          (node as ts.CallExpression).expression.getText() === "require" &&
          CSS_EXTENSION_REGEX.test(
            (node as ts.CallExpression).arguments[0].getText()
          )
        ) {
          try {
            return generateClassNameObj(
              sf,
              (node as ts.CallExpression).arguments[0].getText(),
              tsImportResolver
            );
          } catch (e) {
            console.error(e);
          }
        }
    }
    return ts.visitEachChild(node, visitor, ctx);
  };

  return visitor;
}

export default function(opts: Opts = {}) {
  const { tsImportResolver, ...hookOpts } = opts;
  require("css-modules-require-hook")(hookOpts);
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) =>
      ts.visitNode(sf, visitor(ctx, sf, tsImportResolver));
  };
}
