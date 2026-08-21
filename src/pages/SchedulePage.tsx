import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { resolveSchedulingMode } from '@/lib/booking'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { AssistantChat } from '@/components/profile/AssistantChat'
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

  // Assistente: a conversa guiada ocupa a página inteira. Ela já tem cabeçalho e
  // rodapé próprios, então entra sem o esqueleto de formulário.
  if (modo === 'assistant') {
    return <AssistantChat profile={profile} onClose={() => navigate(voltar)} fullPage />
  }

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
  const ready = !!wa && subject.trim().length > 0
  const href = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : undefined

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
          href={ready ? href : undefined}
          target="_blank"
          rel="noreferrer noopener"
          aria-disabled={!ready}
          onClick={(e) => {
            if (!ready) e.preventDefault()
          }}
          className={`btn-primary w-full !py-3 ${ready ? '' : 'pointer-events-none opacity-50'}`}
        >
          <WhatsappIcon width={18} height={18} />
          Enviar no WhatsApp
          <ArrowRight width={16} height={16} />
        </a>

        {!wa ? (
          <p className="text-center text-[12px] text-brass-deep">
            Este perfil ainda não informou um WhatsApp.
          </p>
        ) : (
          <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
            Contato informativo. Nenhuma orientação jurídica é prestada antes da análise do caso.
          </p>
        )}
      </div>
    </SubPage>
  )
}
