type Frame = 'circle' | 'arch' | 'square' | 'ornate'

interface AvatarProps {
  src?: string
  name: string
  size?: number
  ring?: boolean
  frame?: Frame
}

const radiusFor: Record<Frame, string> = {
  circle: '9999px',
  ornate: '9999px',
  arch: '9999px 9999px 14px 14px',
  square: '6px',
}

function ringShadow(frame: Frame): string | undefined {
  if (frame === 'ornate') {
    // anel duplo em latão/ouro
    return [
      '0 0 0 2px var(--c-bg, #f5f0e6)',
      '0 0 0 3px var(--c-ring, rgba(176,141,87,0.5))',
      '0 0 0 6px var(--c-bg, #f5f0e6)',
      '0 0 0 7px var(--c-ring, rgba(176,141,87,0.5))',
    ].join(', ')
  }
  return '0 0 0 2px var(--c-bg, #f5f0e6), 0 0 0 3.5px var(--c-ring, rgba(176,141,87,0.4))'
}

export function Avatar({ src, name, size = 96, ring = true, frame = 'circle' }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  // arco é levemente mais alto que largo (retrato)
  const height = frame === 'arch' ? Math.round(size * 1.12) : size

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: size,
        height,
        borderRadius: radiusFor[frame],
        background: 'var(--c-accent-soft, rgba(107,33,49,0.10))',
        boxShadow: ring ? ringShadow(frame) : undefined,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={`Foto de ${name}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="t-accent flex h-full w-full items-center justify-center font-display font-semibold"
          style={{ fontSize: size * 0.36 }}
          aria-hidden
        >
          {initials || '·'}
        </div>
      )}
    </div>
  )
}
