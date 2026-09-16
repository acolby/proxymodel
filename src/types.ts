export type Subscriber<T> = (state: T, previous: T) => void

export type EqualityFn<T> = (a: T, b: T) => boolean

export type SelectOptions<T> = {
  equality?: EqualityFn<T>
  fireImmediately?: boolean
}

export type Model<State extends object, Actions extends object> = {
  /** The current immutable state snapshot. Treat as readonly. */
  state(): State

  /** The action object created for this model. */
  actions(): Actions

  /** Subscribe to every committed state change. */
  subscribe(subscriber: Subscriber<State>): () => void

  /** Subscribe to a selected value. Fires only when the selected value changes. */
  select<Selected>(
    selector: (state: State) => Selected,
    subscriber: (value: Selected, previous: Selected) => void,
    options?: SelectOptions<Selected>
  ): () => void
}

export type CreateActions<State extends object, Actions extends object> = (state: State) => Actions
