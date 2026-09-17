import { getAtPath, setAtPath, type Path } from './path.js'

type ArrayProxyContext<State extends object> = {
  path: Path
  array: any[]
  prop: string | symbol
  getRoot(): State
  proxyFor(path: Path): any
  commit(nextRoot: State): void
  unwrap(value: unknown): unknown
}

const mutatingArrayMethods = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'copyWithin',
  'fill',
])

const callbackArrayMethods = new Set([
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flatMap',
  'forEach',
  'map',
  'reduce',
  'reduceRight',
  'some',
])

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function isArrayIndex(key: string | symbol): key is string {
  if (typeof key !== 'string') return false
  if (key.trim() === '') return false
  const n = Number(key)
  return Number.isInteger(n) && n >= 0 && String(n) === key
}

function toIntegerOrZero(value: number): number {
  const integer = Math.trunc(Number(value))
  return Number.isNaN(integer) ? 0 : integer
}

function normalizeIndex(index: number, length: number): number {
  return index < 0 ? length + index : index
}

export function getArrayProperty<State extends object>({
  path,
  array,
  prop,
  getRoot,
  proxyFor,
  commit,
  unwrap,
}: ArrayProxyContext<State>): unknown {
  const itemProxy = (item: unknown, index: number) =>
    isObject(item) ? proxyFor([...path, index]) : item

  if (prop === Symbol.iterator || prop === 'values') {
    return function* values() {
      for (let i = 0; i < array.length; i++) {
        yield itemProxy(array[i], i)
      }
    }
  }

  if (typeof prop === 'symbol') return undefined

  if (prop === 'length') return array.length

  if (isArrayIndex(prop)) {
    const index = Number(prop)
    return itemProxy(array[index], index)
  }

  if (prop === 'keys') {
    return function* keys() {
      for (let i = 0; i < array.length; i++) yield i
    }
  }

  if (prop === 'entries') {
    return function* entries() {
      for (let i = 0; i < array.length; i++) {
        yield [i, itemProxy(array[i], i)] as [number, unknown]
      }
    }
  }

  if (prop === 'at') {
    return (index: number) => {
      const normalized = normalizeIndex(toIntegerOrZero(index), array.length)
      if (normalized < 0 || normalized >= array.length) return undefined
      return itemProxy(array[normalized], normalized)
    }
  }

  if (prop === 'slice') {
    return (start?: number, end?: number) => {
      const length = array.length
      const from = start === undefined ? 0 : normalizeIndex(toIntegerOrZero(start), length)
      const to = end === undefined ? length : normalizeIndex(toIntegerOrZero(end), length)
      const first = Math.min(Math.max(from, 0), length)
      const last = Math.min(Math.max(to, 0), length)
      const result: unknown[] = []
      for (let i = first; i < last; i++) {
        result.push(itemProxy(array[i], i))
      }
      return result
    }
  }

  if (mutatingArrayMethods.has(prop)) {
    return (...args: unknown[]) => {
      const root = getRoot()
      const current = getAtPath(root, path) as any[]
      const draft = current.slice()
      const result = (draft as any)[prop](...args.map(unwrap))
      commit(setAtPath(root, path, draft) as State)
      return prop === 'sort' || prop === 'reverse' || prop === 'copyWithin' || prop === 'fill'
        ? proxyFor(path)
        : result
    }
  }

  if (callbackArrayMethods.has(prop)) {
    return (callback: Function, secondArg?: unknown) => {
      const current = getAtPath(getRoot(), path) as any[]
      const arrayProxy = proxyFor(path)
      const proxiedItem = (item: unknown, index: number) =>
        isObject(item) ? proxyFor([...path, index]) : item
      const wrapped = (item: unknown, index: number) =>
        callback.call(secondArg, proxiedItem(item, index), index, arrayProxy)

      if (prop === 'find') {
        const index = current.findIndex((item, i) => wrapped(item, i))
        return index === -1 ? undefined : proxiedItem(current[index], index)
      }

      if (prop === 'findLast') {
        for (let i = current.length - 1; i >= 0; i--) {
          if (wrapped(current[i], i)) return proxiedItem(current[i], i)
        }
        return undefined
      }

      if (prop === 'filter') {
        const result: unknown[] = []
        current.forEach((item, i) => {
          if (wrapped(item, i)) result.push(proxiedItem(item, i))
        })
        return result
      }

      if (prop === 'reduce' || prop === 'reduceRight') {
        const method = prop as 'reduce' | 'reduceRight'
        const reducer = (accumulator: unknown, item: unknown, index: number) =>
          callback(accumulator, proxiedItem(item, index), index, arrayProxy)
        return secondArg === undefined
          ? (current as any)[method](reducer)
          : (current as any)[method](reducer, secondArg)
      }

      return (current as any)[prop](wrapped)
    }
  }

  const value = (array as any)[prop]
  return typeof value === 'function' ? value.bind(array) : value
}
