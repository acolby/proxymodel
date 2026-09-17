# proxymodel

Model-first state with proxy mutations and efficient subscriptions.

```ts
import { createModel } from '@acolby/proxymodel'

const counter = createModel(
  { count: 0 },
  state => ({
    increment() {
      state.count++
    },
    reset() {
      state.count = 0
    },
  })
)

counter.actions().increment()

counter.subscribe((state, previous) => {
  console.log(previous.count, '->', state.count)
})

counter.select(
  state => state.count,
  count => console.log('count changed:', count)
)
```

## Why

`proxymodel` gives you one small primitive: a live model that owns its state,
actions, and subscriptions.

- Define state and actions together.
- Write actions with normal JavaScript mutation syntax.
- Under the hood, writes produce immutable structural updates.
- Subscribe to the full model or to selected values.
- No React, Redux, or global store required.

## API

### `createModel(initialState, createActions)`

```ts
const todos = createModel(
  { items: [] as { id: string; text: string; done: boolean }[] },
  state => ({
    add(text: string) {
      state.items.push({ id: crypto.randomUUID(), text, done: false })
    },
    toggle(id: string) {
      const item = state.items.find(item => item.id === id)
      if (item) item.done = !item.done
    },
  })
)
```

Returns:

```ts
type Model<State, Actions> = {
  state(): ReadonlyDeep<State>
  actions(): Actions
  subscribe(cb: (state: ReadonlyDeep<State>, previous: ReadonlyDeep<State>) => void): () => void
  select<T>(
    selector: (state: ReadonlyDeep<State>) => T,
    cb: (value: T, previous: T) => void,
    options?: { equality?: (a: T, b: T) => boolean; fireImmediately?: boolean }
  ): () => void
}
```

`createActions` receives a proxied, mutable view of the state. Snapshots returned
from `state()`, `subscribe()`, and `select()` are typed as deeply readonly and
should be treated as immutable.

## Limitations

This package is intentionally small and currently optimized for plain application
state:

- State should be plain serializable objects, arrays, and primitives.
- Keep runtime resources, functions, DOM nodes, promises, sockets, etc. outside
  model state.
- `Map`, `Set`, `Date`, class instances, and other non-plain objects are not
  currently exposed as reactive mutable structures.
- Do not mutate snapshots returned by `model.state()` or subscriber callbacks.
  TypeScript marks them as readonly, but there is no runtime freezing.
- Some less-common array APIs may return raw object references rather than
  proxied values. Prefer direct indexing, iteration, and supported callback
  methods inside actions for now.

## Roadmap

Possible future hardening, without expanding the core too quickly:

- Broaden array method coverage where it improves correctness.
- Add more tests around subscription ordering, selectors, deletes, and edge-case
  array behavior.
- Consider optional integrations such as React hooks, devtools, or action
  logging as separate layers.

## Notes

Composition layers, React hooks, devtools, and hot-reload adapters can be built
on top of this primitive later.
