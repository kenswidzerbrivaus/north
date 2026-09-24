import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { err: Error | null }

export class PageError extends Component<Props, State> {
  state: State = { err: null }

  static getDerivedStateFromError(err: Error) {
    return { err }
  }

  render() {
    if (this.state.err) {
      return (
        <div className="empty">
          <p className="kicker">Couldn’t open</p>
          <h3>This screen hit an error</h3>
          <p className="muted">{this.state.err.message || 'Reload and try again.'}</p>
          <button className="btn" type="button" onClick={() => this.setState({ err: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
