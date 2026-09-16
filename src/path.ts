export type Path = Array<string | number | symbol>

export function getAtPath(root: unknown, path: Path): unknown {
  let current = root as any
  for (const key of path) {
    if (current == null) return undefined
    current = current[key]
  }
  return current
}

export function hasAtPath(root: unknown, path: Path): boolean {
  if (path.length === 0) return true
  const parent = getAtPath(root, path.slice(0, -1)) as any
  if (parent == null) return false
  return Object.prototype.hasOwnProperty.call(parent, path[path.length - 1]!)
}

export function setAtPath(root: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) return value

  const head = path[0]!
  const tail = path.slice(1)
  const source = root as any
  const currentChild = source?.[head]
  const nextChild = setAtPath(currentChild, tail, value)

  if (Object.is(currentChild, nextChild)) return root

  if (Array.isArray(source)) {
    const clone = source.slice()
    clone[head as number] = nextChild
    return clone
  }

  return { ...(source ?? {}), [head]: nextChild }
}

export function deleteAtPath(root: unknown, path: Path): unknown {
  if (path.length === 0) return root
  if (!hasAtPath(root, path)) return root

  if (path.length === 1) {
    const key = path[0]!
    if (Array.isArray(root)) {
      const clone = root.slice()
      clone.splice(Number(key), 1)
      return clone
    }

    const clone = { ...(root as any) }
    delete clone[key]
    return clone
  }

  const head = path[0]!
  const tail = path.slice(1)
  const source = root as any
  const currentChild = source?.[head]
  const nextChild = deleteAtPath(currentChild, tail)

  if (Object.is(currentChild, nextChild)) return root

  if (Array.isArray(source)) {
    const clone = source.slice()
    clone[head as number] = nextChild
    return clone
  }

  return { ...(source ?? {}), [head]: nextChild }
}

export function pathKey(path: Path): string {
  return JSON.stringify(path.map(part => typeof part === 'symbol' ? part.toString() : part))
}
