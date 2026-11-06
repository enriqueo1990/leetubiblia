import { Link, useLocation } from 'react-router-dom'

// Miga de vuelta canónica — el ÚNICO estilo de "atrás" en la app: chevrón
// tipográfico + nombre de la pantalla destino, en acento entintado de 15px.
// En PWA standalone no hay atrás del navegador: esta miga es el único
// paracaídas, así que tiene que ser honesta. Si la pantalla de origen pasó
// `state.from` ({ to, label }), la miga vuelve ahí (refleja el camino real);
// si no, cae al padre canónico que declara cada pantalla vía props.
// `from.back` es el origen del propio padre: al volver se lo reenvía, así la miga
// de la pantalla padre sigue diciendo por dónde llegaste (Lecturas › Planes › un
// plan › «‹ Planes» deja a Planes diciendo «‹ Lecturas», no «‹ Hoy»).
export default function BackLink({ to, label }) {
  const { state } = useLocation()
  const from = state?.from
  return (
    <Link
      to={from?.to ?? to}
      state={from?.back ? { from: from.back } : undefined}
      className="-ml-2 inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-medium"
      style={{ color: 'var(--accent-ink)' }}
    >
      ‹ {from?.label ?? label}
    </Link>
  )
}
