import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createModel } from '../src/index.js'

const tick = () => new Promise(resolve => queueMicrotask(resolve))

test('array at returns proxied items', async () => {
  const model = createModel({ items: [{ done: false }, { done: false }] }, state => ({
    markLastDone() {
      const item = state.items.at(-1)
      if (item) item.done = true
    },
  }))

  model.actions().markLastDone()
  await tick()

  assert.deepEqual(model.state().items.map(item => item.done), [false, true])
})

test('array slice returns proxied items for original positions', async () => {
  const model = createModel({ items: [{ done: false }, { done: false }, { done: false }] }, state => ({
    markMiddleDone() {
      const sliced = state.items.slice(1, 2)
      sliced[0]!.done = true
    },
  }))

  model.actions().markMiddleDone()
  await tick()

  assert.deepEqual(model.state().items.map(item => item.done), [false, true, false])
})

test('array values iterator yields proxied items', async () => {
  const model = createModel({ items: [{ value: 1 }, { value: 2 }] }, state => ({
    incAll() {
      for (const item of state.items.values()) {
        item.value++
      }
    },
  }))

  model.actions().incAll()
  await tick()

  assert.deepEqual(model.state().items.map(item => item.value), [2, 3])
})

test('array entries iterator yields proxied items', async () => {
  const model = createModel({ items: [{ value: 1 }, { value: 2 }] }, state => ({
    incSecond() {
      for (const [index, item] of state.items.entries()) {
        if (index === 1) item.value++
      }
    },
  }))

  model.actions().incSecond()
  await tick()

  assert.deepEqual(model.state().items.map(item => item.value), [1, 3])
})

test('array keys iterator yields indexes', () => {
  const model = createModel({ items: ['a', 'b'] }, state => ({
    keys() { return [...state.items.keys()] },
  }))

  assert.deepEqual(model.actions().keys(), [0, 1])
})

test('array concat returns proxied receiver items', async () => {
  const model = createModel({ items: [{ done: false }] }, state => ({
    markDone() {
      const items = state.items.concat()
      items[0]!.done = true
    },
  }))

  model.actions().markDone()
  await tick()

  assert.deepEqual(model.state().items.map(item => item.done), [true])
})

test('array concat returns proxied items from other model arrays', async () => {
  const model = createModel({
    open: [{ done: false }],
    closed: [{ done: false }],
  }, state => ({
    markBothDone() {
      const items = state.open.concat(state.closed)
      items[0]!.done = true
      items[1]!.done = true
    },
  }))

  model.actions().markBothDone()
  await tick()

  assert.deepEqual(model.state().open.map(item => item.done), [true])
  assert.deepEqual(model.state().closed.map(item => item.done), [true])
})
