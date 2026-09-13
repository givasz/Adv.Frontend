import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, DocIcon, FingerprintIcon, LockIcon, PenIcon } from '@/components/ui/icons'

// A vitrine de Contratos e procurações na home — recurso do plano Max.
//
// O que ela pode dizer é exatamente o que o recurso faz (ver
// lib/contratos/avisos.spec.ts, que também lê este arquivo): minuta por modelo,
// revisão do advogado, PDF com código e impressão digital registrada, e
// conferência por qualquer pessoa. Nada de "validade garantida", "verificado",
// PDF/A ou assinatura pela plataforma — nenhuma dessas coisas existe.
//
// A ilustração é uma folha e um canhoto de protocolo desenhados em HTML: é a
// mesma linguagem das telas de verdade (FolhaDoDocumento, ReciboDeRegistro), e
// não uma foto de contrato genérico. Decorativa — o texto ao lado diz tudo.

const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

const PONTOS = [
  {
    icon: <DocIcon width={18} height={18} />,
    title: 'Quatro modelos prontos',
    body: 'Contrato de honorários, procuração, substabelecimento e declaração de hipossuficiência — e até 3 modelos escritos por você, só com texto.',
  },
  {
    icon: <PenIcon width={18} height={18} />,
    title: 'A revisão é sua',
    body: 'Você lê e edita cada cláusula antes de gerar o PDF. A minuta sai de modelo fixo, sem inteligência artificial.',
  },
  {
    icon: <FingerprintIcon width={18} height={18} />,
    title: 'PDF com registro',
    body: 'Cada documento ganha um código no rodapé, e a impressão digital do arquivo fica registrada. Qualquer pessoa confere depois se ele mudou.',
  },
  {
    icon: <LockIcon width={18} height={18} />,
    title: 'O contrato não vem para cá',
    body: 'Texto, CPF e valores do cliente ficam no seu aparelho e no PDF. Guardamos só a impressão digital do arquivo.',
  },
]

export function ContratosVitrine() {
  return (
    <motion.section
      id="contratos"
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[auto_1fr]">
        {/* Ilustração à esquerda no computador; no celular, depois do texto. */}
        <div className="order-2 justify-self-center lg:order-1 lg:justify-self-start" aria-hidden>
          <FolhaIlustrada />
        </div>

        <div className="order-1 lg:order-2">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-brass-deep">
            Novo · plano Max
          </p>
          <h2 className="mt-3 max-w-lg text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Contratos e procurações,
            <span className="italic text-burgundy"> revisados por você.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
            Monte a minuta a partir de um modelo, ajuste cada cláusula ao caso e baixe o PDF pronto para
            assinar com a sua conta gov.br ou o seu certificado digital.
          </p>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2">
            {PONTOS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy" aria-hidden>
                  {p.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-[16px] font-semibold text-ink">{p.title}</h3>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#planos" className="btn-primary">
              Ver o plano Max
              <ArrowRight width={17} height={17} aria-hidden />
            </a>
            <Link to="/contratos/conferir" className="btn-ghost">
              Conferir um documento
            </Link>
          </div>
          <p className="mt-4 max-w-md text-[12.5px] leading-relaxed text-ink-faint">
            Os modelos são ponto de partida: o conteúdo final e a responsabilidade por ele são do
            advogado. O registro confirma que o arquivo não mudou — não atesta o conteúdo nem a validade
            do documento.
          </p>
        </div>
      </div>
    </motion.section>
  )
}

// Folha de papel com um canhoto de protocolo por cima. Barras no lugar do texto:
// o que se quer mostrar é a FORMA do produto, não um contrato para ler de longe.
function FolhaIlustrada() {
  const linha = (w: string, key: number) => (
    <span key={key} className={`block h-[5px] rounded-full bg-ink/[0.13] ${w}`} />
  )
  return (
    <div className="relative w-[290px] max-w-full pb-14 pr-6 min-[380px]:w-[330px]">
      {/* folha de trás, para dar pilha */}
      <div className="absolute left-3 top-3 h-[360px] w-[calc(100%-1.5rem)] rotate-[2.5deg] rounded-[6px] border border-ink/10 bg-paper-soft shadow-card" />

      <div className="relative h-[372px] rounded-[6px] border border-ink/10 bg-[#fffdf8] px-6 py-7 shadow-lift">
        <span className="absolute inset-y-0 left-3 w-px bg-burgundy/[0.12]" />
        <span className="absolute right-4 top-3 text-[8.5px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          Minuta
        </span>
        <p className="text-center font-display text-[11.5px] font-semibold uppercase leading-snug tracking-[0.06em] text-ink">
          Procuração ad judicia
          <br />
          et extra
        </p>
        <span className="rule-brass mx-auto mt-2.5 block w-14" />

        <div className="mt-5 space-y-4">
          {[
            ['Outorgante', ['w-full', 'w-11/12', 'w-2/3']],
            ['Outorgada', ['w-full', 'w-4/5']],
            ['Poderes', ['w-full', 'w-full', 'w-10/12', 'w-3/5']],
          ].map(([t, ls]) => (
            <div key={t as string}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-brass-deep">{t as string}</p>
              <div className="mt-1.5 space-y-2">{(ls as string[]).map((w, i) => linha(w, i))}</div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex justify-center">
          <div className="w-1/2 text-center">
            <span className="block border-t border-ink/50" />
            <span className="mx-auto mt-1.5 block h-[5px] w-2/3 rounded-full bg-ink/20" />
          </div>
        </div>
      </div>

      {/* Canhoto do registro */}
      <div className="absolute -bottom-1 right-0 w-[210px] -rotate-[4deg] rounded-xl2 border border-ink/10 bg-paper-soft px-4 pb-3.5 pt-4 shadow-lift">
        <span className="absolute inset-x-4 top-0 h-2 -translate-y-1/2 bg-[radial-gradient(circle,#ebe3d3_2.5px,transparent_3px)] bg-[length:12px_8px] bg-repeat-x" />
        <p className="text-[8.5px] font-semibold uppercase tracking-[0.16em] text-brass-deep">Documento registrado</p>
        <p className="mt-1 font-mono text-[16px] font-semibold tracking-[0.08em] text-ink" translate="no">
          AVM-7K2P-9QXD
        </p>
        <p className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-ink-soft">
          <FingerprintIcon width={11} height={11} className="text-brass-deep" />
          Impressão digital (SHA-256)
        </p>
        <p className="mt-0.5 font-mono text-[8.5px] leading-snug text-ink-faint" translate="no">
          5b980a0e0eb4f225 7bd628d5ab8d1b11
        </p>
      </div>
    </div>
  )
}
