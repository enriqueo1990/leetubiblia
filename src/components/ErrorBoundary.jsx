import { Component } from 'react'
import { recordDiag } from '../lib/diag.js'

// Red de seguridad de último recurso. Sin un ErrorBoundary, cualquier error
// lanzado en render desmonta TODO el árbol de React 18 y deja la pantalla en
// blanco hasta que el usuario recarga a mano (síntoma reportado al volver a la
// pestaña). Aquí lo atrapamos y ofrecemos recargar, sin perder la app.
//
// El fallback usa estilos inline (no Tailwind) con var(--token, hex): si los
// tokens CSS cargaron, respeta modo claro/oscuro y acento; si el fallo es del
// propio sistema de estilos, cae a los hex de marca (claro).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] render falló:', error, info)
    try {
      recordDiag('render_error', {
        message: String(error?.message || error).slice(0, 200),
      })
    } catch {
      /* no-op */
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '0 32px',
          textAlign: 'center',
          background: 'var(--bg-app, #F8F7F4)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: 16, color: 'var(--text-soft, #56565C)', maxWidth: 280, lineHeight: 1.5 }}>
          Algo se interrumpió. Volvé a intentarlo.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            border: 'none',
            borderRadius: 14,
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--on-accent, #FFFFFF)',
            background: 'var(--accent, #A88B6A)',
            cursor: 'pointer',
          }}
        >
          Recargar
        </button>
      </div>
    )
  }
}
