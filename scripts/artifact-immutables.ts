type Ast = { id?: number; name?: string; mutability?: string; nodes?: Ast[] };
export function immutableNames(asts: Ast[]) {
  const names = new Map<string, string>();
  function visit(node: Ast) {
    if (node.mutability === "immutable" && node.id !== undefined && node.name)
      names.set(String(node.id), node.name);
    for (const child of node.nodes ?? []) visit(child);
  }
  for (const ast of asts) visit(ast);
  return names;
}
export function bindImmutables(
  references: Record<string, unknown>,
  names: Map<string, string>,
) {
  return Object.fromEntries(
    Object.keys(references).map((id) => {
      const name = names.get(id);
      if (name === "CORE" || name === "ACCOUNTANT") return [id, "core"];
      if (name === "POOL_KEY_INDEX") return [id, "poolKeyIndex"];
      if (name === "METADATA_RENDERER") return [id, "metadataRenderer"];
      throw new Error(
        `Unreviewed immutable ${id} (${name ?? "AST unavailable"}). Build with --ast and review its constructor binding.`,
      );
    }),
  );
}
