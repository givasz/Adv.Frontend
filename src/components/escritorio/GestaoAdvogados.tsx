import { useState } from 'react'
import type { FirmMember } from '@/lib/escritorio'
import { Field, TextInput } from '@/components/editor/fields'
import { OabNumberInput } from '@/components/editor/inputs'

// COMO O ESCRITÓRIO MONTA O QUADRO.
//
// Antes havia um caminho só: convidar por e-mail e esperar. A página da sociedade
// só mostrava quem já tivesse conta E tivesse aceitado o convite — um escritório
// de doze pessoas ficava com a página vazia esperando doze cadastros, e o dono,
// sem nada para mostrar, não tinha por que assinar.
//
// Agora são dois passos, e eles são coisas diferentes de propósito:
//
//   1. LISTAR (AdicionarAdvogado) — o escritório diz quem é do quadro. A página
//      fica pronta hoje. A pessoa não ganha acesso a nada.
//   2. DAR ACESSO (DarAcesso) — associa um e-mail e convida. Aí sim ela entra,
//      com a autonomia que o dono escolher.
//
// Separar os dois é o ponto: o primeiro é o escritório falando SOBRE alguém; o
// segundo é convidar essa pessoa a falar por si.

export function AdicionarAdvogado({
  onAdd,
  erro,
  ocupados,
  contratados,
}: {
  onAdd: (d: { name: string; oabNumber: string; area: string }) => Promise<boolean>
  erro: string
  ocupados: number
  contratados: number
}) {
  const [aberto, setAberto] = useState(false)
  const [name, setName] = useState('')
  const [oab, setOab] = useState('')
  const [area, setArea] = useState('')
  const [salvando, setSalvando] = useState(false)

  const enviar = async () => {
    if (!name.trim() || salvando) return
    setSalvando(true)
    const ok = await onAdd({ name: name.trim(), oabNumber: oab, area: area.trim() })
    setSalvando(false)
    if (ok) {
      setName('')
      setOab('')
      setArea('')
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-ghost w-full !py-2.5 text-[13px]"
      >
        + Adicionar advogado do escritório
      </button>
    )
  }

  return (
    <div className="grid gap-3 rounded-lg border border-ink/10 bg-paper-soft p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-soft">Adicionar advogado</span>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-[12px] font-medium text-ink-faint hover:text-burgundy"
        >
          Fechar
        </button>
      </div>

      {/* O aviso vem ANTES dos campos, e não depois: quem já digitou não lê mais.
          E não é formalidade — aqui se publica o nome e a inscrição de um TERCEIRO
          numa página aberta, sem essa pessoa ter tocado em nada. A plataforma não
          confere inscrição de ninguém (nem a individual, ver REGRAS.md), então
          quem responde é quem listou, e isso tem de estar escrito na hora. */}
      <p className="rounded-lg border border-burgundy/25 bg-burgundy/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-soft">
        <strong className="font-semibold text-burgundy">Só quem é do escritório.</strong> Ao inserir
        um advogado aqui, você publica o nome e a inscrição dele na sua página e declara que ele
        integra a sociedade. Listar quem não integra é declaração falsa, de responsabilidade de quem
        listou — o advoc.me não confere inscrições e não responde por isso.
      </p>

      <Field label="Nome do advogado">
        <TextInput
          value={name}
          maxLength={70}
          placeholder="Como consta na inscrição"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="OAB" hint="opcional">
          <OabNumberInput value={oab} onChange={setOab} />
        </Field>
        <Field label="Área principal" hint="opcional">
          <TextInput
            value={area}
            maxLength={60}
            placeholder="Direito de Família"
            onChange={(e) => setArea(e.target.value)}
          />
        </Field>
      </div>

      {erro && (
        <p role="alert" className="text-[12.5px] font-medium text-burgundy">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-ink-faint">
          {ocupados} de {contratados} advogados
        </span>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={!name.trim() || salvando}
          className="btn-primary !py-2 !px-4 text-[13px] disabled:opacity-50"
        >
          {salvando ? 'Adicionando…' : 'Adicionar'}
        </button>
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        Ele aparece na página imediatamente. Dar acesso à conta é um passo separado — depois, você
        associa um e-mail a ele na lista acima.
      </p>
    </div>
  )
}

export function DarAcesso({
  member,
  onLink,
}: {
  member: FirmMember
  onLink: (m: FirmMember, email: string, role: 'member' | 'admin') => Promise<boolean>
}) {
  const [aberto, setAberto] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    if (!email.trim() || enviando) return
    setEnviando(true)
    const ok = await onLink(member, email.trim(), role)
    setEnviando(false)
    if (ok) {
      setEmail('')
      setAberto(false)
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="shrink-0 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:border-brass/50 hover:bg-brass/[0.08] hover:text-brass-deep"
      >
        Dar acesso
      </button>
    )
  }

  return (
    // `basis-full` para ocupar a linha inteira: o pai é um flex que quebra, e um
    // formulário espremido ao lado do nome não teria onde caber.
    <div className="mt-2 w-full basis-full rounded-lg border border-ink/10 bg-paper p-2.5">
      <label className="block text-[12px] font-medium text-ink-soft">
        E-mail de {member.name}
        <input
          type="email"
          value={email}
          placeholder="email@doadvogado.adv.br"
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
      </label>

      {/* Duas opções escritas por extenso, e não um seletor de "papel": o que o
          dono decide aqui é o alcance da autonomia, não um jargão de sistema. */}
      <fieldset className="mt-2.5">
        <legend className="text-[12px] font-medium text-ink-soft">O que ele vai poder fazer</legend>
        <div className="mt-1.5 grid gap-1.5">
          <OpcaoDeAcesso
            checked={role === 'member'}
            onSelect={() => setRole('member')}
            title="Só o próprio perfil"
            desc="Edita a página dele. Não mexe na sociedade nem chama ninguém."
          />
          <OpcaoDeAcesso
            checked={role === 'admin'}
            onSelect={() => setRole('admin')}
            title="O escritório todo"
            desc="Edita a página da sociedade e pode chamar outros advogados."
          />
        </div>
      </fieldset>

      <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="btn-ghost !py-1.5 !px-3 text-[12px]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={!email.trim() || enviando}
          className="btn-primary !py-1.5 !px-3 text-[12px] disabled:opacity-50"
        >
          {enviando ? 'Associando…' : 'Associar e convidar'}
        </button>
      </div>

      {/* Honesto sobre o caminho real: a plataforma ainda não envia e-mail (ver
          docs/plano-admin.md, fase 2), então o convite chega no painel de quem
          entrar com esse endereço. Prometer "vai receber um e-mail" seria
          prometer o que não sai. */}
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
        O convite aparece no painel dele ao entrar com esse e-mail. Até aceitar, ele continua
        listado na página como está agora.
      </p>
    </div>
  )
}

// Rádio de verdade (não um botão que finge): são opções excludentes e o teclado
// precisa navegar entre elas com as setas.
function OpcaoDeAcesso({
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
      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors ${
        checked ? 'border-brass bg-brass/[0.07]' : 'border-ink/10 hover:border-brass/40'
      }`}
    >
      <input
        type="radio"
        name="acesso-do-advogado"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-faint">{desc}</span>
      </span>
    </label>
  )
}
