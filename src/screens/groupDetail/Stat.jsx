export default function Stat({ n, label }) {
  return (
    <div className="flex-1">
      <div className="stat-num text-[30px] font-bold text-accent-ink">{n}</div>
      <div className="mt-0.5 text-[12px] leading-tight text-ink-soft">{label}</div>
    </div>
  )
}
