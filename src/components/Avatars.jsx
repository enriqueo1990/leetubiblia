// Pila de avatares con iniciales (intercesores de un pedido, miembros de grupo…).
// Muestra hasta 4 burbujas; si hay más, las primeras 3 + "+N". El borde se funde
// con la superficie donde se monta (prop `surface`).
export function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

export default function Avatars({ people = [], count, size = 30, surface = 'var(--surface)' }) {
  const total = count ?? people.length
  if (total <= 0) return null
  const shown = people.slice(0, total > 4 ? 3 : 4)
  const extra = total - shown.length

  const bubble = (key, content, first) => (
    <div
      key={key}
      className="flex items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.37),
        backgroundColor: 'var(--surface-alt)',
        color: 'var(--text-soft)',
        border: `2px solid ${surface}`,
        marginLeft: first ? 0 : -9,
      }}
    >
      {content}
    </div>
  )

  return (
    <div className="flex items-center">
      {shown.map((p, i) => bubble(p.user_id ?? i, initials(p.display_name), i === 0))}
      {extra > 0 && bubble('extra', `+${extra}`, false)}
    </div>
  )
}
