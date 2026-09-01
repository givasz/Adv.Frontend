import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { getTheme, themeStyle, type RuleStyle } from '@/lib/themes'
import { resolveSchedulingMode } from '@/lib/booking'
import { canUseFaq, canUseVideo } from '@/lib/plans'
import { parseVideoUrl } from '@/lib/video'
import { Avatar } from '@/components/ui/Avatar'
import { VideoPlayer } from '@/components/profile/VideoPlayer'
import { AssistantChat } from '@/components/profile/AssistantChat'
import { BalaoDeConversa, balaoVisivel } from '@/components/profile/BalaoDeConversa'
import { assistantTitle } from '@/lib/assistant'
import { CnaLink } from '@/components/ui/CnaLink'
import {
  ArrowRight,
  CalendarIcon,
  ExternalLinkIcon,
  SparkIcon,
  ChevronDown,
  MailIcon,
  PinIcon,
  WhatsappIcon,
  socialMeta,
} from '@/components/ui/icons'
import { safeHref } from '@/lib/safeUrl'
import { cliqueDoPerfil, registrarEvento } from '@/lib/eventos'
import { enderecoCurto, enderecoVisivel, linkDoMapa } from '@/lib/endereco'
import { Marca } from '@/components/ui/Marca'

interface ProfileViewProps {
  profile: Profile
  /** true dentro do editor: desativa navegação real e o efeito de entrada */
  preview?: boolean
  /**
   * O DONO está vendo o próprio perfil público. Liga marcas discretas nos
   * lugares onde falta conteúdo — a diferença entre o perfil dele e o exemplo da
   * home é justamente o que ainda não foi preenchido, e sem uma pista aqui isso
   * se parece com defeito do produto. Nunca aparece para visitante.
   */
  owner?: boolean
  /**
   * Deixa o assistente virtual abrir mesmo em `preview` — usado no telefone da home,
   * que é uma demonstração viva. Fora isso, segue o `preview`.
   */
  chatEnabled?: boolean
}

// Converte "#rrggbb" em "rgba(r,g,b,a)" para a variável de destaque suave.
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(150,116,63,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function ProfileView({
  profile,
  preview = false,
  chatEnabled,
  owner = false,
}: ProfileViewProps) {
  const [schedOpen, setSchedOpen] = useState(false)
  const schedulingMode = resolveSchedulingMode(profile)
  // Agendar é a única ação que continua viva na prévia da home (chatEnabled).
  const canSchedule = chatEnabled ?? !preview
  // DEMONSTRAÇÃO: só no telefone da home a conversa abre ali mesmo, sobre a
  // prévia — é o que se está mostrando. No perfil de verdade, agendar virou
  // PÁGINA (/:slug/agendar): sem overlay, com endereço próprio e voltar do
  // navegador funcionando.
  const demoChat = !!chatEnabled && preview
  // Perfil vivo (RFC-002): só existe o que tem conteúdo. Áreas sem nome não viram
  // card — nada de caixa vazia.
  const areas = profile.areas.filter((a) => a.label.trim())
  // A primeira área COM descrição já abre, pela mesma razão do FAQ: uma pilha de
  // sanfonas fechadas parece uma lista de rótulos, e ninguém toca no que não
  // parece ter conteúdo. Aberta, a primeira mostra que as outras também têm.
  //
  // É "a primeira COM texto", e não "a primeira": área sem descrição nem vira
  // sanfona — ela é um tile estático (ver AreaCard). Se o índice 0 fosse uma
  // dessas, abrir "a primeira" não revelaria nada e o problema continuaria.
  const primeiraAreaComTexto = areas.find((a) => a.description.trim())?.id
  // FAQ: recurso pago (o servidor já não devolve fora dos planos pagos; a trava
  // repetida aqui vale para a prévia do editor e para o mock). Só entra pergunta
  // COM resposta — dúvida pendurada sem resposta é pior que não ter FAQ nenhum.
  const faqs = canUseFaq(profile.plan)
    ? (profile.faqs ?? []).filter((f) => f.question.trim() && f.answer.trim())
    : []
  // Vídeo de apresentação (Max): só existe se o link for reconhecido — link
  // quebrado não vira caixa vazia no perfil de ninguém.
  const video = canUseVideo(profile.plan) ? parseVideoUrl(profile.videoUrl) : null
  const s = getTheme(profile.theme).style
  const brand = profile.branding
  // White-label: cor de destaque personalizada sobrescreve a do tema via CSS vars.
  const brandVars = brand?.accent
    ? ({ '--c-accent': brand.accent, '--c-accent-soft': hexToRgba(brand.accent, 0.14) } as React.CSSProperties)
    : undefined
  const tile = s.tile === 'card' ? 't-tile' : `t-tile tv-${s.tile}`
  const foil = s.finish === 'foil'
  const left = s.header === 'editorial'
  // A entreletra do NOME vem do tema (--name-tracking), não de uma classe fixa:
  // caixa alta pede ar, serifa em corpo grande pede aperto, e cada família tem
  // seu ponto de equilíbrio. Inline porque a regra do tema no CSS vence a classe
  // do Tailwind por especificidade — deixar as duas brigando dá resultado
  // diferente por tema sem ninguém entender o porquê.
  const nameCls = [
    'leading-tight',
    s.nameCase === 'upper'
      ? 'uppercase text-[21px] sm:text-[25px] font-medium'
      : 'text-[26px] sm:text-[30px] font-semibold',
    foil ? 'foil' : '',
  ].join(' ')
  const nameStyle: React.CSSProperties = { letterSpacing: 'var(--name-tracking, -0.01em)' }

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: preview ? 0 : 0.07, delayChildren: preview ? 0 : 0.05 },
    },
  }
  const item: Variants = preview
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }

  const whatsappHref = profile.contact.whatsapp
    ? `https://wa.me/${profile.contact.whatsapp}?text=${encodeURIComponent(
        `Olá, ${profile.name.split(' ')[0]}! Vim pelo seu perfil no advoc.me e gostaria de tirar uma dúvida.`,
      )}`
    : undefined

  // Para os links que não são ação de contato (a marca d'água do rodapé): na
  // prévia do editor eles não navegam, e não há nada a medir neles.
  const stop = preview ? (e: React.MouseEvent) => e.preventDefault() : undefined

  // Um clique de contato faz duas coisas: na PRÉVIA, não navega; no perfil de
  // verdade, avisa a métrica antes de seguir. Ver lib/eventos.ts — o aviso sai
  // por sendBeacon justamente porque a página está prestes a ser trocada, e um
  // fetch comum morreria junto com o documento.
  const clique = (evento: Parameters<typeof cliqueDoPerfil>[1]) =>
    cliqueDoPerfil(profile.slug, evento, !!preview)

  const identity = (
    <>
      <span className="t-accent text-sm font-medium">{profile.oabNumber}</span>
      {/* Ponteiro para a consulta pública do CNA — vale para QUALQUER perfil com
          número informado, sem distinção de plano. Ver components/ui/CnaLink. */}
      {profile.oabNumber.trim() && <CnaLink name={profile.name} compact interactive={!preview} />}
    </>
  )

  return (
    <div
      className={`themed w-full flex-1 surf-${s.surface}`}
      style={{ ...themeStyle(profile.theme), ...brandVars }}
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-10 sm:pt-14"
      >
        {/* Cabeçalho — layout varia por tema */}
        {left ? (
          <motion.header variants={item} className="flex items-center gap-4 text-left">
            <Avatar src={profile.avatarUrl} name={profile.name} size={78} frame={s.avatar} />
            <div className="min-w-0">
              <h1 className={nameCls} style={nameStyle}>{profile.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">{identity}</div>
              {profile.headline ? (
                <p className="t-muted mt-1 text-[14px]">{profile.headline}</p>
              ) : (
                owner && (
                  <OwnerHint to="/editor?section=identidade" className="mt-1.5">
                    Falta a sua frase de apresentação
                  </OwnerHint>
                )
              )}
            </div>
          </motion.header>
        ) : (
          <motion.header variants={item} className="flex flex-col items-center text-center">
            {s.header === 'letterhead' && <div className="t-rule mb-5 w-24" />}
            <Avatar src={profile.avatarUrl} name={profile.name} size={104} frame={s.avatar} />
            <h1 className={`mt-4 ${nameCls}`} style={nameStyle}>{profile.name}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {identity}
            </div>
            {profile.headline ? (
              <p className="t-muted mt-2 text-[15px]">{profile.headline}</p>
            ) : (
              owner && (
                <OwnerHint to="/editor?section=identidade" className="mt-2.5">
                  Falta a sua frase de apresentação
                </OwnerHint>
              )
            )}
            {s.header === 'letterhead' && <div className="t-rule mt-4 w-16" />}
          </motion.header>
        )}

        {/* Localização */}
        <motion.div
          variants={item}
          className={`t-faint mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] ${
            left ? 'justify-start' : 'justify-center'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <PinIcon width={15} height={15} />
            {profile.city}/{profile.state}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {[profile.serviceMode.inPerson && 'Presencial', profile.serviceMode.online && 'Online']
              .filter(Boolean)
              .join(' · ')}
          </span>
        </motion.div>
        {profile.regionNote && (
          <motion.p
            variants={item}
            className={`t-faint mt-1 text-[13px] ${left ? 'text-left' : 'text-center'}`}
          >
            {profile.regionNote}
          </motion.p>
        )}

        {/* Endereço do escritório — mais uma linha do bloco de localização, e
            não um cartão.
            Já foi um ladrilho com borda, duas linhas e seta, do tamanho dos
            botões de contato. Ficava com mais peso do que merece: endereço é
            informação de referência, não é a ação que a pessoa veio fazer — e
            um retângulo daquele tamanho logo acima do botão de WhatsApp disputa
            atenção com ele. Aqui é texto miúdo, na mesma família da observação
            de região, com a cidade omitida (`enderecoCurto`) porque ela já está
            escrita na linha de cima.
            Só aparece com rua preenchida e o interruptor ligado (ver
            lib/endereco.ts): sem logradouro o mapa abriria no meio da cidade,
            fingindo apontar para o escritório. */}
        {enderecoVisivel(profile.address) && (
          <motion.p
            variants={item}
            className={`t-faint mt-1 text-[12px] leading-snug opacity-90 ${
              left ? 'text-left' : 'text-center'
            }`}
          >
            <a
              href={linkDoMapa(profile.address, profile.city, profile.state)}
              onClick={clique('endereco')}
              target="_blank"
              rel="noreferrer noopener"
              className="inline hover:underline"
            >
              {enderecoCurto(profile.address)}{' '}
              <ExternalLinkIcon
                width={10}
                height={10}
                className="inline shrink-0 -translate-y-px opacity-70"
              />
            </a>
          </motion.p>
        )}

        {/* CTAs principais — logo abaixo da localização, de propósito: falar com o
            advogado é o que a pessoa veio fazer. Ficavam depois da bio, embaixo de
            tudo que ela ainda ia ler; agora o caminho está aberto assim que ela
            reconhece quem é, onde atua e como atende. */}
        <div className="mt-6 space-y-3">
          {whatsappHref && (
            <motion.a
              variants={item}
              href={whatsappHref}
              onClick={clique('whatsapp')}
              target="_blank"
              rel="noreferrer noopener"
              className="t-btn w-full text-[15px]"
            >
              <WhatsappIcon width={24} height={24} />
              Conversar no WhatsApp
            </motion.a>
          )}
          {schedulingMode === 'external' && safeHref(profile.contact.scheduling) && (
            <motion.a
              variants={item}
              href={safeHref(profile.contact.scheduling)}
              onClick={clique('agendamento')}
              target="_blank"
              rel="noreferrer noopener"
              className={`${tile} justify-center !py-3.5 font-semibold`}
            >
              <CalendarIcon width={19} height={19} className="t-accent" />
              Agendar uma consulta
            </motion.a>
          )}
          {schedulingMode === 'assistant' && (
            // Assistente virtual: a conversa guiada é o caminho mais leve para marcar
            // um horário — e deixa explícito, já no botão, que quem atende é um robô.
            <motion.div variants={item}>
             <AcaoAgendar slug={profile.slug} demo={demoChat} onDemo={() => setSchedOpen(true)} inert={!canSchedule} className={`${tile} !py-3`}>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--c-accent-soft)' }}
                aria-hidden
              >
                <SparkIcon width={17} height={17} className="t-accent" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight">
                  Agendar uma conversa
                </span>
                <span className="t-faint block text-[12px] leading-tight">
                  {assistantTitle(profile)}
                </span>
              </span>
              <ArrowRight width={16} height={16} className="t-faint shrink-0" />
             </AcaoAgendar>
            </motion.div>
          )}
          {schedulingMode === 'whatsapp' && (
            <motion.div variants={item}>
              <AcaoAgendar
                slug={profile.slug}
                demo={demoChat}
                onDemo={() => setSchedOpen(true)}
                inert={!canSchedule}
                className={`${tile} justify-center !py-3.5 font-semibold`}
              >
                <CalendarIcon width={19} height={19} className="t-accent" />
                Agendar uma consulta
              </AcaoAgendar>
            </motion.div>
          )}
        </div>

        {owner && profile.socials.length === 0 && (
          <motion.div variants={item} className="mt-6 flex justify-center">
            <OwnerHint to="/editor?section=redes">
              Suas redes e site ainda não aparecem aqui
            </OwnerHint>
          </motion.div>
        )}

        {/* Redes sociais — logo abaixo da identidade (foto/nome/OAB/localização).
            `redes-grade` marca a seção como contêiner de consulta, e é por
            CONTÊINER e não por tela porque o mesmo perfil é desenhado em dois
            lugares de largura bem diferente (a página inteira e o telefone da
            home, que tem 320px).
            A grade fica em DUAS colunas mesmo no estreito: quando o espaço
            aperta, o que encolhe é o ladrilho — a seta some, o ícone diminui e
            o respiro interno fecha (ver index.css). Duas colunas de links
            curtos leem melhor do que uma coluna alta, e a seta era o elemento
            mais dispensável dos três: o ladrilho inteiro já é o link. */}
        {profile.socials.length > 0 && (
          <motion.section variants={item} className="redes-grade mt-6">
            <SectionTitle rule={s.rule}>Redes e site</SectionTitle>
            {/* Duas colunas em TODOS os temas, inclusive no de ladrilho
                'underline' — que antes ficava em coluna única. O caráter de
                "links em lista" desse tema está no ladrilho (sem moldura, com
                filete embaixo), não na quantidade de colunas; e quatro links
                empilhados são uma torre que empurra o resto do perfil para
                baixo, em qualquer tema. */}
            <div className="redes-colunas mt-3 grid grid-cols-2 gap-2.5">
              {profile.socials.map((soc) => {
                // Rede desconhecida não tem ícone — renderizar sem conferir
                // derrubava a página inteira. E o link só vira href se for
                // http/https (ver lib/safeUrl.ts).
                const meta = socialMeta[soc.kind]
                const href = safeHref(soc.url)
                if (!meta || !href) return null
                const Icon = meta.Icon
                return (
                  <a
                    key={soc.kind + soc.url}
                    href={href}
                    onClick={clique(`rede:${soc.kind}`)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${tile} redes-item !py-3 text-sm font-medium`}
                  >
                    {/* cor da marca SÓ na logo; "Site" (neutro) segue o tema */}
                    <Icon
                      width={24}
                      height={24}
                      className={`redes-logo shrink-0 ${meta.color ? '' : 't-muted'}`}
                      style={meta.color ? { color: meta.color } : undefined}
                    />
                    {/* O rótulo era um nó de texto solto: sem `min-w-0` ele não
                        encolhe, e sem `truncate` não tem para onde ir — o ladrilho
                        simplesmente transbordava e "Instagram" saía cortado pela
                        borda. Acontecia no telefone da home, onde a coluna é
                        estreita. Agora, se um dia faltar espaço, a palavra termina
                        em reticências em vez de ser decepada. */}
                    <span className="min-w-0 truncate">{meta.label}</span>
                    <ArrowRight width={15} height={15} className="redes-seta t-faint ml-auto shrink-0" />
                  </a>
                )
              })}
            </div>
          </motion.section>
        )}

        <motion.div variants={item}>
          <ThemeDivider type={s.rule} />
        </motion.div>

        {/* Bio */}
        {profile.bio && (
          <motion.p
            variants={item}
            className={`t-muted text-[15.5px] leading-relaxed ${left ? 'text-left' : 'text-center'}`}
          >
            {profile.bio}
          </motion.p>
        )}

        {/* Áreas de atuação */}
        {areas.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle rule={s.rule}>Áreas de atuação</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {areas.map((a) => (
                <AreaCard
                  key={a.id}
                  label={a.label}
                  description={a.description}
                  tileClass={tile}
                  defaultOpen={a.id === primeiraAreaComTexto}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Perguntas frequentes — o advogado responde as dúvidas que mais ouve.
            Informativo por definição (Prov. 205/2021): orientação geral, sem
            promessa de resultado e sem substituir a análise do caso. É a seção
            que mais responde ao que o visitante veio procurar, então vem antes
            do vídeo e depois do que explica QUEM é o advogado. */}
        {faqs.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle rule={s.rule}>Perguntas frequentes</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {faqs.map((f, i) => (
                <FaqItem
                  key={f.id}
                  question={f.question}
                  answer={f.answer}
                  tileClass={tile}
                  // A primeira já abre: um acordeão todo fechado esconde justamente
                  // a prova de que o advogado explica bem — e é ela que convence.
                  defaultOpen={i === 0}
                />
              ))}
            </div>
            <p className="t-faint mt-3 text-[11px] leading-relaxed">
              Respostas de caráter informativo. Não substituem a análise do seu caso.
            </p>
          </motion.section>
        )}

        {/* Vídeo de apresentação — fecha o perfil: quem chegou até aqui já leu
            quem você é, e o vídeo é o que mais aproxima. Fica por último também
            porque é o único bloco que fala com um servidor de terceiro, e só
            depois do clique (ver VideoPlayer). */}
        {video && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle rule={s.rule}>Apresentação</SectionTitle>
            <div className="mt-3">
              <VideoPlayer
                video={video}
                caption={profile.videoCaption}
                name={profile.name}
                orientation={profile.videoOrientation}
                inert={preview && !chatEnabled}
              />
            </div>
          </motion.section>
        )}

        {/* E-mail */}
        {profile.contact.email && (
          <motion.a
            variants={item}
            href={`mailto:${profile.contact.email}`}
            onClick={clique('email')}
            className={`${tile} mt-9 justify-center !py-3 text-sm font-medium`}
          >
            <MailIcon width={18} height={18} className="t-muted" />
            {profile.contact.email}
          </motion.a>
        )}

        {/* Marca d'água (plano gratuito) */}
        <motion.footer variants={item} className="mt-12 flex flex-col items-center gap-1">
          {profile.plan === 'free' && !brand?.hideWatermark && (
            <a
              href="/"
              onClick={stop}
              className="t-link inline-flex items-center gap-1.5 text-xs"
            >
              <Marca size={20} />
              criado com <span className="font-semibold">advoc.me</span>
            </a>
          )}
          {brand?.brandName && (
            <p className="t-faint text-[11px] font-medium tracking-wide">{brand.brandName}</p>
          )}
          {!preview && profile.contentModerated && (
            <p className="t-faint text-[10.5px] leading-relaxed opacity-80">
              Parte do conteúdo deste perfil foi ocultada por moderação de conformidade.
            </p>
          )}
          <p className="t-faint text-[10.5px] leading-relaxed opacity-85">
            Perfil informativo · em conformidade com o Provimento 205/2021 da OAB
          </p>
        </motion.footer>
      </motion.div>

      {/* Balão de conversa no canto — atalho para a MESMA conversa do corpo da
          página. Três condições, e todas precisam valer:
            • o advogado ligou (`assistant.floating`, desligado por padrão);
            • o servidor deixou (o campo só vem `true` em Pro/Max);
            • o assistente é de fato o modo de agendamento escolhido — um
              atalho para uma conversa que não existe seria um botão quebrado.
          `canSchedule` mantém a prévia do editor inerte, como o resto. */}
      {balaoVisivel(profile, { schedulingMode }) && (
        <BalaoDeConversa
          profile={profile}
          demo={demoChat}
          // Na prévia do editor ele APARECE e não navega — é onde o advogado
          // acabou de ligar o interruptor, e precisa ver o que ligou.
          inert={!canSchedule}
          onDemo={() => setSchedOpen(true)}
        />
      )}

      {/* Única sobreposição que sobrou no perfil, e só na DEMONSTRAÇÃO da home:
          ali a conversa precisa acontecer dentro do telefone, senão não é demo. */}
      <AnimatePresence>
        {schedOpen && demoChat && <AssistantChat profile={profile} onClose={() => setSchedOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

/**
 * Marca de "falta isto aqui", visível SÓ para o dono.
 *
 * Tracejada e em corpo pequeno de propósito: é um bilhete no rascunho, não parte
 * do perfil. Quem chega pelo link nunca vê nada disso — o que o visitante lê
 * continua sendo apenas o que existe de verdade.
 */
function OwnerHint({
  to,
  children,
  className = '',
}: {
  to: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={`t-faint inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-[12px] transition-colors hover:opacity-80 ${className}`}
      style={{ borderColor: 'var(--c-ring)' }}
    >
      + {children}
    </Link>
  )
}

// ---- Filetes e títulos de seção ----
//
// Aqui morava um losango (◆) repetido em três lugares. Ele saiu por completo:
// símbolo decorativo envelhece mal, some no contraste e faz o perfil de um
// advogado parecer convite de casamento. O que separa e hierarquiza agora é
// RÉGUA E TIPO — filete, versalete e entreletra —, que é justamente o idioma do
// impresso jurídico e o que continua legível em qualquer tela.
//
// Cada variante é uma escolha do tema (ThemeStyle.rule), não um enfeite solto.

/** Filete horizontal do tema. `soft` usa a cor de borda; senão, a de acento. */
function Rule({
  className = '',
  soft = false,
  thick = false,
  fade = false,
}: {
  className?: string
  soft?: boolean
  thick?: boolean
  fade?: boolean
}) {
  const color = soft ? 'var(--c-border)' : 'var(--c-ring)'
  return (
    <span
      aria-hidden
      className={className}
      style={{
        height: thick ? 2 : 1,
        // `fade`: o filete se dissolve nas pontas em vez de terminar seco —
        // é o que dá o ar do tema Névoa sem precisar de nenhum símbolo.
        background: fade
          ? `linear-gradient(to right, transparent, ${color} 22%, ${color} 78%, transparent)`
          : color,
      }}
    />
  )
}

/** Separador entre blocos do perfil — a pontuação do documento. */
function ThemeDivider({ type }: { type: RuleStyle }) {
  if (type === 'double') {
    return (
      <div className="my-6 flex flex-col gap-[3px]" aria-hidden>
        <Rule soft />
        <Rule soft />
      </div>
    )
  }
  if (type === 'capline') {
    return <Rule thick className="my-6 w-16" />
  }
  if (type === 'bar') {
    return <Rule thick className="my-6 w-10 rounded-full" />
  }
  if (type === 'tapered') {
    return <Rule fade className="my-6 w-full" />
  }
  return <div className="t-rule mx-auto my-6 max-w-[220px]" />
}

/**
 * Título de seção. A variante do tema decide o ALINHAMENTO e o desenho do
 * filete: centralizado entre duas réguas (clássico), rente à esquerda sob um
 * filete duplo (livro-razão), sob um filete grosso curto (editorial) ou com uma
 * barra sólida de acento na frente (impresso moderno).
 */
function SectionTitle({ children, rule }: { children: React.ReactNode; rule: RuleStyle }) {
  const label = (
    <span
      className="t-faint whitespace-nowrap text-[11px] font-semibold uppercase"
      style={{ letterSpacing: 'var(--label-tracking, 0.18em)' }}
    >
      {children}
    </span>
  )

  if (rule === 'double') {
    return (
      <h2 className="flex flex-col gap-1.5">
        {label}
        <span className="flex flex-col gap-[3px]">
          <Rule soft />
          <Rule soft />
        </span>
      </h2>
    )
  }

  if (rule === 'capline') {
    return (
      <h2 className="flex flex-col items-start gap-2">
        <Rule thick className="w-9" />
        {label}
      </h2>
    )
  }

  if (rule === 'bar') {
    return (
      <h2 className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-3.5 w-[3px] shrink-0 rounded-full"
          style={{ background: 'var(--c-accent)' }}
        />
        {label}
        <Rule soft className="flex-1" />
      </h2>
    )
  }

  // hairline (padrão) e tapered: rótulo centralizado entre dois filetes.
  return (
    <h2 className="flex items-center gap-3">
      <Rule soft={rule !== 'tapered'} fade={rule === 'tapered'} className="flex-1" />
      {label}
      <Rule soft={rule !== 'tapered'} fade={rule === 'tapered'} className="flex-1" />
    </h2>
  )
}

/**
 * O botão de agendar muda de natureza conforme onde está:
 *  • perfil real      → LINK para /:slug/agendar (página com endereço próprio);
 *  • demo da home     → botão que abre a conversa ali dentro do telefone;
 *  • prévia do editor → inerte, só para o advogado ver como fica.
 */
function AcaoAgendar({
  slug,
  demo,
  onDemo,
  inert,
  className,
  children,
}: {
  slug: string
  demo: boolean
  onDemo: () => void
  inert: boolean
  className: string
  children: React.ReactNode
}) {
  if (inert) return <div className={className}>{children}</div>
  if (demo)
    return (
      <button type="button" onClick={onDemo} className={className}>
        {children}
      </button>
    )
  return (
    // Abrir a conversa guiada é uma tentativa de marcar horário como qualquer
    // outra — entra na mesma conta do botão de agendar externo (ver lib/eventos).
    <Link
      to={`/${slug}/agendar`}
      onClick={() => registrarEvento(slug, 'assistente')}
      className={className}
    >
      {children}
    </Link>
  )
}

// Uma pergunta do FAQ. Mesma mecânica do AreaCard (abre/fecha, chevron, mesma
// família visual) com uma marca própria: o "P." e o "R." do texto editorial. É o
// gesto mais antigo de uma página de perguntas impressa, e diz na hora o que é
// pergunta e o que é resposta — sem legenda, sem ícone novo, sem cor nova.
function FaqItem({
  question,
  answer,
  tileClass,
  defaultOpen = false,
}: {
  question: string
  answer: string
  tileClass: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const reduced = useReducedMotion()

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={`${tileClass} flex-col !items-stretch !gap-0 !py-4`}
      style={open ? { borderColor: 'var(--c-accent)' } : undefined}
    >
      <span className="flex w-full items-start gap-2.5">
        <span
          aria-hidden
          className="t-accent mt-[1px] shrink-0 font-display text-[13px] font-semibold leading-[1.45]"
          style={{ letterSpacing: '0.04em' }}
        >
          P.
        </span>
        {/* min-w-0 + break-words: pergunta longa em tela de 320px tem de quebrar
            dentro do tile, nunca empurrar a largura do perfil inteiro. */}
        <span className="min-w-0 flex-1 break-words text-left font-display text-[15.5px] font-semibold leading-snug">
          {question}
        </span>
        <ChevronDown
          width={16}
          height={16}
          className={`t-accent mt-[3px] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </span>
      {open && (
        <motion.span
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }}
          className="block"
        >
          <span className="mt-2.5 flex items-start gap-2.5">
            <span
              aria-hidden
              className="t-faint mt-[1px] shrink-0 font-display text-[13px] font-semibold leading-[1.45]"
              style={{ letterSpacing: '0.04em' }}
            >
              R.
            </span>
            {/* whitespace-pre-line: se o advogado separou a resposta em duas
                linhas, a quebra dele é preservada. */}
            <span className="t-muted min-w-0 flex-1 whitespace-pre-line break-words text-left text-[13.5px] font-normal leading-relaxed">
              {answer}
            </span>
          </span>
        </motion.span>
      )}
    </button>
  )
}

function AreaCard({
  label,
  description,
  tileClass,
  defaultOpen = false,
}: {
  label: string
  description: string
  tileClass: string
  /** a primeira área com texto abre sozinha — ver a chamada em ProfileView */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const hasDesc = description.trim().length > 0

  // Área sem descrição: tile estático e editorial. O nome sozinho, centralizado,
  // com um filete curto de acento acima — o mesmo gesto do timbre, sem símbolo.
  if (!hasDesc) {
    return (
      <div className={`${tileClass} flex-col !items-center !gap-2.5 !py-4 text-center`}>
        <span
          aria-hidden
          className="h-[2px] w-6 rounded-full"
          style={{ background: 'var(--c-accent)' }}
        />
        <span className="font-display text-[16.5px] font-semibold leading-tight">{label}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={`${tileClass} flex-col !items-stretch !gap-0 !py-4`}
      // Item expandido ganha borda fina de acento, diferenciando-o dos demais.
      style={open ? { borderColor: 'var(--c-accent)' } : undefined}
    >
      <span className="flex w-full items-center gap-2.5">
        {/* Barrinha vertical em vez do losango: marca a entrada sem virar
            enfeite, e é a mesma língua visual do resto do perfil. */}
        <span
          aria-hidden
          className="h-4 w-[2px] shrink-0 rounded-full"
          style={{ background: 'var(--c-accent)' }}
        />
        <span className="flex-1 text-left font-display text-[16.5px] font-semibold leading-tight">
          {label}
        </span>
        <ChevronDown
          width={16}
          height={16}
          className={`t-accent shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </span>
      {open && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="t-muted mt-2.5 block text-left text-[13.5px] font-normal leading-relaxed"
        >
          {description}
        </motion.span>
      )}
    </button>
  )
}
