import path from "path";
import { ApiDefinition, HandlerApiDefinition } from "src/handler/generate";
import { SymbolCollector } from "src/imports/collector";
import ts from "typescript";
import { DependencyResolver } from "./dependency-resolver";

type ImportBucket = {
  defaultImport?: string;      // e.g. "React" from "import React from 'react'"
  namespaceImport?: string;    // e.g. "fs" from "import * as fs from 'fs'"
  namedImports: Set<string>;   // e.g. "useState", "useEffect as useE"
};


/**
 * Generates valid TypeScript import statements for the provided symbols
 * relative to a target file path (e.g., src/index.d.ts).
 */

export function generateImports(
  collector: SymbolCollector,
  program: ts.Program,
  dependencyResolver: DependencyResolver,
  apiDefiniton: ApiDefinition,
  targetFilePath: string
): string {
  const checker = program.getTypeChecker();

  const endpoints: HandlerApiDefinition[] = Object.values(apiDefiniton).flatMap(
    (v) => Object.values(v)
  );
  // 1. Flatten and Deduplicate Symbols
  const uniqueSymbols = new Set<ts.Symbol>();

  for (const endpoint of endpoints) {
    for (const node of Object.values(endpoint)) {
      const nodeSymbols = collector.collectRootReferences(node);
      nodeSymbols.forEach((s) => uniqueSymbols.add(s));
    }
  }

  const importsMap = new Map<string, ImportBucket>();
  const targetDir = path.dirname(targetFilePath);

  for (const localSymbol of uniqueSymbols) {
    // A. Resolve the "Deep" Symbol to find the Origin File
    let originSymbol = localSymbol;
    while (originSymbol.flags & ts.SymbolFlags.Alias) {
      originSymbol = checker.getAliasedSymbol(originSymbol);
    }

    // B. Find Origin Declaration to get SourceFile
    const decl = originSymbol.declarations?.[0];
    if (!decl) continue;

    const sourceFile = decl.getSourceFile();
    if (program.isSourceFileDefaultLibrary(sourceFile)) {
       continue;
    }
    if (path.resolve(sourceFile.fileName) === path.resolve(targetFilePath)) continue;

    // C. Calculate Module Path
    let moduleSpecifier: string = "";
    if (program.isSourceFileFromExternalLibrary(sourceFile)) {
      moduleSpecifier = dependencyResolver.resolvePackageName(sourceFile.fileName) || "";
    } else {
      let relativePath = path.relative(targetDir, sourceFile.fileName);
      if (!relativePath.startsWith(".")) relativePath = "./" + relativePath;
      moduleSpecifier = relativePath.replace(/(\.d\.ts|\.ts)$/, "").split(path.sep).join("/");
    }

    const localDecl = localSymbol.getDeclarations()?.[0];
    if (!localDecl) continue;

    if (!importsMap.has(moduleSpecifier)) {
      importsMap.set(moduleSpecifier, { namedImports: new Set() });
    }
    const bucket = importsMap.get(moduleSpecifier)!;

    // 2. CLASSIFY THE IMPORT TYPE
    // CASE A: Namespace Import (import * as Lib)
    if (localDecl && ts.isNamespaceImport(localDecl)) {
      bucket.namespaceImport = localSymbol.name;
    }

    // CASE B: Default Import (import React)
    // The declaration of a default import symbol is the ImportClause node
    else if (localDecl && ts.isImportClause(localDecl)) {
      bucket.defaultImport = localSymbol.name;
    }

    // CASE C: Named Import (import { Backend })
    // Includes ImportSpecifier, or if the symbol is not an import (e.g. ClassDeclaration)
    else {
       // STRATEGY: Look at the AST Node to see if it was aliased.
       // This works perfectly for "Backend as BBackend" because the AST holds both names.
       
       if (localDecl && ts.isImportSpecifier(localDecl)) {
          if (localDecl.propertyName) {
             // It has an alias: import { Real as Local }
             bucket.namedImports.add(`${localDecl.propertyName.text} as ${localDecl.name.text}`);
          } else {
             // No alias: import { Real }
             bucket.namedImports.add(localDecl.name.text);
          }
       } 
       // Fallback: If it's not an import specifier (e.g. it was a local variable we are exporting)
       // We use the simple name.
       else {
          bucket.namedImports.add(localSymbol.name);
       }
    }
  }


  // 3. Create AST Nodes for Imports
  const factory = ts.factory;
  const nodes: ts.Node[] = [];

  // Sort modules for deterministic output
  const sortedModules = Array.from(importsMap.keys()).sort();

  for (const modulePath of sortedModules) {
    const bucket = importsMap.get(modulePath)!;

    // --- CASE 1: Default Import (import X from '...') ---
    if (bucket.defaultImport) {
      nodes.push(factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          factory.createIdentifier(bucket.defaultImport), // Name of default import
          undefined // No named bindings here
        ),
        factory.createStringLiteral(modulePath),
        undefined
      ));
    }

    // --- CASE 2: Namespace Import (import * as X from '...') ---
    if (bucket.namespaceImport) {
      nodes.push(factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamespaceImport(factory.createIdentifier(bucket.namespaceImport))
        ),
        factory.createStringLiteral(modulePath),
        undefined
      ));
    }

    // --- CASE 3: Named Imports (import { A, B as C } from '...') ---
    if (bucket.namedImports.size > 0) {
      const sortedNames = Array.from(bucket.namedImports).sort();

      const specifiers = sortedNames.map((rawName) => {
        // Handle "Real as Alias" logic we stored earlier
        const parts = rawName.split(" as ");
        const realName = parts[0];
        const aliasName = parts[1]; // undefined if no alias

        return factory.createImportSpecifier(
          false,
          // propertyName (left side): Only needed if we are aliasing
          aliasName ? factory.createIdentifier(realName) : undefined,
          // name (right side): The local name we use in code
          factory.createIdentifier(aliasName || realName)
        );
      });

      nodes.push(factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined, // No default import here
          factory.createNamedImports(specifiers)
        ),
        factory.createStringLiteral(modulePath),
        undefined
      ));
    }
  }

  // 4. Print
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const resultFile = ts.createSourceFile(
    "temp.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );

  const result = printer.printList(
    ts.ListFormat.MultiLine,
    factory.createNodeArray(nodes),
    resultFile
  );

  return result;
}
