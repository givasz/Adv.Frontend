import { useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { hostLabel } from '@/lib/publicUrl'
import { ArrowRight, CheckIcon } from '@/components/ui/icons'

// O fechamento da home: um cartão de tinta com o campo do endereço.
//
// O que o campo NÃO faz é reservar. Nenhum endereço é guardado antes de existir
// conta e perfil, e o endereço limpo (sem número) é do Pro e do Max — o Free
// nasce numerado (ver resolveSlug no backend). Por isso a linha de baixo mostra
// os dois endereços lado a lado e a consulta diz "está livre hoje", nunca
// "é seu". Prometer reserva aqui seria entregar, no primeiro save, um endereço
// diferente do que a pessoa viu.
//
// O que o campo FAZ: o texto digitado vira o nome pré-preenchido no /comecar
// (?nome=), e é desse nome que sai o endereço do Free. Assim o que a pessoa viu
// aqui é o que ela encontra lá.

const LIMITE = 40

/** Endereço enquanto se digita: igual ao slugify, mas deixa o hífen do fim. */
function aoDigitar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, LIMITE)
}

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

/** "marina-sales-da-costa" → "Marina Sales da Costa", para pré-preencher o nome. */
export function nomeDoEndereco(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

type Consulta =
  | { estado: 'ocioso' }
  | { estado: 'consultando' }
  | { estado: 'livre'; slug: string }
  | { estado: 'ocupado'; slug: string; sugestao: string }

export function EnderecoCta({ destino }: { destino: string }) {
  const navigate = useNavigate()
  const host = hostLabel()
  const ajudaId = useId()
  const [texto, setTexto] = useState('')
  const [consulta, setConsulta] = useState<Consulta>({ estado: 'ocioso' })

  const slug = texto.replace(/-+$/, '')

  // Pergunta ao servidor só depois de a pessoa parar de digitar — uma consulta
  // por pausa, não uma por tecla.
  useEffect(() => {
    if (slug.length < 3) {
      setConsulta({ estado: 'ocioso' })
      return
    }
    setConsulta({ estado: 'consultando' })
    let vivo = true
    const t = setTimeout(() => {
      api
        .checkSlug(slug)
        .then((r) => {
          if (!vivo) return
          if (r.available === true) setConsulta({ estado: 'livre', slug: r.slug })
          else if (r.available === false) setConsulta({ estado: 'ocupado', slug: r.slug, sugestao: r.suggested })
          else setConsulta({ estado: 'ocioso' })
        })
        .catch(() => vivo && setConsulta({ estado: 'ocioso' }))
    }, 450)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [slug])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const nome = nomeDoEndereco(slug)
    navigate(nome ? `${destino}?nome=${encodeURIComponent(nome)}` : destino)
  }

  const exemplo = slug || 'seu-nome'

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-20"
    >
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#1a1612] px-5 py-14 text-center shadow-lift sm:rounded-[36px] sm:px-10 sm:py-20">
        {/* Papel quadriculado de tinta, sumindo nas bordas — o timbre do cartão. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#f5f0e6 1px, transparent 1px), linear-gradient(90deg, #f5f0e6 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, #000 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, #000 30%, transparent 75%)',
          }}
        />
        {/* Brilho de latão subindo do pé do cartão, com um fundo de vinho. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3"
          style={{
            background:
              'radial-gradient(ellipse 45% 60% at 50% 110%, rgba(176,141,87,0.55), rgba(107,33,49,0.3) 45%, transparent 75%)',
          }}
        />

        <h2 className="font-display text-[34px] font-semibold leading-[1.02] tracking-tight text-paper min-[380px]:text-[40px] sm:text-6xl lg:text-7xl">
          Seu nome merece <span className="italic text-brass-light">um endereço.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15.5px] leading-relaxed text-paper/65 sm:text-[17px]">
          Comece agora. Leva poucos minutos e não pede cartão.
        </p>

        <form onSubmit={enviar} className="mx-auto mt-9 max-w-xl" role="search" aria-label="Escolher o seu endereço">
          <div className="rounded-full bg-brass/25 p-[5px] shadow-[0_0_0_1px_rgba(216,185,133,0.35),0_18px_50px_-18px_rgba(176,141,87,0.65)] transition-shadow focus-within:shadow-[0_0_0_2px_rgba(216,185,133,0.8),0_18px_50px_-18px_rgba(176,141,87,0.8)]">
            <div className="flex items-center gap-2 rounded-full bg-paper-soft py-1.5 pl-4 pr-1.5 sm:pl-6">
              <label className="flex min-w-0 flex-1 cursor-text items-center font-mono text-[14px] sm:text-[15px]">
                <span className="hidden shrink-0 text-ink-faint min-[400px]:inline">{host}/</span>
                <span className="shrink-0 text-ink-faint min-[400px]:hidden">/</span>
                <span className="sr-only">Seu endereço</span>
                <input
                  type="text"
                  inputMode="text"
                  // Sem isto o Chrome oferece o endereço POSTAL salvo no navegador.
                  name="advocme-endereco-do-perfil"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={LIMITE}
                  value={texto}
                  onChange={(e) => setTexto(aoDigitar(e.target.value))}
                  placeholder="seu-nome"
                  aria-describedby={ajudaId}
                  className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-ink placeholder:text-ink-faint/60 focus:outline-none"
                />
              </label>
              <button type="submit" className="btn-conversion shrink-0 !rounded-full !px-4 !py-2.5 text-[14px] sm:!px-6 sm:text-[15px]">
                <span className="hidden min-[400px]:inline">Criar meu link</span>
                <span className="min-[400px]:hidden">Criar</span>
                <ArrowRight width={17} height={17} aria-hidden />
              </button>
            </div>
          </div>

          <div id={ajudaId} aria-live="polite" className="mt-4 min-h-[44px] px-2 text-[13px] leading-relaxed text-paper/60">
            {consulta.estado === 'livre' && (
              <p className="mb-1.5 inline-flex items-center gap-1.5 font-medium text-[#8fd3b4]">
                <CheckIcon width={14} height={14} strokeWidth={2.6} aria-hidden />
                {host}/{consulta.slug} está livre hoje.
              </p>
            )}
            {consulta.estado === 'ocupado' && (
              <p className="mb-1.5 font-medium text-brass-light">
                {host}/{consulta.slug} já está em uso
                {consulta.sugestao && consulta.sugestao !== consulta.slug && (
                  <>
                    {' '}
                    — no Pro e no Max, você pode usar{' '}
                    <span className="font-mono">{host}/{consulta.sugestao}</span> ou outro de sua escolha
                  </>
                )}
                .
              </p>
            )}
            <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span>
                Grátis:{' '}
                <span className="break-all font-mono text-paper/85">
                  {host}/{exemplo}
                  <span className="text-paper/40">-0000</span>
                </span>
              </span>
              <span>
                Pro e Max:{' '}
                <span className="break-all font-mono text-brass-light">
                  {host}/{exemplo}
                </span>
              </span>
            </p>
          </div>
        </form>
      </div>
    </motion.section>
  )
}
