import { useEffect } from 'react'
import { HOME } from '@/lib/ogTags'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { sampleProfile } from '@/lib/mockData'
import {
  PLAN_OFFERS,
  REGRAS_DE_COBRANCA,
  RESUMO_DA_COBRANCA,
  SELO_DO_DESTAQUE,
  type PlanOffer,
} from '@/lib/planOffer'
import { FAQ_LIMIT } from '@/lib/plans'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { CompararPlanos } from '@/components/landing/CompararPlanos'
import { PrimeiroContato } from '@/components/landing/PrimeiroContato'
import { AssistantDemo } from '@/components/profile/AssistantDemo'
import { ContratosVitrine } from '@/components/landing/ContratosVitrine'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { useMyProfileLink } from '@/lib/useMyProfileLink'
import { LEGAL_DOCS } from '@/lib/legalContent'
import { OPERADOR, operadorEndereco } from '@/lib/legalIdentity'
import {
  ArrowRight,
  CardIcon,
  ChartIcon,
  CheckIcon,
  CalendarIcon,
  ChevronDown,
  ClockIcon,
  InstagramIcon,
  MessageIcon,
  PaletteIcon,
  PenIcon,
  PlayIcon,
  QrIcon,
  ScaleIcon,
  ShieldIcon,
  SparkIcon,
  WhatsappIcon,
} from '@/components/ui/icons'
import { Marca } from '@/components/ui/Marca'

// A HOME vende, nesta ordem (revisão de 14/09/2026):
//
//   1. o DESEJO — uma presença profissional, num endereço só seu;
//   2. o BENEFÍCIO — apresentar o trabalho e organizar o primeiro contato;
//   3. o DIFERENCIAL — feito para a advocacia, e demonstrado (não descrito);
//   4. os RECURSOS — perfil, triagem, agenda, contratos, cartão…;
//   5. a SEGURANÇA — pensado para as regras de publicidade da advocacia.
//
// Até essa data a página abria por "dentro das regras da OAB" e seguia com o
// risco disciplinar. Ninguém acorda querendo cumprir o Provimento 205; a
// conformidade é o motivo para CONFIAR no produto, não para querê-lo. Ela
// continua aqui — na seção própria, na FAQ e no rodapé —, mas depois de a pessoa
// ter entendido o que ganha.
//
// O que a página NÃO diz, por escolha e por norma: que o advogado consegue mais
// clientes, que o conteúdo sai "aprovado" pela OAB, que um plano é "o mais
// escolhido". Há teste travando o vocabulário (lib/landingCopy.spec.ts).

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

// Anima uma seção ao entrar na viewport (sóbrio, sem exageros).
const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function Landing() {
  // Convidar a "criar meu perfil" quem já tem um (e está logado, com o nome ali
  // do lado no menu de conta) faz o produto parecer que não sabe quem você é.
  const meu = useMyProfileLink()
  // Para quem ainda não tem: "meu advoc.me" — o produto vira uma coisa que a
  // pessoa passa a ter, e não um cadastro que ela faz. Quem já tem vê o próprio
  // destino (painel ou continuar).
  const criar = meu.label === 'Criar meu perfil'
  const rotuloPrincipal = criar ? 'Criar meu advoc.me' : meu.label

  useEffect(() => {
    // O mesmo título do index.html e da borda — um título só para a home.
    document.title = HOME.title
  }, [])

  return (
    // overflow-x-CLIP onde o navegador conhece (hidden fica de reserva): `hidden`
    // transforma esta raiz em contêiner de rolagem, e nada lá dentro gruda de
    // verdade — o seletor de plano da comparação passava direto pelo topo.
    // `clip` corta o estouro lateral sem criar scrollport. Mesmo caso do
    // PublicProfile e do editor.
    <div className="grain min-h-dvh overflow-x-hidden supports-[overflow:clip]:overflow-x-clip">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 font-display text-xl font-semibold">
          <Marca size={32} />
          advoc.me
        </span>
        <div className="flex items-center gap-2 sm:gap-4">
          <a href="#como-funciona" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">
            Como funciona
          </a>
          <a href="#assistente" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">
            Assistente
          </a>
          {/* A partir de 768px: entre 640 e 768 os quatro links brigavam com o
              menu da conta e o botão principal. */}
          <a href="#contratos" className="hidden text-sm font-medium text-ink-soft hover:text-ink md:block">
            Contratos
          </a>
          {/* Quem chega decidido a comparar preço não devia ter de adivinhar que
              precisa rolar até o fim. O link aparece a partir de 480px porque
              abaixo disso ele brigava por espaço com o CTA principal. */}
          <a href="#planos" className="hidden text-sm font-medium text-ink-soft hover:text-ink min-[480px]:block">
            Planos
          </a>
          {/* O perfil público mora no menu do nome: o botão ao lado leva ao
              painel, e alguém que só quer OLHAR a própria página precisa de uma
              porta também. */}
          <AccountMenu perfilTo={meu.perfil} painel={!!meu.perfil} avatarUrl={meu.avatarUrl} />
          {/* No celular esta linha carrega a marca, o nome da conta e este botão.
              Com "Ver meu perfil" por extenso, o texto quebrava em duas linhas e o
              botão virava um bloco alto no canto da tela.

              O que encolhe é o TEXTO, não o alvo: `!py-2.5` continua igual em
              qualquer largura, porque a altura de um botão de dedo não é o lugar
              de economizar espaço. `whitespace-nowrap` fecha a porta de vez —
              sem ele, um rótulo mais longo no futuro quebra de novo, e ninguém
              descobre até abrir num telefone estreito. */}
          <Link
            to={meu.to}
            {...(meu.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            className="btn-primary whitespace-nowrap !py-2.5 !px-4 text-[13.5px] sm:!px-5 sm:text-[14px]"
          >
            <span className="sm:hidden">{meu.short}</span>
            <span className="hidden sm:inline">{meu.label}</span>
          </Link>
        </div>
      </nav>

      {/* Hero — a promessa em uma frase, e o produto de verdade ao lado */}
      <header className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
          <motion.span
            custom={0}
            variants={fade}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[12.5px] font-semibold text-brass-deep"
          >
            <ScaleIcon width={14} height={14} />
            Presença profissional para a advocacia
          </motion.span>

          <motion.h1
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-5 font-display text-[36px] font-semibold leading-[1.04] tracking-tight min-[380px]:text-[44px] sm:text-[58px]"
          >
            Seu escritório
            <br />
            <span className="italic text-burgundy">começa aqui.</span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft"
          >
            Uma página profissional para apresentar a sua advocacia e organizar o primeiro contato de
            quem chega até você — pelo Instagram, pelo WhatsApp ou pelo cartão.
          </motion.p>

          <motion.div
            custom={3}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <Link
              to={meu.to}
              {...(meu.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              className="btn-primary"
            >
              {rotuloPrincipal}
              <ArrowRight width={18} height={18} />
            </Link>
            <a href="#como-funciona" className="btn-ghost">
              Ver como funciona
            </a>
          </motion.div>

          <motion.p
            custom={4}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-4 max-w-md text-[13.5px] leading-relaxed text-ink-faint"
          >
            <span className="font-semibold text-ink">Grátis para começar</span>, sem cartão · pronto em
            minutos · pensado para as regras de publicidade da advocacia
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="lg:justify-self-end"
        >
          <PhonePreview profile={sampleProfile} hero />
        </motion.div>
      </header>

      {/* A objeção que todo advogado tem antes de ler qualquer outra coisa:
          "eu já tenho Instagram e WhatsApp". Respondida sem atacar ninguém —
          cada um faz uma parte, e o advoc.me é a parte que faltava. */}
      <Section
        id="problema"
        eyebrow="Por que não só o Instagram e o WhatsApp?"
        title="Hoje, a sua presença está espalhada."
        intro="O Instagram mostra o seu conteúdo. O WhatsApp começa a conversa. Falta o lugar que reúne quem você é, com o que trabalha e como falar com você — e que organiza esse primeiro contato."
      >
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: <InstagramIcon width={20} height={20} />,
              nome: 'Instagram',
              faz: 'Mostra o seu conteúdo.',
              mas: 'Bom para ser lembrado. Mas a bio tem um link só, e o feed não explica em que você atua nem como marcar uma conversa.',
            },
            {
              icon: <WhatsappIcon width={20} height={20} />,
              nome: 'WhatsApp',
              faz: 'Começa a conversa.',
              mas: 'Direto, mas desorganizado: a mesma pergunta chega dez vezes, sem assunto, sem horário — e no meio da audiência.',
            },
            {
              icon: <Marca size={20} />,
              nome: 'advoc.me',
              faz: 'Reúne e organiza.',
              mas: 'Um endereço só, com apresentação, áreas, contato, horários e as suas perguntas de triagem. É o link que você manda — e o primeiro contato chega pronto no seu WhatsApp.',
              destaque: true,
            },
          ].map((c) => (
            <div
              key={c.nome}
              className={`flex flex-col rounded-xl2 border p-6 ${
                c.destaque
                  ? 'border-burgundy/30 bg-burgundy/[0.05] shadow-card'
                  : 'border-ink/10 bg-paper-soft/60'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl2 ${
                  c.destaque ? 'bg-burgundy text-paper' : 'bg-ink/[0.05] text-ink-soft'
                }`}
              >
                {c.icon}
              </span>
              <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{c.nome}</p>
              <h3 className="mt-1 font-display text-[21px] font-semibold leading-tight text-ink">{c.faz}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{c.mas}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Como funciona — mostrado, não descrito: o perfil, a triagem e o que
          chega no WhatsApp, em três quadros. Ver PrimeiroContato. */}
      <Section
        id="como-funciona"
        eyebrow="Como funciona"
        title="Veja o que o seu cliente encontra — e o que chega para você."
        intro="Três quadros, com um perfil de exemplo e dados fictícios. A mensagem do terceiro é montada pelo mesmo assistente do produto."
        wide
      >
        <PrimeiroContato />

        {/* O fim de uma seção forte tem de dizer o próximo passo. Para MONTAR o
            seu são minutos — e o exemplo inteiro está a um toque. */}
        <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-5 rounded-xl2 border border-ink/10 bg-paper-soft/60 p-6 text-center sm:flex-row sm:text-left">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[19px] font-semibold leading-tight text-ink">
              Para montar o seu: nome, OAB, cidade, áreas e contato.
            </h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
              A IA escreve a apresentação a partir das suas palavras-chave; você revisa, ajusta e
              publica. Não precisa saber programar nem contratar ninguém.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
            <Link
              to={meu.to}
              {...(meu.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              className="btn-primary !py-2.5 text-[14px]"
            >
              {rotuloPrincipal}
            </Link>
            <Link to={`/${sampleProfile.slug}`} className="btn-ghost !py-2.5 text-[14px]">
              Ver um exemplo
            </Link>
          </div>
        </div>
      </Section>

      {/* Assistente de triagem — o grande argumento do Max, com a conversa de
          verdade funcionando ao lado. */}
      <motion.section
        id="assistente"
        variants={rise}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16"
      >
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
              Assistente de triagem · plano Max
            </p>
            <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
              Seu advoc.me continua recebendo os primeiros contatos
              <span className="italic text-burgundy"> enquanto você trabalha.</span>
            </h2>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-ink-soft">
              Em audiência, em reunião ou fora do escritório: quem chega ao seu perfil responde às
              perguntas que você definiu, escolhe um horário livre na sua grade e o pedido chega
              organizado no seu WhatsApp.{' '}
              <span className="font-medium text-ink">
                A avaliação do caso e a decisão de atender continuam sendo suas.
              </span>
            </p>

            {/* A escada Pro → Max, dita em duas frases: o Pro marca horário, o
                Max pergunta antes. É a linha que explica por que o Max existe. */}
            <div className="mt-6 max-w-lg rounded-xl2 border border-brass/30 bg-brass/[0.06] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-soft">
                  Pro
                </span>
                <p className="text-[14px] leading-snug text-ink-soft">
                  O assistente oferece só os seus horários e entrega o pedido pronto no WhatsApp.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-burgundy px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-paper">
                  Max
                </span>
                <p className="text-[14px] leading-snug text-ink">
                  <span className="font-semibold">Ele faz as suas perguntas antes:</span> assunto, se já
                  existe processo, forma de atendimento, um relato curto — as perguntas são suas, na sua
                  ordem.
                </p>
              </div>
            </div>

            <ul className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: <PenIcon width={18} height={18} />,
                  title: 'As perguntas são suas',
                  body: 'Você escreve, ordena e liga uma pergunta à resposta de outra. Há modelos por área para começar — nenhum pede CPF ou documento.',
                },
                {
                  icon: <CalendarIcon width={18} height={18} />,
                  title: 'Sua grade, suas regras',
                  body: 'Dias, horários, duração e antecedência mínima. Marcou algo por fora? Você fecha o horário e ele some das opções.',
                },
                {
                  icon: <WhatsappIcon width={18} height={18} />,
                  title: 'Cai no seu WhatsApp, pronto',
                  body: 'Nome, dia, horário, formato e as respostas chegam numa mensagem só — direto do aparelho de quem pediu, sem passar por nós.',
                },
                {
                  icon: <ScaleIcon width={18} height={18} />,
                  title: 'Sem passar do limite',
                  body: 'Ele se identifica como automático e não dá orientação jurídica. Se perguntarem “tenho direito?”, ele diz que quem avalia é você — e segue.',
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
                    {f.icon}
                  </span>
                  <div>
                    <h3 className="font-display text-[16px] font-semibold text-ink">{f.title}</h3>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#planos" className="btn-primary">
                Conhecer o Max
                <ArrowRight width={17} height={17} aria-hidden />
              </a>
              <p className="text-[13px] text-ink-faint">Experimente a conversa ao lado — é um exemplo.</p>
            </div>
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <AssistantDemo profile={sampleProfile} />
          </div>
        </div>
      </motion.section>

      {/* Contratos e procurações — recurso do Max, com a folha e o canhoto do
          registro desenhados na mesma linguagem das telas de verdade. */}
      <ContratosVitrine />

      {/* Os recursos que não têm seção própria, em uma lista editorial — cada um
          com o plano a partir do qual existe. É o "por que pagar" dito por
          ganho, antes da tabela. */}
      <Section
        eyebrow="O que mais vem com o seu perfil"
        title="Cada recurso resolve uma parte da rotina."
      >
        <ul className="mx-auto grid max-w-5xl gap-x-10 sm:grid-cols-2">
          {RECURSOS.map((r) => (
            <li key={r.title} className="flex gap-4 border-t border-ink/10 py-5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
                {r.icon}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-display text-[17px] font-semibold leading-tight text-ink">{r.title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      r.plano === 'Max'
                        ? 'bg-burgundy text-paper'
                        : r.plano === 'Pro'
                          ? 'border border-ink/15 text-ink-soft'
                          : 'bg-ink/[0.06] text-ink-faint'
                    }`}
                  >
                    {r.plano}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Planos — cada cartão vende uma etapa; a tabela responde o resto */}
      <section id="planos" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-12">
        <p className="text-center text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
          Planos
        </p>
        <h2 className="mx-auto mt-2 max-w-2xl text-center font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Comece grátis. Suba quando fizer sentido.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-ink-soft">
          Cada plano resolve uma etapa: presença, apresentação completa, primeiro atendimento
          organizado, equipe inteira. Preço por mês, sem fidelidade — e o que cada um não inclui está
          escrito no próprio cartão.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_OFFERS.map((oferta) => (
            <PlanCard key={oferta.id} oferta={oferta} />
          ))}
        </div>

        {/* A tabela responde o que os cartões não cabem: "vídeo tem no Pro?",
            "quantos caracteres a bio aceita no Free?". Cada célula vem de
            lib/planOffer.ts, calculada dos mesmos limites que o editor aplica. */}
        <div className="mx-auto mt-14 max-w-4xl">
          <h3 className="text-center font-display text-2xl font-semibold text-ink sm:text-3xl">
            Compare em detalhe
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-center text-[14px] leading-relaxed text-ink-soft">
            Os números são os mesmos limites que o editor aplica. O plano Escritório inclui o Pro
            completo para cada advogado da equipe.
          </p>
          <div className="mt-6">
            <CompararPlanos />
          </div>
        </div>

        {/* Como a cobrança funciona — ANTES de a pessoa clicar em assinar, não
            depois. As linhas são as mesmas do checkout e dos Termos de Uso. */}
        <div className="mx-auto mt-10 max-w-4xl rounded-xl2 border border-ink/10 bg-paper-soft/60 p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldIcon width={20} height={20} className="mt-0.5 shrink-0 text-burgundy" />
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">Como funciona a cobrança</h3>
              <p className="mt-1 text-[13.5px] text-ink-soft">
                O que vale para os planos pagos, escrito antes de você assinar.
              </p>
            </div>
          </div>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {REGRAS_DE_COBRANCA.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                <CheckIcon width={15} height={15} strokeWidth={2.4} className="mt-[3px] shrink-0 text-brass-deep" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[12.5px] text-ink-faint">
            As condições completas estão nos{' '}
            <Link to="/legal/termos" className="font-medium underline underline-offset-2 hover:text-ink">
              Termos de Uso
            </Link>
            .
          </p>
        </div>
      </section>

      {/* A segurança — por último entre os argumentos, e sem virar manual. A OAB
          é o motivo para confiar: uma checagem que sinaliza, um assistente que
          conhece o próprio limite e uma plataforma que não vende destaque. */}
      <Section
        eyebrow="Publicidade na advocacia"
        title="Feito para a realidade de quem advoga."
        intro="A publicidade na advocacia tem regras próprias, e as ferramentas genéricas não foram pensadas para elas. Aqui o cuidado está embutido — sem você precisar decorar nada."
      >
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: <ScaleIcon width={20} height={20} />,
              title: 'Checagem enquanto você escreve',
              body: 'O editor sinaliza possíveis pontos de atenção nas regras de publicidade da advocacia — promessa de resultado, honorários, captação — e sugere como ajustar. A responsabilidade pelo conteúdo continua sendo sua.',
            },
            {
              icon: <MessageIcon width={20} height={20} />,
              title: 'Um assistente que conhece o limite',
              body: 'Ele se identifica como automático, não dá orientação jurídica e não confirma nada. Organiza o primeiro contato; a advocacia é sua. Não há IA nessa conversa — é um roteiro fechado.',
            },
            {
              icon: <ShieldIcon width={20} height={20} />,
              title: 'Sem selo, sem ranking, sem dado de visitante',
              body: 'Nenhum “verificado”, nenhum destaque pago, nenhuma busca. As mensagens vão do aparelho do visitante direto para o seu WhatsApp — não passam por nós. Todo perfil leva à consulta pública do CNA.',
            },
          ].map((c) => (
            <Panel key={c.title}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
                {c.icon}
              </div>
              <h3 className="mt-4 font-display text-[19px] font-semibold leading-tight text-ink">{c.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{c.body}</p>
            </Panel>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-[12.5px] leading-relaxed text-ink-faint">
          O advoc.me é uma plataforma independente: não é filiado à OAB, não constitui aconselhamento
          jurídico e não confere, valida ou endossa inscrições — aponta para a consulta pública do CNA.
        </p>
      </Section>

      {/* FAQ — as perguntas que travam a decisão, e não só as jurídicas */}
      <Section eyebrow="Dúvidas frequentes" title="O que perguntam antes de assinar">
        <div className="mx-auto max-w-2xl divide-y divide-ink/10 rounded-xl2 border border-ink/10 bg-paper-soft/60">
          {FAQ.map((item) => (
            <FaqItem key={item.q} {...item} />
          ))}
        </div>
      </Section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <div className="rule-brass mx-auto mb-8 max-w-xs" />
        <h2 className="font-display text-3xl font-semibold sm:text-5xl">
          Um endereço só seu,
          <br />
          <span className="italic text-burgundy">pronto em minutos.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
          Comece no Free, sem cartão. Suba de plano quando quiser — e volte quando quiser, sem perder
          nada do que escreveu.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={meu.to}
            {...(meu.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            className="btn-primary"
          >
            {rotuloPrincipal}
            <ArrowRight width={18} height={18} />
          </Link>
          <a href="#planos" className="btn-ghost">
            Ver os planos
          </a>
        </div>
      </section>

      <footer className="border-t border-ink/10 py-10 text-center text-[13px] text-ink-faint">
        <nav className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-5">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`} className="hover:text-ink">
              {d.navLabel}
            </Link>
          ))}
          <Link to="/legal" className="hover:text-ink">
            Todos os documentos
          </Link>
        </nav>
        <p>advoc.me · uma ferramenta para perfis segundo o Provimento 205/2021 do CFOAB</p>
        <p className="mt-1">
          Não constitui aconselhamento jurídico. Não filiado à OAB. O conteúdo de cada perfil é de
          responsabilidade do advogado que o publica.
        </p>
        {/* IDENTIFICAÇÃO DO FORNECEDOR — CDC, arts. 6º, III e 31.
            Um site que limita a própria responsabilidade e não diz de quem é a
            responsabilidade limitada dá ao juiz o primeiro motivo para
            relativizar a cláusula. Aqui, no rodapé de toda a landing, e também
            no rodapé de cada perfil público (ver PublicProfile). */}
        <p className="mt-3 text-[12px] text-ink-faint/80">
          © {new Date().getFullYear()} advoc.me · {OPERADOR.razaoSocial} · CNPJ {OPERADOR.cnpj} ·{' '}
          {operadorEndereco()}
        </p>
        <p className="mt-1 text-[12px] text-ink-faint/80">
          Dúvidas sobre os seus dados: veja a{' '}
          <Link to="/legal/privacidade" className="underline underline-offset-2 hover:text-ink">
            Política de Privacidade
          </Link>
          , que diz por onde falar conosco.
        </p>
      </footer>
    </div>
  )
}

// Seção padrão da landing — eyebrow (rótulo), título, uma introdução opcional e
// o conteúdo, com animação sóbria. `wide` solta a largura para quadros lado a lado.
function Section({
  id,
  eyebrow,
  title,
  intro,
  wide = false,
  children,
}: {
  id?: string
  eyebrow: string
  title: string
  intro?: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.section
      id={id}
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16"
    >
      <p className="text-center text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
        {eyebrow}
      </p>
      <h2
        className={`mx-auto mt-2 text-center font-display text-3xl font-semibold leading-tight sm:text-4xl ${
          wide ? 'max-w-3xl' : 'max-w-2xl'
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p className="mx-auto mt-4 max-w-2xl text-center text-[15.5px] leading-relaxed text-ink-soft">
          {intro}
        </p>
      )}
      <div className="mt-10">{children}</div>
    </motion.section>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl2 border border-ink/10 bg-paper-soft/60 p-6 ${className}`}>
      {children}
    </div>
  )
}

// Item de FAQ acessível (nativo <details>), sem estado — expande/recolhe.
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group px-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-[15px] font-semibold text-ink marker:hidden">
        {q}
        <ChevronDown
          width={18}
          height={18}
          className="shrink-0 text-ink-faint transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="pb-4 text-[14px] leading-relaxed text-ink-soft">{a}</p>
    </details>
  )
}

// Os recursos sem seção própria. O plano é o MENOR em que o recurso existe —
// conferido contra lib/plans.ts e lib/aiFeatures.ts: vídeo, gráfica e marca são
// do Max; QR, relatório e endereço limpo, do Pro; a IA da bio e a primeira
// pergunta frequente já vêm no Free.
const RECURSOS: { icon: React.ReactNode; title: string; body: string; plano: 'Free' | 'Pro' | 'Max' }[] = [
  {
    icon: <SparkIcon width={18} height={18} />,
    title: 'A IA escreve a sua apresentação',
    body: 'Descreva a sua atuação em palavras-chave; o texto sai sóbrio, passa pela checagem e só vai ao ar depois da sua aprovação.',
    plano: 'Free',
  },
  {
    icon: <MessageIcon width={18} height={18} />,
    title: 'Perguntas frequentes respondidas',
    body: `As dúvidas de sempre, respondidas uma vez no perfil — ${FAQ_LIMIT.free} no Free, ${FAQ_LIMIT.pro} no Pro, ${FAQ_LIMIT.premium} no Max. Menos mensagens repetidas.`,
    plano: 'Free',
  },
  {
    icon: <QrIcon width={18} height={18} />,
    title: 'Cartão digital com QR Code',
    body: 'QR em alta resolução e o seu contato em vCard, para o cartão, a vitrine do escritório e a assinatura de e-mail.',
    plano: 'Pro',
  },
  {
    icon: <ChartIcon width={18} height={18} />,
    title: 'Relatório do perfil',
    body: 'Visitas, botões usados e horários de maior procura. Contamos acontecimentos, nunca pessoas.',
    plano: 'Pro',
  },
  {
    icon: <ClockIcon width={18} height={18} />,
    title: 'Endereço só com o seu nome',
    body: 'No Free, o endereço leva um número no fim. Nos planos pagos, só o seu nome — o link que cabe num cartão.',
    plano: 'Pro',
  },
  {
    icon: <PlayIcon width={18} height={18} />,
    title: 'Vídeo de apresentação',
    body: 'Um vídeo curto no fim do perfil, para a pessoa saber com quem vai falar antes de escrever.',
    plano: 'Max',
  },
  {
    icon: <CardIcon width={18} height={18} />,
    title: 'Cartão de visita para a gráfica',
    body: 'Frente, verso, sangria e marcas de corte em PDF, com a sua identidade — pronto para imprimir.',
    plano: 'Max',
  },
  {
    icon: <PaletteIcon width={18} height={18} />,
    title: 'Sua cor e sua marca',
    body: 'Cor de destaque, nome do escritório no rodapé e o “criado com advoc.me” some.',
    plano: 'Max',
  },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Preciso saber programar ou contratar alguém para montar?',
    a: 'Não. Você preenche nome, OAB, cidade, áreas e contato; a IA escreve a apresentação a partir das suas palavras-chave, e você revisa. O perfil fica no ar em minutos, e cada seção se edita no painel quando quiser.',
  },
  {
    q: 'Meu perfil é público? Onde eu uso o link?',
    a: 'Sim — é uma página com endereço próprio. Coloque na bio do Instagram, mande pelo WhatsApp quando alguém pedir o seu contato, use na assinatura de e-mail e no QR Code do cartão. Nos planos pagos o endereço leva só o seu nome; no Free, um número no fim.',
  },
  {
    q: 'O que acontece quando alguém entra em contato pelo perfil?',
    a: 'No Free, a pessoa toca em WhatsApp ou e-mail e fala com você. No Pro, o assistente oferece só os dias e horários que você deixou abertos e monta o pedido. No Max, ele faz antes as perguntas que você definiu. Em todos os casos a mensagem sai do aparelho do visitante direto para o seu WhatsApp — nada passa por nós.',
  },
  {
    q: 'Quem configura as perguntas da triagem?',
    a: 'Você, no plano Max. Há modelos por área para começar — nenhum pede CPF, documento ou dado de saúde —, e você escreve, reordena e liga uma pergunta à resposta de outra. O assistente faz exatamente essas perguntas, na sua ordem, sem inventar nenhuma. Dá para testar a conversa no seu próprio perfil antes de publicar.',
  },
  {
    q: 'O assistente substitui o advogado?',
    a: 'Não, e não tenta. Ele é um roteiro fechado: faz as perguntas, oferece os horários e monta a mensagem. Se alguém perguntar “tenho direito?”, ele responde que quem avalia é você e segue. Não há IA nessa conversa — ele não interpreta o que é escrito, só organiza e repassa. A avaliação, a decisão de atender e a confirmação são suas.',
  },
  {
    q: 'As respostas da triagem ficam guardadas no advoc.me?',
    a: 'Não. Elas existem só na conversa aberta no aparelho de quem responde e viram uma mensagem que vai dali para o seu WhatsApp. Não há tela, banco ou relatório nosso com essas respostas — o histórico do atendimento é o seu WhatsApp.',
  },
  {
    q: 'Posso começar de graça? O Free é grátis mesmo?',
    a: 'Sim, e para sempre: publica um perfil completo, sem cartão. O que ele não tem está escrito no próprio cartão do plano — agendamento pelo perfil, mais áreas e perguntas, e o endereço sem número são dos planos pagos.',
  },
  {
    q: 'Posso cancelar quando quiser? Tem fidelidade?',
    a: 'Cobrança mensal, sem fidelidade. Cancele quando quiser: o mês já pago vale até o fim, e em até 7 dias da primeira contratação o valor é devolvido integralmente. Descer de plano ou voltar ao Free não apaga nada — o que exceder o novo plano fica guardado e volta se você voltar.',
  },
  {
    q: 'E o endereço do meu perfil, se eu voltar ao Free?',
    a: 'O endereço sem número é dos planos pagos, então ele volta a ter um número no fim — mas só 7 dias depois, com a data avisada no painel desde o primeiro dia. É tempo para atualizar cartão, QR e links. Passado o prazo, o endereço anterior deixa de abrir. Trocar entre Pro e Max não muda nada nele.',
  },
  {
    q: 'O advoc.me garante que meu conteúdo está de acordo com a OAB?',
    a: 'Não — e nenhuma ferramenta poderia. O que fazemos: enquanto você escreve, o editor sinaliza possíveis pontos de atenção nas regras de publicidade da advocacia, explica a vedação e sugere um ajuste; o que configura violação clara trava a publicação até ser corrigido. É apoio, não garantia: a responsabilidade pelo conteúdo publicado continua sendo do profissional.',
  },
  {
    q: 'O advoc.me é filiado à OAB ou verifica se sou advogado?',
    a: 'Não. Somos uma plataforma independente, sem selo, chancela ou endosso da OAB — as regras vedam isso. Também não verificamos inscrições, e não fingimos que verificamos: todo perfil traz, ao lado do número, um link para a consulta pública do CNA, onde qualquer pessoa confere em segundos.',
  },
  {
    q: 'A apresentação escrita pela IA já sai dentro das regras?',
    a: 'A IA é orientada pelas normas e o texto passa pela mesma checagem de qualquer conteúdo. Ainda assim, nada é publicado sem a sua revisão e aprovação — e ela não inventa formação, anos de atuação ou cargo que você não informou.',
  },
  {
    q: 'Os contratos que eu monto ficam guardados no advoc.me?',
    a: 'Não. O texto, os dados do cliente e os valores ficam no seu aparelho e no PDF que você baixa. O que registramos é só a impressão digital do arquivo, o código impresso no rodapé e a data em que você confirmou a revisão — o bastante para qualquer pessoa conferir depois se o PDF mudou. Montar e registrar documentos é do plano Max.',
  },
]

/**
 * Cartão de um plano na home. Todo o conteúdo vem de `lib/planOffer.ts` — este
 * componente não sabe o nome de recurso nenhum, e é de propósito: enquanto a
 * lista de benefícios morava aqui dentro, ela divergiu do que o produto fazia.
 *
 * O pitch é a manchete do cartão (a etapa que o plano resolve), e o preço vem
 * logo abaixo: quem compara quatro cartões lê primeiro o PORQUÊ de cada um.
 */
function PlanCard({ oferta }: { oferta: PlanOffer }) {
  const { name, price, period, pitch, items, falta, featured, ctaTo, ctaLabel } = oferta
  const pago = oferta.id !== 'free'

  return (
    <div
      className={`relative flex h-full flex-col rounded-xl2 border p-6 ${
        featured
          ? 'border-burgundy bg-burgundy text-paper-soft shadow-lift'
          : 'border-ink/10 bg-paper-soft'
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-brass px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
          {SELO_DO_DESTAQUE}
        </span>
      )}
      <p
        className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${
          featured ? 'text-brass-light' : 'text-brass-deep'
        }`}
      >
        {name}
      </p>
      {/* Altura mínima de três linhas a partir do md: os quatro pitches têm
          tamanhos diferentes, e sem isso o preço de cada cartão ficava numa
          altura — a comparação de preço é a primeira coisa que o olho faz. */}
      <h3 className="mt-2 font-display text-[22px] font-semibold leading-tight md:min-h-[3.45em]">{pitch}</h3>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-4xl font-semibold">{price}</span>
        <span className={`text-[14px] ${featured ? 'text-paper/70' : 'text-ink-faint'}`}>
          {period}
        </span>
      </p>
      {/* Ao lado do preço, como a cobrança funciona — em uma linha. */}
      {pago && (
        <p className={`mt-1.5 text-[12px] font-medium ${featured ? 'text-paper/75' : 'text-ink-faint'}`}>
          {RESUMO_DA_COBRANCA}
        </p>
      )}

      <ul className="mt-6 space-y-2.5 text-[14px] leading-snug">
        {items.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5">
            {item.emPreparo ? (
              // Sem ✓: um recurso que ainda não existe não pode usar a mesma
              // marca dos que existem. O relógio e o rótulo dizem o que é.
              <ClockIcon
                width={16}
                height={16}
                className={`mt-0.5 shrink-0 ${featured ? 'text-paper/50' : 'text-ink-faint'}`}
              />
            ) : (
              <CheckIcon
                width={16}
                height={16}
                strokeWidth={2.4}
                className={`mt-0.5 shrink-0 ${featured ? 'text-brass-light' : 'text-brass-deep'}`}
              />
            )}
            <span
              className={
                item.emPreparo
                  ? featured
                    ? 'text-paper/60'
                    : 'text-ink-faint'
                  : featured
                    ? 'text-paper-soft/95'
                    : 'text-ink-soft'
              }
            >
              {item.text}
              {item.emPreparo && (
                <span
                  className={`ml-1.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                    featured ? 'bg-paper/15 text-paper/70' : 'bg-ink/[0.06] text-ink-faint'
                  }`}
                >
                  em preparo
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* O que o plano NÃO tem. Quem escolhe o Free precisa descobrir aqui que
          não há agendamento — e não meia hora depois, procurando no editor. */}
      {falta && falta.length > 0 && (
        <ul
          className={`mt-4 space-y-2 border-t pt-4 text-[13px] leading-snug ${
            featured ? 'border-paper/15' : 'border-ink/10'
          }`}
        >
          {falta.map((f) => (
            <li
              key={f}
              className={`flex items-start gap-2.5 ${featured ? 'text-paper/65' : 'text-ink-faint'}`}
            >
              <span
                aria-hidden
                className={`mt-[7px] h-px w-3 shrink-0 ${featured ? 'bg-paper/40' : 'bg-ink/25'}`}
              />
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* mt-auto empurra o CTA para a base → botões alinhados entre os cards */}
      <div className="mt-auto pt-7">
        <Link
          to={ctaTo}
          className={`block w-full rounded-full py-3 text-center font-semibold transition-colors ${
            featured
              ? 'bg-paper-soft text-burgundy hover:bg-paper'
              : 'border border-ink/15 hover:border-burgundy/40 hover:text-burgundy'
          }`}
        >
          {ctaLabel}
        </Link>
        {oferta.secondaryTo && oferta.secondaryLabel && (
          <Link
            to={oferta.secondaryTo}
            className={`mt-2.5 block text-center text-[13px] font-medium transition-colors ${
              featured ? 'text-paper/80 hover:text-paper' : 'text-ink-faint hover:text-burgundy'
            }`}
          >
            {oferta.secondaryLabel}
          </Link>
        )}
        {/* Tirar o medo de errar a escolha é o que destrava a decisão: trocar de
            plano não apaga o que já foi escrito. */}
        {pago && (
          <p
            className={`mt-3 text-center text-[11.5px] leading-relaxed ${
              featured ? 'text-paper/70' : 'text-ink-faint'
            }`}
          >
            Troca ou volta ao Free quando quiser — seus textos continuam salvos.
          </p>
        )}
      </div>
    </div>
  )
}

// A tabela comparativa mora em components/landing/CompararPlanos.tsx — com a
// forma própria do celular, onde a tabela rolando de lado não comparava nada.
