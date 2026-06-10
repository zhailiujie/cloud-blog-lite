export function buildReorderPayload(items: Array<{ id: string }>) {
  return items.map((item, index) => ({ id: item.id, sort: (index + 1) * 10 }))
}
