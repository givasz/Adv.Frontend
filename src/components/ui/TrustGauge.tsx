import { motion } from 'framer-motion'

// Cor semântica do índice: quanto maior, mais verde. Interpola o matiz de um
// âmbar-quente (baixo) até um verde-jurídico (alto), com saturação/luz sóbrias
// que combinam com o fundo de papel. Separada do acento da marca (é semântica).
export function trustColor(score: number): string {
  const s = Math.max(0, Math.min(100, score))
  const hue = 8 + (150 - 8) * (s / 100) // 8° (quente) → 150° (verde)
  return `hsl(${Math.round(hue)} 46% 36%)`
}

/**
 * Roda de confiança — anel circular que preenche e esverdeia conforme o índice
 * sobe. O número no centro assume a mesma cor. Anima do 0 ao valor ao montar.
 */
export function TrustGauge({
  score,
  size = 148,
  stroke = 12,
}: {
  score: number
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const color = trustColor(score)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(33,28,23,0.10)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[30px] font-semibold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-faint">de 100</span>
      </div>
    </div>
  )
}
