// Estilo único de los campos de texto (input/textarea): un solo borde de 1px en
// --control-border (el de los controles), mismo en todas las pantallas.
// `inputStyle`: campo sobre el fondo de la app o una hoja.
export const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--control-border)',
  color: 'var(--text-primary)',
}
// `inputStyleOnCard`: campo dentro de una tarjeta blanca (Ajustes, avisos): el
// fondo baja a --surface-alt para que se note, con el mismo borde.
export const inputStyleOnCard = {
  ...inputStyle,
  backgroundColor: 'var(--surface-alt)',
}
