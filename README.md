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

This package is intentionally small and currently optimized for state whose
meaningful changes happen through proxied property writes, deletes, and supported
array operations:

- Plain objects, arrays, and primitives are the fully reactive path.
- `Map`, `Set`, `Date`, class instances, sockets, DOM nodes, promises, and other
  complex values may be stored in state, but they are treated as opaque
  references. Internal mutations like `map.set(...)`, `date.setFullYear(...)`,
  or `socket.close()` are not observed by the model.
- If subscribers need to react to changes inside an opaque value, replace the
  reference or update a separate version/status key on the model.
- Do not mutate snapshots returned by `model.state()` or subscriber callbacks.
  TypeScript marks them as readonly, but there is no runtime freezing.
- Common array access patterns are proxied inside actions, including direct
  indexing, `for...of`, `at()`, `slice()`, `concat()`, `values()`, `entries()`,
  `keys()`, mutating methods like `push()`/`splice()`, and callback methods like
  `find()`/`filter()`/`map()`/`forEach()`. Some less-common array APIs may
  still return raw object references rather than proxied values.

## Roadmap

Possible future hardening, without expanding the core too quickly:

- Continue broadening array method coverage where it improves correctness.
- Add more tests around subscription ordering, selectors, deletes, and remaining
  edge-case array behavior.
- Consider optional integrations such as React hooks, devtools, or action
  logging as separate layers.

## Notes

Composition layers, React hooks, devtools, and hot-reload adapters can be built
on top of this primitive later.
