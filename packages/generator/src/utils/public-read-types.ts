import ts from "typescript";
import type { DependencyResolver } from "./dependency-resolver";

/** Backend execution context is not part of the published HTTP contract. */
export function isCoreReadExecutor(
  node: ts.TypeReferenceNode | ts.ImportTypeNode,
  checker: ts.TypeChecker,
  resolver: DependencyResolver,
): boolean {
  const name = ts.isTypeReferenceNode(node) ? node.typeName : node.qualifier;
  if (!name) return false;
  let symbol = checker.getSymbolAtLocation(name);
  if (!symbol) return false;
  while (symbol.flags & ts.SymbolFlags.Alias) {
    const next = checker.getAliasedSymbol(symbol);
    if (next === symbol) return false;
    symbol = next;
  }
  return (
    symbol.name === "ReadExecutor" &&
    !!symbol.declarations?.some(
      (declaration) =>
        resolver.resolvePackageName(declaration.getSourceFile().fileName) ===
        "@n/adira.core.ts",
    )
  );
}

export function publicTypeArguments(
  node: ts.TypeReferenceNode | ts.ImportTypeNode,
  checker: ts.TypeChecker,
  resolver: DependencyResolver,
): readonly ts.TypeNode[] | undefined {
  return isCoreReadExecutor(node, checker, resolver)
    ? node.typeArguments?.slice(0, 1)
    : node.typeArguments;
}
