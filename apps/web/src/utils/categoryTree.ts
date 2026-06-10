export interface CategoryTreeNode<T extends { id: string; parentId?: string; parent_id?: string; sort?: number; name?: string }> {
  data: T
  children: Array<CategoryTreeNode<T>>
}

function getParentId<T extends { parentId?: string; parent_id?: string }>(item: T) {
  return item.parentId ?? item.parent_id ?? '0'
}

export function buildCategoryTree<T extends { id: string; parentId?: string; parent_id?: string; sort?: number }>(
  items: T[],
  parentId = '0',
): Array<CategoryTreeNode<T>> {
  return items
    .filter((item) => getParentId(item) === parentId)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((item) => ({
      data: item,
      children: buildCategoryTree(items, item.id),
    }))
}

export function flattenCategoryTree<T extends { id: string; parentId?: string; parent_id?: string; sort?: number }>(
  nodes: Array<CategoryTreeNode<T>>,
  depth = 0,
): Array<{ node: CategoryTreeNode<T>; depth: number }> {
  const result: Array<{ node: CategoryTreeNode<T>; depth: number }> = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.children.length) {
      result.push(...flattenCategoryTree(node.children, depth + 1))
    }
  }
  return result
}
