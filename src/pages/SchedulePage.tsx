import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { resolveSchedulingMode } from '@/lib/booking'
import { isExampleSlug } from '@/lib/perfilPublico'
import { HREF_DE_EXEMPLO, oQueAconteceria } from '@/lib/exemplo'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { comoAbrirWhatsapp, whatsappHref } from '@/lib/whatsapp'
import { AssistantChat } from '@/components/profile/AssistantChat'
import { MeetingRequestForm } from '@/components/profile/MeetingRequestForm'
import { PrivacyNote } from '@/components/ui/PrivacyNote'
import { ArrowRight, CalendarIcon, WhatsappIcon } from '@/components/ui/icons'

// Agendar uma conversa — /:slug/agendar.
//
// Duas formas de atender ao mesmo pedido, escolhidas pelo advogado no editor:
//   • assistant → conversa guiada (AssistantChat), que oferece só a grade dele;
//   • whatsapp  → formulário curto que vira mensagem pronta no WhatsApp.
// As duas eram folhas sobrepostas. Viraram esta página: no celular a conversa
// ocupa a tela inteira (era o pior caso do modal — teclado subindo, altura
// espremida, rolagem dupla) e o voltar do navegador desfaz o passo.
export default function SchedulePage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const voltar = useVoltar(`/${slug}`)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [when, setWhen] = useState('')
  // Tocou em "Enviar" num perfil de exemplo. Declarado aqui em cima, com os
  // outros: um hook depois das saídas antecipadas abaixo é a tela branca do
  // React #310 (ver scripts/smoke.mjs).
  const [avisoDeExemplo, setAvisoDeExemplo] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .getProfile(slug)
      .then((p) => {
        if (!alive) return
        if (p) {
          setProfile(p)
          setState('ready')
        } else setState('notfound')
      })
      .catch(() => alive && setState('notfound'))
    return () => {
      alive = false
    }
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  if (state === 'notfound' || !profile) {
    return (
      <SubPage title="Perfil não encontrado" backTo="/" backLabel="Início">
        <p className="text-[14px] text-ink-soft">
          O endereço <span className="font-medium text-ink">advoc.me/{slug}</span> não existe ou saiu
          do ar.
        </p>
      </SubPage>
    )
  }

  const modo = resolveSchedulingMode(profile)
  const primeiro = profile.name.split(' ')[0]

  if (modo === 'off' || modo === 'external') {
    return <SubPage title="Agendamento indisponível" subtitle="Este perfil não recebe pedidos de horário por aqui."
      icon={<CalendarIcon width={18} height={18} />} backTo={voltar} backLabel="Voltar ao perfil">
      <p className="text-[14px] text-ink-soft">Volte ao perfil para ver os canais de contato escolhidos pelo advogado.</p>
    </SubPage>
  }

  // Assistente: a conversa guiada ocupa a página inteira. Ela já tem cabeçalho e
  // rodapé próprios, então entra sem o esqueleto de formulário. (No perfil de
  // exemplo, o fim dela também não sai daqui — quem cuida disso é ela mesma.)
  if (modo === 'assistant') {
    return <AssistantChat profile={profile} onClose={() => navigate(voltar)} fullPage />
  }

  if (profile.plan === 'premium' && profile.meetingInboxEnabled && modo === 'whatsapp') {
    return (
      <SubPage title="Solicitar uma reunião" subtitle={`Deixe seu contato para ${primeiro} responder. A solicitação não confirma o horário.`}
        icon={<CalendarIcon width={18} height={18} />} backTo={voltar} backLabel="Voltar ao perfil"
        documentTitle={`Solicitar reunião com ${profile.name}`}>
        <div className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-6">
          <MeetingRequestForm slug={profile.slug} demo={isExampleSlug(profile.slug)} />
        </div>
      </SubPage>
    )
  }

  // Perfil de exemplo: o número é inventado e pode ser de alguém de verdade. O
  // botão continua lá (é o que se está demonstrando), mas não abre o WhatsApp —
  // diz o que faria. Ver lib/exemplo.ts.
  const exemplo = isExampleSlug(profile.slug)

  const wa = profile.contact.whatsapp
  const areas = profile.areas.filter((a) => a.label.trim())
  const message = [
    'Olá! Vim pelo seu perfil no advoc.me e gostaria de agendar uma consulta.',
    name.trim() && `Meu nome é ${name.trim()}.`,
    subject.trim() && `Assunto: ${subject.trim()}`,
    when.trim() && `Preferência de dia/horário: ${when.trim()}`,
  ]
    .filter(Boolean)
    .join('\n')
  // O número passa por whatsappHref, que sabe o formato do wa.me (só dígitos,
  // com DDI) — montar a URL à mão aqui deixava um "+55 (11) …" gravado pela API
  // virar link morto, e a mensagem não chega a lugar nenhum sem deixar rastro.
  const href = whatsappHref(wa, message)
  // `href`, e não `wa`: número gravado que não forma link não pode habilitar o
  // botão. Melhor não oferecer do que oferecer e não funcionar.
  const ready = !!href && subject.trim().length > 0

  const inputCls =
    'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink ' +
    'placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

  return (
    <SubPage
      title="Agendar uma consulta"
      subtitle={`Conte o assunto e sua preferência de horário — a mensagem vai pronta para o WhatsApp de ${primeiro}.`}
      icon={<CalendarIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar ao perfil"
      documentTitle={`Agendar com ${profile.name}`}
    >
      <div className="space-y-4 rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">
            Seu nome <span className="font-normal text-ink-faint">· opcional</span>
          </span>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como podemos te chamar"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">Assunto da consulta</span>
          {areas.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSubject(a.label)}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    subject === a.label
                      ? 'border-burgundy bg-burgundy/[0.06] text-burgundy'
                      : 'border-ink/15 text-ink-soft hover:border-brass/50'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <input
            className={inputCls}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex.: divórcio consensual"
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">
            Preferência de dia e horário
          </span>
          <input
            className={inputCls}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="Ex.: terça de manhã, ou 15/08 às 14h"
          />
        </label>

        <a
          href={ready ? (exemplo ? HREF_DE_EXEMPLO : href) : undefined}
          {...(exemplo ? {} : comoAbrirWhatsapp())}
          aria-disabled={!ready}
          onClick={(e) => {
            if (!ready || exemplo) e.preventDefault()
            if (ready && exemplo) setAvisoDeExemplo(true)
          }}
          className={`btn-primary w-full !py-3 ${ready ? '' : 'pointer-events-none opacity-50'}`}
        >
          <WhatsappIcon width={18} height={18} />
          Enviar no WhatsApp
          <ArrowRight width={16} height={16} />
        </a>

        {/* A região fica no DOM desde o início: leitor de tela só anuncia o que
            muda dentro de uma região que já existia. */}
        <div role="status" aria-live="polite">
          {avisoDeExemplo && (
            <p className="rounded-lg bg-ink px-3.5 py-2.5 text-center text-[12.5px] leading-snug text-paper">
              {oQueAconteceria('whatsapp', primeiro)} Como este é um perfil de exemplo, nada foi
              enviado.
            </p>
          )}
        </div>

        {!wa ? (
          <p className="text-center text-[12px] text-brass-deep">
            Este perfil ainda não informou um WhatsApp.
          </p>
        ) : (
          <>
            <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
              Contato informativo. Nenhuma orientação jurídica é prestada antes da análise do caso.
            </p>
            <PrivacyNote fluxo="formulario" className="text-center" />
          </>
        )}
      </div>
    </SubPage>
  )
}
