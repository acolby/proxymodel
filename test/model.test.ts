import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createModel } from '../src/index.js'

const tick = () => new Promise(resolve => queueMicrotask(resolve))

test('actions mutate state immutably and notify once per microtask', async () => {
  const model = createModel({ nested: { count: 0 }, other: { ok: true } }, state => ({
    inc() { state.nested.count++ },
    incTwice() { state.nested.count++; state.nested.count++ },
  }))

  const before = model.state()
  let calls = 0
  let seen: any
  model.subscribe(state => { calls++; seen = state })

  model.actions().incTwice()
  await tick()

  assert.equal(calls, 1)
  assert.equal(seen.nested.count, 2)
  assert.notEqual(model.state(), before)
  assert.notEqual(model.state().nested, before.nested)
  assert.equal(model.state().other, before.other)
})

test('selector subscribers fire only when selected value changes', async () => {
  const model = createModel({ count: 0, name: 'a' }, state => ({
    inc() { state.count++ },
    rename(name: string) { state.name = name },
  }))

  const values: number[] = []
  model.select(s => s.count, value => values.push(value))

  model.actions().rename('b')
  await tick()
  model.actions().inc()
  await tick()

  assert.deepEqual(values, [1])
})

test('array iteration yields proxies so callback mutation is tracked', async () => {
  const model = createModel({ items: [{ id: 'a', done: false }] }, state => ({
    toggle() {
      state.items.forEach(item => { item.done = !item.done })
    },
  }))

  let calls = 0
  model.subscribe(() => { calls++ })

  model.actions().toggle()
  await tick()

  assert.equal(model.state().items[0]?.done, true)
  assert.equal(calls, 1)
})

test('array mutating methods update immutably', async () => {
  const model = createModel({ items: [] as string[] }, state => ({
    add(item: string) { return state.items.push(item) },
  }))

  const before = model.state().items
  const len = model.actions().add('x')
  await tick()

  assert.equal(len, 1)
  assert.deepEqual(model.state().items, ['x'])
  assert.notEqual(model.state().items, before)
})

test('delete removes object keys', async () => {
  const model = createModel({ record: { a: 1, b: 2 } }, state => ({
    removeA() { delete state.record.a },
  }))

  model.actions().removeA()
  await tick()

  assert.deepEqual(model.state().record, { b: 2 })
})
