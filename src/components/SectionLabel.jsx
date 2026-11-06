// Rótulo de sección en mayúsculas: el encabezado que ordena las pantallas de
// lista y de detalle (Ajustes, Lecturas, Planes, Progreso, Oración, grupo...).
// Un solo tamaño (13 px), siempre un <h2> para que el lector de pantalla lo anuncie
// como sección. El margen superior lo pone cada pantalla con `className` ("mt-7");
// el inferior es mb-2 salvo que se pase otro (mb-*).
//
//   action   botón o enlace a la derecha del rótulo ("Cambiar", "+")
//   inside   el rótulo va dentro de una tarjeta: sin sangría lateral
//   accent   color de acento (HOY del grupo); por defecto, text-ink-soft
//   as       otra etiqueta si el h2 no corresponde (p. ej. 'label' dentro de un formulario)
export default function SectionLabel({
  children,
  action = null,
  inside = false,
  accent = false,
  as: Tag = 'h2',
  className = '',
  ...props
}) {
  const tone = accent ? 'text-accent-ink' : 'text-ink-soft'
  const margin = /(^|\s)mb-/.test(className) ? '' : 'mb-2'
  const label = (
    <Tag
      className={`text-[13px] font-semibold uppercase tracking-wide ${tone} ${action ? '' : `${inside ? '' : 'px-1'} ${margin} ${className}`}`}
      {...props}
    >
      {children}
    </Tag>
  )
  if (!action) return label
  return (
    <div className={`flex items-center justify-between gap-3 ${inside ? '' : 'px-1'} ${margin} ${className}`}>
      {label}
      {action}
    </div>
  )
}
