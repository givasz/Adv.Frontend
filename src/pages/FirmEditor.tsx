import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { checkCompliance } from '@/lib/oab'
import {
  blankFirm,
  monogramFrom,
  type Firm,
  type FirmMember,
} from '@/lib/escritorio'
import { FIRM_PRICING, firmMonthlyPrice } from '@/lib/plans'
import { Card, Field, TextArea, TextInput } from '@/components/editor/fields'
import { OabNumberInput } from '@/components/editor/inputs'
import { LogoUpload } from '@/components/escritorio/LogoUpload'
import { AdicionarAdvogado, DarAcesso } from '@/components/escritorio/GestaoAdvogados'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { ScaleIcon, TrashIcon } from '@/components/ui/icons'

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export default function FirmEditor() {
  // O estado é dividido de propósito: `firm` é só o INSTITUCIONAL (o que o
  // autosave grava); a gestão de membros vem do servidor a cada convite/remoção e
  // não pode entrar no corpo do PUT — senão o autosave reescreveria a sociedade.
  const [firm, setFirm] = useState<Firm | null>(null)
  const [gestao, setGestao] = useState<{
    members: FirmMember[]
    seats?: { purchased: number; used: number }
    monthlyPrice?: number
  }>({ members: [] })
  const [saved, setSaved] = useState(true)
  const [saveError, setSaveError] = useState('')
  const [convite, setConvite] = useState('')
  const [conviteErro, setConviteErro] = useState('')
  const [convidando, setConvidando] = useState(false)
  const [rosterErro, setRosterErro] = useState('')

  // Separa a resposta do servidor em institucional (estado editável) e gestão.
  const receber = useCallback((f: Firm): Firm => {
    const { members = [], seats, monthlyPrice, ...institucional } = f
    setGestao({ members, seats, monthlyPrice })
    return institucional as Firm
  }, [])

  useEffect(() => {
    document.title = 'Editor do escritório · advoc.me'
    api.getMyFirm().then((f) => setFirm(f ? receber(f) : blankFirm()))
  }, [receber])

  // Salva com debounce quando há nome (sociedade precisa de nome para existir).
  useEffect(() => {
    if (!firm || !firm.name.trim()) return
    setSaved(false)
    const t = setTimeout(() => {
      api
        .saveFirm(firm)
        .then((s) => {
          setSaved(true)
          setSaveError('')
          const institucional = receber(s)
          if (institucional?.slug && institucional.slug !== firm.slug) {
            setFirm((p) => (p ? { ...p, slug: institucional.slug } : p))
          }
        })
        .catch((e: unknown) => {
          setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar agora.')
        })
    }, 700)
    return () => clearTimeout(t)
  }, [firm, receber])

  // O NOME da sociedade também é conferido: é a maior linha da página institucional,
  // e o servidor recusa salvar se tiver termo vedado (ver firms.service.ts). Fica em
  // um apontamento SEPARADO para o aviso aparecer junto do campo que o causou — um
  // alerta no cartão "Apresentação" sobre um problema no nome mandaria a pessoa
  // procurar no lugar errado.
  const nameIssues = useMemo(() => checkCompliance(firm?.name || ''), [firm?.name])
  const issues = useMemo(
    () => (firm ? [firm.tagline, firm.about].flatMap((t) => checkCompliance(t || '')) : []),
    [firm],
  )

  if (!firm) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const set = (patch: Partial<Firm>) => setFirm((p) => (p ? { ...p, ...patch } : p))
  const setContact = (patch: Partial<Firm['contact']>) =>
    setFirm((p) => (p ? { ...p, contact: { ...p.contact, ...patch } } : p))

  const convidar = async () => {
    const email = convite.trim()
    if (!email || convidando) return
    setConvidando(true)
    setConviteErro('')
    try {
      receber(await api.inviteFirmMember(email))
      setConvite('')
    } catch (e: unknown) {
      setConviteErro(e instanceof Error ? e.message : 'Não foi possível convidar agora.')
    } finally {
      setConvidando(false)
    }
  }

  // Insere um advogado sem conta e sem convite. O nome vai para uma página
  // pública, então o servidor confere os textos e pode recusar — o erro dele é o
  // que a tela mostra.
  const adicionarAdvogado = async (d: { name: string; oabNumber: string; area: string }) => {
    setRosterErro('')
    try {
      receber(await api.addFirmLawyer(d))
      return true
    } catch (e: unknown) {
      setRosterErro(e instanceof Error ? e.message : 'Não foi possível adicionar agora.')
      return false
    }
  }

  // Associa um e-mail a quem já está listado — o passo que lhe dá autonomia.
  const darAcesso = async (m: FirmMember, email: string, role: 'member' | 'admin') => {
    setConviteErro('')
    try {
      receber(await api.linkFirmLawyer(m.id, email, role))
      return true
    } catch (e: unknown) {
      setConviteErro(e instanceof Error ? e.message : 'Não foi possível associar agora.')
      return false
    }
  }

  const removerMembro = async (m: FirmMember) => {
    setConviteErro('')
    try {
      receber(await api.removeFirmMember(m))
    } catch (e: unknown) {
      setConviteErro(e instanceof Error ? e.message : 'Não foi possível remover agora.')
    }
  }

  const seatsUsed = gestao.seats?.used ?? gestao.members.length
  const seatsPurchased = gestao.seats?.purchased ?? Math.max(FIRM_PRICING.includedSeats, seatsUsed)
  const price = gestao.monthlyPrice ?? firmMonthlyPrice(seatsPurchased)

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper-deep">
      <h1 className="sr-only">Editor do escritório — advoc.me</h1>
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <div className="flex items-center gap-3">
            <span
              className={`hidden text-[12px] sm:inline ${saveError ? 'text-burgundy' : 'text-ink-faint'}`}
              aria-live="polite"
            >
              {saveError
                ? 'Não salvo'
                : !firm.name.trim()
                  ? 'Dê um nome à sociedade'
                  : saved
                    ? 'Tudo salvo'
                    : 'Salvando…'}
            </span>
            {firm.slug && (
              <Link to={`/escritorio/${firm.slug}`} target="_blank" className="btn-primary !py-2 !px-4 text-[13px]">
                Ver página
              </Link>
            )}
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {saveError && (
          <p
            role="alert"
            className="rounded-xl2 border border-burgundy/25 bg-burgundy/[0.06] px-4 py-3 text-[13px] text-burgundy"
          >
            {saveError}
          </p>
        )}
        <div className="rounded-xl2 border border-brass/25 bg-brass/[0.06] px-4 py-3 text-[13px] text-ink-soft">
          <span className="font-semibold text-brass-deep">Plano Escritório.</span> Página institucional
          da sociedade + um perfil para cada advogado. O grid é sempre <strong>alfabético</strong> (sem
          hierarquia — Prov. 205/2021).
        </div>

        {/* Sociedade */}
        <Card title="A sociedade">
          <Field label="Nome da sociedade">
            <TextInput
              value={firm.name}
              maxLength={90}
              placeholder="Andrade & Vieira Sociedade de Advogados"
              onChange={(e) => {
                const name = e.target.value
                setFirm((p) => {
                  if (!p) return p
                  const autoMono = !p.monogram || p.monogram === monogramFrom(p.name)
                  return { ...p, name, monogram: autoMono ? monogramFrom(name) : p.monogram }
                })
              }}
            />
          </Field>
          <ComplianceHint issues={nameIssues} />
          {/* Mesmo campo do advogado (OabNumberInput): a UF é uma lista, e o
              número é só número. Era um texto livre com "OAB/SP 12.345
              (Sociedade)" de exemplo — quem digitava saía com uma sigla inventada
              ou o estado escrito por extenso, e não havia nada segurando isso.
              O registro da sociedade tem o mesmo formato do individual; o que muda
              é de quem ele é, e isso o rótulo já diz. */}
          <Field label="Registro da sociedade na OAB" hint="≠ OAB individual">
            <OabNumberInput
              value={firm.oabRegistry}
              onChange={(oabRegistry) => set({ oabRegistry })}
            />
          </Field>

          {/* Sem `Field`: ele envolve o conteúdo num <label>, e um rótulo de campo
              aponta para UM controle. O LogoUpload tem vários (o seletor de
              arquivo escondido, os botões, o campo de link), e o <label> se
              grudava no input de arquivo — o mesmo engano que já tinha acontecido
              no seletor de formato do vídeo. O componente traz o próprio rótulo. */}
          <LogoUpload
            monogram={firm.monogram}
            value={firm.logoUrl}
            onChange={(logoUrl) => set({ logoUrl })}
          />

          {/* O monograma só é editável quando NÃO há logo: com a imagem no ar ele
              deixa de aparecer em qualquer lugar, e um campo que não muda nada na
              tela é um campo que faz a pessoa duvidar do que está vendo. */}
          {!firm.logoUrl && (
            <Field label="Iniciais" hint="usadas enquanto não há logo">
              <TextInput
                value={firm.monogram}
                maxLength={3}
                // `!w-24`: o estilo base do TextInput traz `w-full`, e entre duas
                // utilidades de largura quem vence é a ordem no CSS gerado, não a
                // ordem no atributo. Sem o `!`, o campo de três letras ficava com
                // a largura da tela.
                className="!w-24 text-center"
                onChange={(e) => set({ monogram: e.target.value.toUpperCase() })}
              />
            </Field>
          )}
          <p className="-mt-1 text-[11.5px] leading-relaxed text-ink-faint">
            A conferência do registro da sociedade é feita pela plataforma (não é selo oficial da OAB).
            Cada advogado tem sua própria conferência de OAB individual.
          </p>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <Field label="Cidade">
              <TextInput value={firm.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field label="UF">
              <select
                value={firm.state}
                onChange={(e) => set({ state: e.target.value })}
                aria-label="UF da sociedade"
                className="w-full rounded-lg border border-ink/15 bg-paper-soft px-2 py-2.5 text-[14px] text-ink focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              >
                <option value="">UF</option>
                {UF_LIST.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>
          {firm.slug && (
            <Field label="Endereço da página" hint="gerado do nome">
              <TextInput value={`advoc.me/escritorio/${firm.slug}`} readOnly className="!bg-paper-deep text-ink-faint" />
            </Field>
          )}
        </Card>

        {/* Apresentação */}
        <Card title="Apresentação">
          <Field label="Frase institucional" hint={`${firm.tagline.length}/120`}>
            <TextInput
              value={firm.tagline}
              maxLength={120}
              placeholder="Advocacia empresarial e contenciosa desde 2004."
              onChange={(e) => set({ tagline: e.target.value })}
            />
          </Field>
          <Field label="Sobre o escritório" hint={`${firm.about.length}/1000`}>
            <TextArea
              rows={4}
              value={firm.about}
              maxLength={1000}
              placeholder="Texto institucional sóbrio: áreas de atuação e forma de trabalho, sem promessas, comparações ou captação."
              onChange={(e) => set({ about: e.target.value })}
            />
          </Field>
          <ComplianceHint issues={issues} />
        </Card>

        {/* Marca (white-label) */}
        <Card title="Marca própria (white-label)">
          <Field label="Cor de destaque" hint="aplica na página">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={firm.brandAccent || '#96743f'}
                onChange={(e) => set({ brandAccent: e.target.value })}
                aria-label="Cor de destaque do escritório"
                className="h-10 w-14 cursor-pointer rounded-lg border border-ink/15 bg-paper-soft"
              />
              <TextInput
                value={firm.brandAccent ?? ''}
                placeholder="#96743f"
                onChange={(e) => set({ brandAccent: e.target.value })}
                className="max-w-[140px]"
              />
              {firm.brandAccent && (
                <button
                  type="button"
                  onClick={() => set({ brandAccent: undefined })}
                  className="text-[12.5px] font-medium text-ink-faint hover:text-burgundy"
                >
                  limpar
                </button>
              )}
            </div>
          </Field>
          {/* Mesma verdade da página do advogado: é intenção guardada, não um
              domínio ligado. Ver components/editor/BrandingCard.tsx. */}
          <Field label="Domínio próprio" hint="em preparo — guardamos a sua intenção">
            <TextInput
              value={firm.customDomain ?? ''}
              placeholder="andradevieira.adv.br"
              onChange={(e) => set({ customDomain: e.target.value || undefined })}
            />
          </Field>
        </Card>

        {/* Contato institucional */}
        <Card title="Contato institucional">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefone">
              <TextInput
                value={firm.contact.phone ?? ''}
                placeholder="+55 11 3000-0000"
                onChange={(e) => setContact({ phone: e.target.value || undefined })}
              />
            </Field>
            <Field label="E-mail">
              <TextInput
                type="email"
                value={firm.contact.email ?? ''}
                placeholder="contato@escritorio.adv.br"
                onChange={(e) => setContact({ email: e.target.value || undefined })}
              />
            </Field>
            <Field label="WhatsApp" hint="só dígitos, com DDI">
              <TextInput
                value={firm.contact.whatsapp ?? ''}
                placeholder="5511990000000"
                inputMode="numeric"
                onChange={(e) => setContact({ whatsapp: e.target.value.replace(/\D/g, '') || undefined })}
              />
            </Field>
            <Field label="Instagram">
              <TextInput
                value={firm.contact.instagram ?? ''}
                placeholder="https://instagram.com/…"
                onChange={(e) => setContact({ instagram: e.target.value || undefined })}
              />
            </Field>
            <Field label="LinkedIn">
              <TextInput
                value={firm.contact.linkedin ?? ''}
                placeholder="https://linkedin.com/company/…"
                onChange={(e) => setContact({ linkedin: e.target.value || undefined })}
              />
            </Field>
          </div>
        </Card>

        {/* Assistente virtual da página */}
        <Card title="Assistente virtual">
          <p className="text-[12.5px] leading-relaxed text-ink-faint">
            Na página do escritório, quem quiser falar responde a uma conversa guiada (assunto,
            advogado, formato e preferência de horário) e o pedido chega pronto no WhatsApp. É um
            roteiro fixo: não dá orientação jurídica e não confirma horário.
          </p>
          <Field label="Para onde vai o pedido">
            <div className="grid gap-2">
              <RotaOption
                checked={(firm.assistantRoute ?? 'institutional') === 'institutional'}
                onSelect={() => set({ assistantRoute: 'institutional' })}
                title="WhatsApp do escritório"
                desc="O atendimento fica centralizado com a secretaria. Recomendado."
              />
              <RotaOption
                checked={firm.assistantRoute === 'lawyer'}
                onSelect={() => set({ assistantRoute: 'lawyer' })}
                title="WhatsApp do advogado escolhido"
                desc="Vai direto para quem a pessoa escolheu. Sem escolha ou sem número, volta para o escritório."
              />
            </div>
          </Field>
        </Card>

        {/* Advogados */}
        <Card
          title="Advogados da sociedade"
          action={
            <span className="text-[12px] font-medium text-ink-faint">
              {seatsUsed}/{seatsPurchased} assentos · R$ {price}/mês
            </span>
          }
        >
          <p className="text-[12.5px] leading-relaxed text-ink-faint">
            Inclui {FIRM_PRICING.includedSeats} advogados; a partir do {FIRM_PRICING.includedSeats + 1}º,
            + R$ {FIRM_PRICING.extraSeatPrice}/mês por advogado. Exibidos em ordem alfabética.
          </p>
          <p className="text-[12.5px] leading-relaxed text-ink-faint">
            Cada advogado entra com a <strong>conta dele</strong> e cuida do próprio perfil. Se sair do
            escritório, o perfil continua sendo dele — nada é apagado.
          </p>

          {gestao.members.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink/15 bg-paper-soft px-3 py-4 text-center text-[13px] text-ink-faint">
              Ninguém no escritório ainda. Convide o primeiro advogado pelo e-mail dele.
            </p>
          ) : (
            <ul className="grid gap-2">
              {gestao.members.map((m) => (
                <MemberRow
                  key={`${m.kind}-${m.id}`}
                  member={m}
                  onRemove={() => removerMembro(m)}
                  onLink={darAcesso}
                />
              ))}
            </ul>
          )}

          {/* Inserir um advogado SEM convite prévio. Vem antes do convite por
              e-mail de propósito: é o caminho que resolve o problema de quem está
              montando a página agora e não tem como esperar doze cadastros. */}
          <AdicionarAdvogado
            onAdd={adicionarAdvogado}
            erro={rosterErro}
            ocupados={seatsUsed}
            contratados={seatsPurchased}
          />

          {/* Convite EM LINHA — sem tela sobreposta (ver components/ui/SubPage). */}
          <div className="grid gap-2 rounded-lg border border-ink/10 bg-paper-soft p-3">
            <label htmlFor="convite-email" className="text-[12.5px] font-medium text-ink-soft">
              Convidar advogado que já tem conta
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="convite-email"
                type="email"
                value={convite}
                placeholder="email@doadvogado.adv.br"
                onChange={(e) => setConvite(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void convidar()
                  }
                }}
                className="min-w-[200px] flex-1 rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              />
              <button
                type="button"
                onClick={() => void convidar()}
                disabled={!convite.trim() || convidando}
                className="btn-primary !py-2 !px-4 text-[13px] disabled:opacity-50"
              >
                {convidando ? 'Convidando…' : 'Convidar'}
              </button>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Quem já tem conta recebe o convite no painel. Quem ainda não tem entra pelo cadastro com
              esse mesmo e-mail e o convite aparece lá.
            </p>
            {conviteErro && (
              <p role="alert" className="text-[12.5px] font-medium text-burgundy">
                {conviteErro}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// Escolha do destino do assistente. Rádio de verdade (não um switch decorativo):
// são duas opções excludentes e o teclado precisa navegar entre elas.
function RotaOption({
  checked,
  onSelect,
  title,
  desc,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  desc: string
}) {
  return (
    <label
      className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${
        checked ? 'border-burgundy/40 bg-burgundy/[0.04]' : 'border-ink/12 bg-paper-soft hover:border-brass/50'
      }`}
    >
      <input
        type="radio"
        name="assistant-route"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-faint">{desc}</span>
      </span>
    </label>
  )
}

// Uma pessoa do escritório na visão de quem administra. É deliberadamente uma
// linha de LEITURA: o conteúdo do perfil (bio, área, foto) pertence ao advogado e
// se edita no editor dele, não aqui.
function MemberRow({
  member,
  onRemove,
  onLink,
}: {
  member: FirmMember
  onRemove: () => void
  onLink: (m: FirmMember, email: string, role: 'member' | 'admin') => Promise<boolean>
}) {
  const dono = member.role === 'owner'
  const convidado = member.status === 'invited'
  // Listado pelo escritório e ainda sem e-mail: é a ele que se oferece acesso.
  const listado = member.status === 'listed'
  return (
    // `min-w-0` não é enfeite: esta linha é item de uma GRADE, e item de grade
    // tem `min-width: auto` por padrão — ele se recusa a encolher abaixo do
    // próprio conteúdo. Resultado medido a 360px: a lista com 286px e a linha com
    // 374, vazando 88px para fora. Não aparecia como barra de rolagem porque um
    // ancestral tem `overflow-x-hidden` e simplesmente CORTAVA o excesso: o nome
    // e o selo saíam pela borda direita do cartão.
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ink/10 bg-paper-soft px-3 py-2.5">
      {/* `basis-[11rem]` é o que faz o selo e o botão DESCEREM para a linha de
          baixo quando não cabem, em vez de espremerem o nome até virar "Maria …".
          A quebra do flex é decidida pela base, antes de encolher — sem uma base,
          este bloco cedia todo o espaço e o nome sumia. O `min-w-0` continua para
          o texto poder truncar depois de já ter ganhado a linha inteira. */}
      <div className="min-w-0 flex-1 basis-[11rem]">
        <p className="truncate text-[14px] font-medium text-ink">{member.name}</p>
        <p className="truncate text-[12px] text-ink-faint">
          {[member.oabNumber, member.area, member.email].filter(Boolean).join(' · ') || 'Sem dados ainda'}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          convidado ? 'bg-brass/15 text-brass-deep' : 'bg-ink/[0.06] text-ink-faint'
        }`}
      >
        {dono
          ? 'Responsável'
          : listado
            ? 'Listado'
            : convidado
              ? 'Convite enviado'
              : 'No escritório'}
      </span>
      {/* Só quem foi LISTADO à mão pode receber acesso por aqui: quem já tem
          vínculo tem conta, e quem é convite já tem e-mail. */}
      {listado && <DarAcesso member={member} onLink={onLink} />}
      {!dono && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={convidado ? `Cancelar convite de ${member.name}` : `Remover ${member.name} do escritório`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:bg-burgundy/[0.06] hover:text-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20"
        >
          <TrashIcon width={13} height={13} />
          {convidado ? 'Cancelar' : 'Remover'}
        </button>
      )}
    </li>
  )
}

function ComplianceHint({ issues }: { issues: ReturnType<typeof checkCompliance> }) {
  if (!issues.length) return null
  const blocked = issues.some((i) => i.severity === 'block')
  return (
    <div
      className={`rounded-lg border p-3 text-[12.5px] ${
        blocked
          ? 'border-burgundy/30 bg-burgundy/5 text-burgundy-deep'
          : 'border-brass/40 bg-brass/10 text-brass-deep'
      }`}
    >
      <p className="mb-1 font-semibold">{blocked ? 'Ajuste necessário (OAB)' : 'Atenção (OAB)'}</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {issues.slice(0, 5).map((i, idx) => (
          <li key={idx}>
            <span className="font-medium">“{i.term}”</span> — {i.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}
