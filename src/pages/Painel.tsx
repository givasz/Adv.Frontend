import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { computeTrust, type TrustFactor } from '@/lib/trustScore'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { UnlockMore } from '@/components/editor/UnlockMore'
import { Avatar } from '@/components/ui/Avatar'
import { ArrowRight, LockIcon, ScaleIcon, SearchIcon } from '@/components/ui/icons'

// Para onde cada passo leva no editor. Itens travados por plano também levam à seção —
// lá o próprio recurso mostra seu valor antes de pedir upgrade (upsell natural).
const DEST: Record<string, string> = {
  nome: '/editor?section=identidade',
  cidade: '/editor?section=identidade',
  oab: '/editor?section=identidade',
  bio: '/editor?section=bio',
  whatsapp: '/editor?section=redes',
  area1: '/editor?section=identidade',
  foto: '/editor?section=identidade',
  frase: '/editor?section=identidade',
  redes: '/editor?section=redes',
  email: '/editor?section=redes',
  area2: '/editor?section=identidade',
  experiencia: '/editor?section=destaques',
  artigo: '/editor?section=conteudo',
  oab_conferida: '/editor?section=oab',
  agenda: '/editor?section=agenda',
  dominio: '/editor?section=marca',
  marca: '/editor?section=marca',
}

const LAST_KEY = 'advocme:trust:last'

// Frase de incentivo conforme o índice — tom profissional, sem gamificação infantil.
function motivator(score: number): string {
  if (score >= 90) return 'Parabéns — seu perfil está excelente.'
  if (score >= 75) return 'Seu perfil já transmite muita confiança.'
  if (score >= 60) return 'Falta pouco para um perfil muito forte.'
  if (score >= 40) return 'Bom começo. Cada passo aumenta sua credibilidade.'
  return 'Vamos deixar seu perfil mais completo.'
}

export default function Painel() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [delta, setDelta] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Evolua seu perfil · advoc.me'
    api.getDraft().then((p) => {
      if (!p.published) {
        navigate('/comecar', { replace: true })
        return
      }
      setProfile(p)
    })
  }, [navigate])

  const trust = useMemo(() => (profile ? computeTrust(profile) : null), [profile])

  // Delta desde a última visita — reforça a sensação de evolução ("ficou melhor").
  useEffect(() => {
    if (!trust) return
    try {
      const last = Number(localStorage.getItem(LAST_KEY))
      if (Number.isFinite(last)) setDelta(trust.score - last)
      localStorage.setItem(LAST_KEY, String(trust.score))
    } catch {
      /* storage indisponível */
    }
  }, [trust])

  if (!profile || !trust) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const firstName = profile.name.split(' ')[0] || 'você'
  // Passos disponíveis no plano atual (os travados por plano viram upsell abaixo).
  const freeSteps = trust.next.filter((f) => !trust.locked(f))

  return (
    <div className="min-h-dvh bg-paper-deep">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <div className="flex items-center gap-3">
            <Link to={`/${profile.slug}`} target="_blank" className="btn-primary !py-2 !px-4 text-[13px]">
              Ver meu perfil
            </Link>
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center gap-4">
          <Avatar name={profile.name} src={profile.avatarUrl} size={52} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-ink">Evolua seu perfil</h1>
            <p className="text-[14px] text-ink-soft">Olá, {firstName}. Seu perfil já está online.</p>
          </div>
        </div>

        {/* Índice de Confiança */}
        <div className="mt-6 rounded-xl2 border border-ink/10 bg-paper p-6 shadow-card">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                Índice de confiança
              </p>
              <p className="mt-1 font-display text-[40px] font-semibold leading-none text-ink">
                {trust.score}
                <span className="text-[20px] text-ink-faint">/100</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-[15px] font-semibold text-brass-deep">{trust.level}</p>
              {delta > 0 && (
                <p className="mt-0.5 text-[12px] font-medium text-brass-deep">
                  ▲ +{delta} desde a última visita
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full bg-brass-deep"
              initial={{ width: 0 }}
              animate={{ width: `${trust.score}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{motivator(trust.score)}</p>
        </div>

        {/* Próximos passos — só o que dá pra fazer no plano atual (sem cadeados).
            Os itens de planos pagos vão para a seção de upsell abaixo. */}
        {freeSteps.length > 0 && (
          <>
            <h2 className="mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
              Próximos passos
            </h2>
            <div className="mt-3 space-y-2.5">
              {freeSteps.map((f) => (
                <StepCard key={f.key} factor={f} locked={false} />
              ))}
            </div>
          </>
        )}

        {/* Adicione mais ao seu perfil — instiga os planos pagos como "mais itens
            pra colocar no perfil", não como recursos abstratos. */}
        {profile.plan !== 'premium' && (
          <>
            <h2 className="mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
              Adicione mais ao seu perfil
            </h2>
            <div className="mt-3">
              <UnlockMore plan={profile.plan} />
            </div>
          </>
        )}

        {/* Descubra mais — recursos que não pontuam mas ampliam o alcance */}
        <h2 className="mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Descubra mais
        </h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <DiscoverCard
            to="/editor?section=analytics"
            title="Quem visita você"
            desc="Veja quantas pessoas abriram seu perfil."
          />
          <DiscoverCard
            to="/editor?section=qrcode"
            title="Seu cartão digital"
            desc="Compartilhe seu perfil com um QR Code."
          />
        </div>

        {/* Conquistados */}
        {trust.earned.length > 0 && (
          <p className="mt-6 text-center text-[12.5px] text-ink-faint">
            {trust.earned.length} {trust.earned.length === 1 ? 'item concluído' : 'itens concluídos'} ·
            você continua evoluindo quando quiser.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-ink-faint">
          <Link to="/buscar" className="inline-flex items-center gap-1.5 hover:text-ink">
            <SearchIcon width={14} height={14} /> Ver o diretório
          </Link>
          <Link to="/legal" className="hover:text-ink">
            Documentos e privacidade
          </Link>
        </div>
      </main>
    </div>
  )
}

function DiscoverCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl2 border border-ink/10 bg-paper/60 p-4 transition-colors hover:border-burgundy/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[14.5px] font-semibold leading-tight text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-soft">{desc}</span>
      </span>
      <ArrowRight width={15} height={15} className="shrink-0 text-ink-faint" />
    </Link>
  )
}

function StepCard({ factor, locked }: { factor: TrustFactor; locked: boolean }) {
  const to = DEST[factor.key] ?? '/editor?section=identidade'
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card transition-colors hover:border-burgundy/40"
    >
      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl2 bg-brass/12 leading-none text-brass-deep">
        <span className="text-[15px] font-semibold">+{factor.points}</span>
        <span className="text-[8.5px] font-medium uppercase tracking-wide opacity-70">pts</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-[15px] font-semibold leading-tight text-ink">
            {factor.action}
          </span>
          {factor.plan && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              {locked && <LockIcon width={10} height={10} />}
              {factor.plan === 'premium' ? 'Max' : 'Pro'}
            </span>
          )}
        </span>
      </span>
      <ArrowRight width={16} height={16} className="shrink-0 text-ink-faint" />
    </Link>
  )
}
