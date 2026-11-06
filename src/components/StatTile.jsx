// Cifra grande + rótulo. Único origen de las cifras de la app (Progreso, Tu
// recorrido, el cierre de un plan, el resumen privado del grupo).
//   por defecto → tarjeta (.card) con la cifra alineada a la izquierda.
//   bare        → sin tarjeta, para ir dentro de otra (resumen del grupo, cierre de plan).
//   center      → centrada (solo el cierre de plan, que va en una grilla con divisores).
//   accent      → cifra en --accent-ink; si no, en tinta.
export default function StatTile({ value, label, accent = false, bare = false, center = false, className = '' }) {
  return (
    <div className={`${bare ? '' : 'card p-4'} flex-1 ${center ? 'text-center' : ''} ${className}`}>
      <p className={`stat-num text-[30px] font-bold ${accent ? 'text-accent-ink' : 'text-ink'}`}>{value}</p>
      <p className="mt-0.5 text-[13px] leading-tight text-ink-soft">{label}</p>
    </div>
  )
}
