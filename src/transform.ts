import * as ts from "typescript";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";

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

function resolveCssPath(
  cssPath: string,
  sf: ts.SourceFile,
  tsImportResolver: Opts["tsImportResolver"]
): string {
  // Bc cssPath includes ' or "
  cssPath = cssPath.substring(1, cssPath.length - 1);

  let resolvedPath: string;
  if (typeof tsImportResolver === "function") {
    resolvedPath = tsImportResolver(cssPath);
  }
  if (typeof resolvedPath !== "string") {
    if (cssPath.startsWith(".")) {
      const sourcePath = sf.fileName;
      return resolve(dirname(sourcePath), cssPath);
    }
    return cssPath;
  }

  return resolvedPath;
}

function generateClassNameObj(
  resolvedCssPath: string
): ts.ObjectLiteralExpression {
  const css = require(resolvedCssPath);
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
  resolvedCssPath: string,
  node: ts.ImportDeclaration
): ts.Node {
  let classNameObj;
  try {
    classNameObj = generateClassNameObj(resolvedCssPath);
  } catch (e) {
    console.error(e);
    return;
  }

  // No import clause, skip
  if (!node.importClause) {
    return;
  }

  // This is the "foo" from "import * as foo from 'foo.css'"
  const { namedBindings } = node.importClause;
  // Dealing with "import * as css from 'foo.css'" only since namedImports variables get mangled
  if (!ts.isNamespaceImport(namedBindings)) {
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
    let newNode: ts.Node;
    let cssPath: string;
    if (ts.isImportDeclaration(node)) {
      if (CSS_EXTENSION_REGEX.test(node.moduleSpecifier.getText())) {
        cssPath = resolveCssPath(
          node.moduleSpecifier.getText(),
          sf,
          tsImportResolver
        );
        newNode = importVisitor(cssPath, node);
      }
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.getText() === "require" &&
        CSS_EXTENSION_REGEX.test(node.arguments[0].getText())
      ) {
        cssPath = resolveCssPath(
          node.arguments[0].getText(),
          sf,
          tsImportResolver
        );
        try {
          newNode = generateClassNameObj(cssPath);
        } catch (e) {
          console.error(e);
        }
      }
    }

    if (newNode) {
      const externalCssSource = ts.createSourceMapSource(
        cssPath,
        readFileSync(cssPath, "utf-8")
      );
      ts.setSourceMapRange(newNode, {
        source: externalCssSource,
        pos: node.pos,
        end: node.end
      });

      return newNode;
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
