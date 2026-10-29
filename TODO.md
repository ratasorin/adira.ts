- [ ] The `handler/discover` chokes on function that are present in the current scope (not aliased):

```ts
// Error: Fasle expression: Should only get Alias here
const getHandler = () => {};
router.post("post", getHandler);
```

This seems to orginate from this line: `originalHandleSymbol = checker.getAliasedSybmol(handlerSymbol)` in
