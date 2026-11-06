// Textos de las notificaciones push en es/en/pt. Cada función lee
// `profiles.locale` de QUIEN RECIBE (null → es) y arma el texto con esto.
export type Locale = 'es' | 'en' | 'pt'

export function pickLocale(v: unknown): Locale {
  return v === 'en' || v === 'pt' ? v : 'es'
}

export const REMINDER: Record<Locale, { title: string; body: string }> = {
  es: { title: 'Tu lectura de hoy te espera 📖', body: 'Tomate un momento para tu pasaje de hoy.' },
  en: { title: "Today's reading is waiting for you 📖", body: "Take a moment for today's passage." },
  pt: { title: 'Sua leitura de hoje está esperando 📖', body: 'Reserve um momento para a passagem de hoje.' },
}

export function groupPrayer(l: Locale, name: string | null, group: string | null) {
  const someone = { es: 'Alguien', en: 'Someone', pt: 'Alguém' }[l]
  const yourGroup = { es: 'tu grupo', en: 'your group', pt: 'seu grupo' }[l]
  const n = name || someone
  const g = group || yourGroup
  return {
    es: { title: 'Nuevo pedido de oración', body: `${n} pidió oración en ${g}.` },
    en: { title: 'New prayer request', body: `${n} asked for prayer in ${g}.` },
    pt: { title: 'Novo pedido de oração', body: `${n} pediu oração em ${g}.` },
  }[l]
}

export function intercession(l: Locale, n: number) {
  const one = n <= 1
  return {
    es: {
      title: 'Están orando por vos 🙏',
      body: one ? 'Alguien empezó a orar por tu pedido.' : `Ya son ${n} personas orando por tu pedido.`,
    },
    en: {
      title: 'People are praying for you 🙏',
      body: one ? 'Someone started praying for your request.' : `${n} people are now praying for your request.`,
    },
    pt: {
      title: 'Estão orando por você 🙏',
      body: one ? 'Alguém começou a orar pelo seu pedido.' : `Já são ${n} pessoas orando pelo seu pedido.`,
    },
  }[l]
}
