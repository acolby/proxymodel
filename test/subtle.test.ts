import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createModel } from '../src/index.js'

const tick = () => new Promise(resolve => queueMicrotask(resolve))

test('deep nested object mutation preserves unrelated references', async () => {
  const model = createModel({
    a: { b: { c: 1 }, sibling: { keep: true } },
    other: { keep: true },
  }, state => ({
    setC(value: number) { state.a.b.c = value },
  }))

  const before = model.state()
  model.actions().setC(2)
  await tick()
  const after = model.state()

  assert.equal(after.a.b.c, 2)
  assert.notEqual(after, before)
  assert.notEqual(after.a, before.a)
  assert.notEqual(after.a.b, before.a.b)
  assert.equal(after.a.sibling, before.a.sibling)
  assert.equal(after.other, before.other)
})

test('find returns proxied array item that can be mutated', async () => {
  const model = createModel({ items: [{ id: 'a', nested: { done: false } }] }, state => ({
    toggle(id: string) {
      const item = state.items.find(item => item.id === id)
      if (item) item.nested.done = !item.nested.done
    },
  }))

  const before = model.state()
  model.actions().toggle('a')
  await tick()

  assert.equal(model.state().items[0]?.nested.done, true)
  assert.notEqual(model.state().items, before.items)
  assert.notEqual(model.state().items[0], before.items[0])
  assert.notEqual(model.state().items[0]?.nested, before.items[0]?.nested)
})

test('for-of iteration yields proxied nested objects', async () => {
  const model = createModel({ groups: [{ items: [{ value: 1 }] }] }, state => ({
    incAll() {
      for (const group of state.groups) {
        for (const item of group.items) {
          item.value++
        }
      }
    },
  }))

  model.actions().incAll()
  await tick()

  assert.equal(model.state().groups[0]?.items[0]?.value, 2)
})

test('assigning a proxied value stores raw state, not the proxy', async () => {
  const model = createModel({ source: { x: 1 }, target: null as null | { x: number } }, state => ({
    copy() { state.target = state.source },
    mutateSource() { state.source.x = 2 },
  }))

  model.actions().copy()
  await tick()
  const copied = model.state().target

  model.actions().mutateSource()
  await tick()

  assert.deepEqual(copied, { x: 1 })
  assert.deepEqual(model.state().target, { x: 1 })
  assert.deepEqual(model.state().source, { x: 2 })
})

test('same-value writes do not notify', async () => {
  const model = createModel({ value: 1 }, state => ({
    writeSame() { state.value = 1 },
  }))

  let calls = 0
  model.subscribe(() => { calls++ })
  model.actions().writeSame()
  await tick()

  assert.equal(calls, 0)
})

test('nested array splice with object insertion is mutable afterwards', async () => {
  const model = createModel({ groups: [{ items: [{ value: 1 }] }] }, state => ({
    insert() { state.groups[0]!.items.splice(0, 0, { value: 10 }) },
    mutateInserted() { state.groups[0]!.items[0]!.value = 11 },
  }))

  model.actions().insert()
  await tick()
  model.actions().mutateInserted()
  await tick()

  assert.deepEqual(model.state().groups[0]?.items.map(item => item.value), [11, 1])
})

test('delete on array index splices and notifies', async () => {
  const model = createModel({ items: ['a', 'b', 'c'] }, state => ({
    removeMiddle() { delete state.items[1] },
  }))

  model.actions().removeMiddle()
  await tick()

  assert.deepEqual(model.state().items, ['a', 'c'])
})

test('filter returns proxied items that can be mutated', async () => {
  const model = createModel({ items: [{ done: false }, { done: true }] }, state => ({
    markOpenDone() {
      const open = state.items.filter(item => !item.done)
      open[0]!.done = true
    },
  }))

  model.actions().markOpenDone()
  await tick()

  assert.deepEqual(model.state().items.map(item => item.done), [true, true])
})

test('Object.keys, object spread, and array keys work on proxied values', async () => {
  const model = createModel({ object: { a: 1, b: 2 }, items: ['x', 'y'] }, state => ({
    objectKeys() { return Object.keys(state.object) },
    objectSpread() { return { ...state.object } },
    arrayKeys() { return Object.keys(state.items) },
    arraySpread() { return [...state.items] },
  }))

  assert.deepEqual(model.actions().objectKeys(), ['a', 'b'])
  assert.deepEqual(model.actions().objectSpread(), { a: 1, b: 2 })
  assert.deepEqual(model.actions().arrayKeys(), ['0', '1'])
  assert.deepEqual(model.actions().arraySpread(), ['x', 'y'])
})
