import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createModel } from '../src/index.js'

const tick = () => new Promise(resolve => queueMicrotask(resolve))

test('unsubscribe prevents future notifications', async () => {
  const model = createModel({ count: 0 }, state => ({
    inc() { state.count++ },
  }))

  let calls = 0
  const unsubscribe = model.subscribe(() => { calls++ })

  model.actions().inc()
  await tick()
  unsubscribe()
  model.actions().inc()
  await tick()

  assert.equal(calls, 1)
})

test('batched notification receives state before first synchronous commit', async () => {
  const model = createModel({ count: 0 }, state => ({
    inc() { state.count++ },
  }))

  const seen: Array<[number, number]> = []
  model.subscribe((state, previous) => {
    seen.push([previous.count, state.count])
  })

  model.actions().inc()
  model.actions().inc()
  model.actions().inc()
  await tick()

  assert.deepEqual(seen, [[0, 3]])
})

test('select can fire immediately and use custom equality', async () => {
  const model = createModel({ user: { name: 'Ada', age: 30 } }, state => ({
    rename(name: string) { state.user.name = name },
    birthday() { state.user.age++ },
  }))

  const values: Array<{ name: string; age: number }> = []
  model.select(
    state => state.user,
    value => values.push({ name: value.name, age: value.age }),
    {
      fireImmediately: true,
      equality: (a, b) => a.name === b.name,
    }
  )

  model.actions().birthday()
  await tick()
  model.actions().rename('Grace')
  await tick()

  assert.deepEqual(values, [
    { name: 'Ada', age: 30 },
    { name: 'Grace', age: 31 },
  ])
})

test('assigned external objects are cloned before entering state', async () => {
  const external = { nested: { value: 1 } }
  const model = createModel({ item: null as null | typeof external }, state => ({
    set() { state.item = external },
  }))

  model.actions().set()
  await tick()
  external.nested.value = 2

  assert.deepEqual(model.state().item, { nested: { value: 1 } })
})
