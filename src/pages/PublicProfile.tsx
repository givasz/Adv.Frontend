import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { getPublicProfile, isExampleSlug } from '@/lib/perfilPublico'
import { useAuth } from '@/lib/auth'
import { applyProfileSeo } from '@/lib/seo'
import { ProfileView } from '@/components/profile/ProfileView'
import { ShareBar } from '@/components/profile/ShareBar'
import { OwnerBar } from '@/components/profile/OwnerBar'
import { FlagIcon } from '@/components/ui/icons'
// Módulo de constantes puro (sem dependências) — não pesa no caminho crítico do
// perfil público. Ver lib/legalIdentity.ts.
import { OPERADOR } from '@/lib/legalIdentity'
import { Marca } from '@/components/ui/Marca'

export default function PublicProfile() {
  const { slug = '' } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')
  // Dono? Só então aparece a barra com o caminho de volta ao editor. Comparamos
  // com o SLUG do rascunho dele — é o que amarra a sessão a este endereço.
  const { isAuthed } = useAuth()
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (!isAuthed) {
      setIsOwner(false)
      return
    }
    let alive = true
    // lib/api.ts por import dinâmico: só o DONO logado paga por ele. O visitante
    // anônimo (o caso que importa para a velocidade) nunca entra neste ramo.
    import('@/lib/api')
      .then(({ api }) => api.getDraft())
      .then((mine) => {
        if (alive) setIsOwner(!!mine.slug && mine.slug === slug)
      })
      .catch(() => {
        /* sem rede: some a barra, que é auxiliar — o perfil segue de pé */
      })
    return () => {
      alive = false
    }
  }, [isAuthed, slug])

  useEffect(() => {
    let alive = true
    setState('loading')
    getPublicProfile(slug).then((p) => {
      if (!alive) return
      if (p) {
        setProfile(p)
        setState('ready')
      } else {
        setState('notfound')
      }
    })
    return () => {
      alive = false
    }
  }, [slug])

  // Altura real das barras do topo, para o botão flutuante não sumir atrás delas.
  const barsRef = useRef<HTMLDivElement>(null)
  const [barsHeight, setBarsHeight] = useState(0)
  useEffect(() => {
    const el = barsRef.current
    if (!el) return
    const medir = () => setBarsHeight(el.offsetHeight)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isOwner, state])

  // SEO local automático — título, meta e JSON-LD (Attorney) a partir do perfil.
  // Nos perfis de exemplo (fictícios) NÃO injetamos schema de advogado real.
  useEffect(() => {
    if (!profile) return
    if (isExampleSlug(profile.slug)) return
    return applyProfileSeo(profile)
  }, [profile])

  if (state === 'loading') {
    return (
      <div className="grain flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  if (state === 'notfound' || !profile) {
    return (
      <div className="grain flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Marca size={46} className="opacity-80" />
        <h1 className="text-2xl font-semibold">Perfil não encontrado</h1>
        <p className="max-w-xs text-ink-faint">
          O endereço <span className="font-medium">advoc.me/{slug}</span> ainda não existe.
        </p>
        <Link to="/" className="btn-ghost mt-2">
          Voltar ao início
        </Link>
      </div>
    )
  }

  // Fixtures de demonstração (marina-sales, guilherme-sales23): rotulados como
  // exemplo para não serem lidos como advogado real (OAB fictícia).
  const isExample = isExampleSlug(profile.slug)

  return (
    // overflow-x-CLIP, não hidden: hidden faz o main virar contêiner de rolagem
    // (overflow-y computa auto) e as barras sticky lá de dentro passam a grudar
    // nele — que nunca rola, então nunca grudam. clip corta o estouro lateral
    // sem criar scrollport, e o sticky volta a valer contra a janela.
    <main className="relative flex min-h-dvh flex-col overflow-x-clip">
      {/* As barras do topo são grudentas e o botão "Compartilhar" é fixo. Medimos
          a altura real (a do dono QUEBRA em duas linhas no celular) para o botão
          descer o tanto certo em vez de ficar escondido atrás. */}
      <div ref={barsRef}>
        {isExample && (
          <div className="sticky top-0 z-30 flex items-center justify-center gap-1.5 bg-ink px-4 py-2 text-center text-[11.5px] font-medium leading-snug text-paper-soft">
            <Marca size={16} />
            Perfil de demonstração — pessoa e dados fictícios, apenas para exemplo do advoc.me.
          </div>
        )}
        {isOwner && <OwnerBar />}
      </div>
      <ShareBar slug={profile.slug} name={profile.name} topOffset={barsHeight} />
      <ProfileView profile={profile} owner={isOwner} />

      {/* Rodapé da PLATAFORMA (não do advogado). Discreto de propósito — mas
          presente, porque quem chega aqui pode escrever para o advogado sem
          nunca ter visto uma linha nossa.

          Os TERMOS passaram a estar aqui (04/09/2026). Antes só havia denúncia e
          privacidade, e o resultado era torto: o documento em que a plataforma
          limita a própria responsabilidade só era alcançável por quem tinha
          conta — ou seja, por todo mundo menos a parte que eventualmente
          processa. Uma limitação de responsabilidade que o terceiro prejudicado
          nunca teve como ler é uma limitação que não se opõe a ele.

          A identificação do operador vem junto pelo mesmo motivo: quem se sentir
          lesado tem direito de saber a quem se dirigir (CDC, arts. 6º, III e
          31), e um site sem dono é um site que vira réu por omissão. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2">
        <Link
          to={`/${profile.slug}/denunciar`}
          className="group inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-faint/70 transition-colors hover:text-burgundy"
        >
          {/* O sublinhado fica no TEXTO, não no botão: com o ícone dentro de um
              inline-flex, sublinhar o container arrastaria o traço por baixo da
              bandeira também. */}
          <FlagIcon width={12} height={12} strokeWidth={1.9} aria-hidden />
          <span className="underline-offset-2 group-hover:underline">Denunciar este perfil</span>
        </Link>
        <Link
          to="/legal/termos"
          className="text-[11.5px] font-medium text-ink-faint/70 underline-offset-2 transition-colors hover:text-burgundy hover:underline"
        >
          Termos de Uso
        </Link>
        <Link
          to="/legal/privacidade"
          className="text-[11.5px] font-medium text-ink-faint/70 underline-offset-2 transition-colors hover:text-burgundy hover:underline"
        >
          Privacidade
        </Link>
      </div>
      {/* `pb-28` e não `pb-10`: o balão de conversa é FIXO no canto inferior e,
          num celular estreito, cobria justamente a linha da identificação — um
          aviso legal escondido atrás de um botão não é um aviso legal. O espaço
          extra fica no fim de uma página já rolada, onde ninguém o percebe. */}
      <p className="mx-auto max-w-md px-5 pb-28 pt-2 text-center text-[10.5px] leading-relaxed text-ink-faint/60">
        Página hospedada pelo advoc.me, operado por {OPERADOR.razaoSocial}, CNPJ {OPERADOR.cnpj}.
        O conteúdo é de responsabilidade do profissional que o publicou.
      </p>

    </main>
  )
}
