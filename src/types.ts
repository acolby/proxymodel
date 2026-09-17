export type ReadonlyDeep<T> = T extends (...args: any[]) => any
  ? T
  : T extends readonly (infer Item)[]
    ? readonly ReadonlyDeep<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: ReadonlyDeep<T[Key]> }
      : T

export type Subscriber<T> = (state: ReadonlyDeep<T>, previous: ReadonlyDeep<T>) => void

export type EqualityFn<T> = (a: T, b: T) => boolean

export type SelectOptions<T> = {
  equality?: EqualityFn<T>
  fireImmediately?: boolean
}

export type Model<State extends object, Actions extends object> = {
  /** The current immutable state snapshot. */
  state(): ReadonlyDeep<State>

  /** The action object created for this model. */
  actions(): Actions

  /** Subscribe to every committed state change. */
  subscribe(subscriber: Subscriber<State>): () => void

  /** Subscribe to a selected value. Fires only when the selected value changes. */
  select<Selected>(
    selector: (state: ReadonlyDeep<State>) => Selected,
    subscriber: (value: Selected, previous: Selected) => void,
    options?: SelectOptions<Selected>
  ): () => void
}

export type CreateActions<State extends object, Actions extends object> = (state: State) => Actions
