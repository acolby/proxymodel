# proxy-model

Model-first state with proxy mutations and efficient subscriptions.

```ts
import { createModel } from 'proxy-model'

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

`proxy-model` gives you one small primitive: a live model that owns its state,
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
  state(): State
  actions(): Actions
  subscribe(cb: (state: State, previous: State) => void): () => void
  select<T>(
    selector: (state: State) => T,
    cb: (value: T, previous: T) => void,
    options?: { equality?: (a: T, b: T) => boolean; fireImmediately?: boolean }
  ): () => void
}
```

## Notes

This package is intentionally small. Composition layers, React hooks, devtools,
and warm-reload adapters can be built on top of this primitive later.

State is expected to be plain serializable data. Keep non-serializable runtime
resources outside model state.
