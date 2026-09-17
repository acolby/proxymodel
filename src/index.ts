import type { CreateActions, EqualityFn, Model, ReadonlyDeep, Subscriber } from './types.js'
import { deleteAtPath, getAtPath, hasAtPath, pathKey, setAtPath, type Path } from './path.js'

export type { CreateActions, EqualityFn, Model, ReadonlyDeep, SelectOptions, Subscriber } from './types.js'

const defaultEquality: EqualityFn<unknown> = Object.is

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

function cloneInitial<T>(value: T): T {
  return cloneForWrite(value) as T
}

function cloneForWrite(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Fall through for non-cloneable values. Models should generally keep
      // serializable data in state and non-serializable values outside state.
    }
  }
  if (Array.isArray(value)) return value.map(cloneForWrite)
  return { ...(value as Record<PropertyKey, unknown>) }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function isArrayIndex(key: string | symbol): key is string {
  if (typeof key !== 'string') return false
  if (key.trim() === '') return false
  const n = Number(key)
  return Number.isInteger(n) && n >= 0 && String(n) === key
}

/**
 * Create a live reactive model.
 *
 * Actions receive a proxied state object. Mutating that proxy creates immutable
 * structural updates under the hood, then notifies subscribers in a microtask.
 */
export function createModel<State extends object, Actions extends object>(
  initialState: State,
  createActions: CreateActions<State, Actions>
): Model<State, Actions> {
  let root = cloneInitial(initialState)
  const subscribers = new Set<Subscriber<State>>()
  const proxyCache = new Map<string, any>()
  const proxyPaths = new WeakMap<object, Path>()

  let scheduled = false
  let previousForNotification: State | undefined

  function notify(previous: State) {
    if (!scheduled) previousForNotification = previous
    scheduled = true
    queueMicrotask(() => {
      if (!scheduled) return
      scheduled = false
      const prev = previousForNotification as State
      previousForNotification = undefined
      if (Object.is(prev, root)) return
      for (const subscriber of Array.from(subscribers)) {
        subscriber(root as ReadonlyDeep<State>, prev as ReadonlyDeep<State>)
      }
    })
  }

  function commit(nextRoot: State) {
    if (Object.is(nextRoot, root)) return
    const previous = root
    root = nextRoot
    notify(previous)
  }

  function unwrap(value: unknown): unknown {
    if (isObject(value)) {
      const proxyPath = proxyPaths.get(value)
      if (proxyPath) return getAtPath(root, proxyPath)
    }
    return cloneForWrite(value)
  }

  function proxyFor(path: Path): any {
    const key = pathKey(path)
    const cached = proxyCache.get(key)
    if (cached) return cached

    const handler: ProxyHandler<any> = {
      get(_target, prop) {
        if (prop === 'toJSON') return () => getAtPath(root, path)
        if (prop === Symbol.toPrimitive) return undefined
        if (prop === 'then' || prop === '$$typeof' || prop === '__proto__') return undefined

        const current = getAtPath(root, path) as any

        if (Array.isArray(current)) {
          return getArrayProperty(path, current, prop)
        }

        if (typeof prop === 'symbol') return undefined

        const value = current?.[prop]
        if (!isObject(value)) return value
        return proxyFor([...path, prop])
      },

      set(_target, prop, value) {
        if (typeof prop === 'symbol') return true
        const fullPath = [...path, prop]
        const nextRoot = setAtPath(root, fullPath, unwrap(value)) as State
        commit(nextRoot)
        return true
      },

      deleteProperty(_target, prop) {
        if (typeof prop === 'symbol') return true
        const nextRoot = deleteAtPath(root, [...path, prop]) as State
        commit(nextRoot)
        return true
      },

      has(_target, prop) {
        return hasAtPath(root, [...path, prop])
      },

      ownKeys() {
        const value = getAtPath(root, path)
        if (value == null) return []
        return Reflect.ownKeys(value as object)
      },

      getOwnPropertyDescriptor(_target, prop) {
        const value = getAtPath(root, path) as any
        if (value == null || !Object.prototype.hasOwnProperty.call(value, prop)) return undefined
        return {
          configurable: true,
          enumerable: Array.isArray(value) && prop === 'length' ? false : true,
          value: value[prop],
          writable: true,
        }
      },
    }

    const proxy = new Proxy({}, handler)
    proxyCache.set(key, proxy)
    proxyPaths.set(proxy, path)
    return proxy
  }

  function getArrayProperty(path: Path, array: any[], prop: string | symbol): unknown {
    if (prop === Symbol.iterator) {
      return function* iterator() {
        for (let i = 0; i < array.length; i++) {
          const value = array[i]
          yield isObject(value) ? proxyFor([...path, i]) : value
        }
      }
    }

    if (typeof prop === 'symbol') return undefined

    if (prop === 'length') return array.length

    if (isArrayIndex(prop)) {
      const index = Number(prop)
      const value = array[index]
      return isObject(value) ? proxyFor([...path, index]) : value
    }

    if (mutatingArrayMethods.has(prop)) {
      return (...args: unknown[]) => {
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
        const current = getAtPath(root, path) as any[]
        const arrayProxy = proxyFor(path)
        const itemProxy = (item: unknown, index: number) =>
          isObject(item) ? proxyFor([...path, index]) : item
        const wrapped = (item: unknown, index: number) =>
          callback.call(secondArg, itemProxy(item, index), index, arrayProxy)

        if (prop === 'find') {
          const index = current.findIndex((item, i) => wrapped(item, i))
          return index === -1 ? undefined : itemProxy(current[index], index)
        }

        if (prop === 'findLast') {
          for (let i = current.length - 1; i >= 0; i--) {
            if (wrapped(current[i], i)) return itemProxy(current[i], i)
          }
          return undefined
        }

        if (prop === 'filter') {
          const result: unknown[] = []
          current.forEach((item, i) => {
            if (wrapped(item, i)) result.push(itemProxy(item, i))
          })
          return result
        }

        if (prop === 'reduce' || prop === 'reduceRight') {
          const method = prop as 'reduce' | 'reduceRight'
          const reducer = (accumulator: unknown, item: unknown, index: number) =>
            callback(accumulator, itemProxy(item, index), index, arrayProxy)
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

  const stateProxy = proxyFor([]) as State
  const actions = createActions(stateProxy)

  const model: Model<State, Actions> = {
    state: () => root as ReadonlyDeep<State>,

    actions: () => actions,

    subscribe(subscriber) {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },

    select(selector, subscriber, options) {
      const equality = options?.equality ?? defaultEquality as EqualityFn<any>
      let selected = selector(root as ReadonlyDeep<State>)

      if (options?.fireImmediately) {
        subscriber(selected, selected)
      }

      return model.subscribe((nextState) => {
        const nextSelected = selector(nextState)
        if (equality(selected, nextSelected)) return
        const previousSelected = selected
        selected = nextSelected
        subscriber(nextSelected, previousSelected)
      })
    },
  }

  return model
}
