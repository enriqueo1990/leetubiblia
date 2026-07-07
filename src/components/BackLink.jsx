import { Link, useLocation } from 'react-router-dom'

// Miga de vuelta canónica — el ÚNICO estilo de "atrás" en la app: chevrón
// tipográfico + nombre de la pantalla destino, en acento entintado de 15px.
// En PWA standalone no hay atrás del navegador: esta miga es el único
// paracaídas, así que tiene que ser honesta. Si la pantalla de origen pasó
// `state.from` ({ to, label }), la miga vuelve ahí (refleja el camino real);
// si no, cae al padre canónico que declara cada pantalla vía props.
export default function BackLink({ to, label }) {
  const { state } = useLocation()
  const from = state?.from
  return (
    <Link
      to={from?.to ?? to}
      className="inline-block py-1 text-[15px] font-medium"
      style={{ color: 'var(--accent-ink)' }}
    >
      ‹ {from?.label ?? label}
    </Link>
  )
}
