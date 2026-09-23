import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useSalvarAntesDeSair } from '@/lib/salvarAntesDeSair'
import { useMyProfileLink } from '@/lib/useMyProfileLink'
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
import { CidadeUfCampos } from '@/components/editor/CidadeInput'
import { EnderecoCampos } from '@/components/editor/EnderecoCampos'
import { LogoUpload } from '@/components/escritorio/LogoUpload'
import { AdicionarAdvogado, DarAcesso } from '@/components/escritorio/GestaoAdvogados'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { CalendarIcon, ChartIcon, TrashIcon } from '@/components/ui/icons'
import { Marca } from '@/components/ui/Marca'

export default function FirmEditor() {
  // O estado é dividido de propósito: `firm` é só o INSTITUCIONAL (o que o
  // autosave grava); a gestão de membros vem do servidor a cada convite/remoção e
  // não pode entrar no corpo do PUT — senão o autosave reescreveria a sociedade.
  const [firm, setFirm] = useState<Firm | null>(null)
  // Só para a foto no chip da conta: o editor do escritório não tem o perfil
  // pessoal em mãos, e o chip ficava na inicial.
  const meu = useMyProfileLink()
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
  // O que está em voo fica em `pendente`, para ser gravado se a tela sumir.
  const pendente = useRef<Firm | null>(null)
  useEffect(() => {
    if (!firm || !firm.name.trim()) return
    pendente.current = firm
    setSaved(false)
    const t = setTimeout(() => {
      api
        .saveFirm(firm)
        .then((s) => {
          if (pendente.current === firm) pendente.current = null
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

  // Fechar a aba, trocar de app ou navegar grava o que estiver em voo — ver
  // lib/salvarAntesDeSair.
  useSalvarAntesDeSair<Firm>({
    pendente: () => pendente.current,
    salvar: (f, sumindo) =>
      api
        .saveFirm(f, { keepalive: sumindo })
        .then(() => {
          if (pendente.current === f) pendente.current = null
        })
        .catch(() => undefined),
  })

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
  // A abertura do assistente e os assuntos também são texto público, e o servidor
  // recusa o save com vedação neles. Cada um tem o próprio apontamento para o
  // aviso aparecer junto do campo que o causou.
  const assistantIssues = useMemo(
    () => checkCompliance(firm?.assistantGreeting || ''),
    [firm?.assistantGreeting],
  )
  const areaIssues = useMemo(
    () => (firm?.extraAreas ?? []).flatMap((a) => checkCompliance(a)),
    [firm?.extraAreas],
  )
  // Os assuntos que já entram sozinhos, pela área principal de cada advogado: é o
  // que a lista abaixo mostra como fixo, para o dono não reescrever o que já existe.
  const derivadosDosAdvogados = useMemo(() => {
    const vistos = new Set<string>()
    return (firm?.lawyers ?? [])
      .map((l) => (l.area ?? '').trim())
      .filter((a) => {
        const chave = a.toLowerCase()
        if (!a || vistos.has(chave)) return false
        vistos.add(chave)
        return true
      })
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [firm?.lawyers])

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
    // overflow-x-CLIP onde há suporte: `hidden` cria contêiner de rolagem, e o
    // cabeçalho sticky logo abaixo nunca grudava — o mesmo caso da home.
    <div className="min-h-dvh overflow-x-hidden bg-paper-deep supports-[overflow:clip]:overflow-x-clip">
      <h1 className="sr-only">Editor do escritório — advoc.me</h1>
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <Marca size={29} />
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
            <AccountMenu compact painel avatarUrl={meu.avatarUrl} />
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

        {/* As duas telas que não editam a página, mas são do escritório: o que
            chega por ela e o movimento dela. Aqui em cima porque são o trabalho
            RECORRENTE de quem administra — editar o institucional se faz uma vez. */}
        {firm.slug && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <AtalhoDoEscritorio
              to="/escritorio/solicitacoes"
              titulo="Solicitações"
              texto={
                firm.meetingInboxEnabled
                  ? 'Pedidos que chegaram pela página. Encaminhe a um advogado do escritório.'
                  : 'Desligada. Hoje a conversa da página termina no WhatsApp.'
              }
              icone={<CalendarIcon width={17} height={17} />}
            />
            <AtalhoDoEscritorio
              to="/escritorio/visitas"
              titulo="Visitas"
              texto="Quantas vezes a página foi aberta e o que foi usado nela."
              icone={<ChartIcon width={17} height={17} />}
            />
          </div>
        )}

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
          <CidadeUfCampos
            city={firm.city}
            state={firm.state}
            onChange={({ city, state }) => set({ city, state })}
          />
          {firm.slug && (
            <Field label="Endereço da página" hint="gerado do nome">
              <TextInput value={`advoc.me/escritorio/${firm.slug}`} readOnly className="!bg-paper-deep text-ink-faint" />
            </Field>
          )}
        </Card>

        {/* Endereço da sede. É no escritório que ele mais fazia falta: uma
            sociedade tem porta física, e a página institucional dizia só a
            cidade — quem ia até lá tinha de perguntar o resto por mensagem. */}
        <Card title="Endereço da sede">
          <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
            Opcional. Aparece na página do escritório com um botão que abre o mapa.
          </p>
          <EnderecoCampos
            address={firm.address}
            city={firm.city}
            state={firm.state}
            onChange={(address) => set({ address })}
            onLocal={({ city, state }) => set({ city, state })}
          />
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
            advogado, formato e quando) e o pedido chega pronto a quem vai responder. Quem escolhe
            um advogado com a agenda ligada vê os horários livres dessa agenda; nos outros casos, a
            conversa pergunta dia e período. É um roteiro fixo: não dá orientação jurídica e não
            confirma horário.
          </p>

          {/* A abertura é a primeira frase que o visitante lê. Ela passa pela
              mesma checagem da OAB que a frase institucional — por isso o aviso
              em linha, e não só a recusa ao salvar. */}
          <Field
            label="Como o assistente abre a conversa"
            hint="Opcional. Vazio = a abertura padrão, que já diz que o atendimento é automático."
          >
            <TextInput
              value={firm.assistantGreeting ?? ''}
              onChange={(e) => set({ assistantGreeting: e.target.value })}
              maxLength={180}
              placeholder="Olá! Sou o assistente virtual do escritório."
            />
            <ComplianceHint issues={assistantIssues} />
          </Field>

          <Field label="Para onde vai o pedido">
            <div className="grid gap-2">
              <RotaOption
                checked={(firm.assistantRoute ?? 'institutional') === 'institutional'}
                onSelect={() => set({ assistantRoute: 'institutional' })}
                title="Para o escritório"
                desc="O atendimento fica centralizado com a secretaria. Recomendado."
              />
              <RotaOption
                checked={firm.assistantRoute === 'lawyer'}
                onSelect={() => set({ assistantRoute: 'lawyer' })}
                title="Para o advogado escolhido"
                desc="Vai direto para quem a pessoa escolheu. Sem escolha, ou sem canal dele, volta para o escritório."
              />
            </div>
          </Field>

          {/* Caixa de solicitações: a alternativa ao WhatsApp. Ligar significa
              passar a GUARDAR nome, contato e assunto de visitante — a decisão é
              de quem responde pelo escritório, e o texto diz isso sem rodeio. */}
          <Field label="Como o escritório recebe">
            <div className="grid gap-2">
              <RotaOption
                checked={firm.meetingInboxEnabled !== true}
                onSelect={() => set({ meetingInboxEnabled: false })}
                title="Pelo WhatsApp"
                desc="A conversa termina montando a mensagem, que sai do aparelho do visitante. O escritório não guarda nada."
              />
              <RotaOption
                checked={firm.meetingInboxEnabled === true}
                onSelect={() => set({ meetingInboxEnabled: true })}
                title="Na caixa de solicitações"
                desc="O pedido fica em Solicitações, para encaminhar a um advogado. Nome, contato e assunto passam a ficar guardados até alguém apagar."
              />
            </div>
            {/* Com o pedido indo direto ao advogado escolhido, a caixa DELE
                continua valendo: não seria certo o escritório desligar a própria
                caixa e com isso desligar a de terceiro. Quem lê "o escritório não
                guarda nada" precisa saber que o advogado pode guardar. */}
            {firm.assistantRoute === 'lawyer' && !firm.meetingInboxEnabled && (
              <p className="text-[12px] leading-relaxed text-ink-faint">
                Com o pedido indo direto ao advogado escolhido, quem tiver a própria caixa ligada
                continua recebendo por ela — no painel dele, não no do escritório.
              </p>
            )}
          </Field>

          {firm.meetingInboxEnabled && (
            <p className="rounded-lg border border-ink/10 bg-paper-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              Os pedidos chegam em{' '}
              <Link
                to="/escritorio/solicitacoes"
                className="font-semibold text-burgundy underline underline-offset-2"
              >
                Solicitações do escritório
              </Link>
              . Quem administra encaminha a um advogado, e ele confirma na agenda dele.
            </p>
          )}

          {/* Sem canal nenhum, parte dos pedidos (ou todos) não tem para onde ir —
              e o dono só descobriria pelo visitante. */}
          {!firm.contact.whatsapp && !firm.meetingInboxEnabled && (
            <p className="rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-brass-deep">
              {firm.assistantRoute === 'lawyer'
                ? 'Sem o WhatsApp do escritório e sem a caixa de solicitações, quem não escolhe um advogado — ou escolhe alguém sem canal — não tem para onde mandar o pedido.'
                : 'Sem o WhatsApp do escritório e sem a caixa de solicitações, o assistente não tem para onde mandar o pedido.'}
            </p>
          )}

          {/* Assuntos: os derivados das áreas dos advogados mais os do escritório.
              Só os derivados deixavam a conversa sem a pergunta de assunto quando
              ninguém tinha preenchido área — e sem nada que o dono pudesse fazer. */}
          <Field
            label="Assuntos que a conversa oferece"
            hint="As áreas principais dos advogados entram sozinhas. Acrescente aqui o que o escritório atende e ninguém tem como área principal."
          >
            <ListaDeAssuntos
              derivados={derivadosDosAdvogados}
              proprios={firm.extraAreas ?? []}
              onChange={(extraAreas) => set({ extraAreas })}
            />
            <ComplianceHint issues={areaIssues} />
          </Field>

          {/* Quem oferece horário, quem faz triagem e quem recebe pelo painel:
              sem isto, o dono vê a conversa se comportar diferente a cada
              advogado e não entende por quê. Tudo em LEITURA — cada uma dessas
              escolhas é do advogado, no perfil dele. */}
          {firm.lawyers.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink">
                Como a conversa se comporta com cada advogado
              </p>
              <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10">
                {[...firm.lawyers]
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map((l) => (
                    <li key={l.id} className="px-3 py-2 text-[12.5px]">
                      <span className="font-medium text-ink">{l.name}</span>
                      <span className="mt-0.5 block text-ink-faint">
                        {l.agenda
                          ? 'oferece os horários livres da agenda'
                          : 'sem agenda — pergunta dia e período'}
                        {(l.triagem?.questions?.length ?? 0) > 0 &&
                          ` · faz ${l.triagem!.questions.length} pergunta${l.triagem!.questions.length > 1 ? 's' : ''} de triagem`}
                        {l.meetingInbox && ' · recebe pedidos no painel dele'}
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
                Cada advogado configura isso no próprio perfil: a agenda em Agendamento, as
                perguntas em Triagem, e fecha os horários já marcados em Sua agenda, no painel.
                {firm.assistantRoute === 'lawyer'
                  ? ' Como o pedido vai direto a quem for escolhido, quem tem a caixa ligada recebe por ela.'
                  : ' Como o pedido vem para o escritório, a caixa de cada advogado só vale no perfil dele.'}
              </p>
            </div>
          )}
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
              Convidar advogado por e-mail
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
              Mandamos o convite para esse e-mail. Quem já tem conta também o vê no painel; quem ainda
              não tem cria a conta com esse mesmo e-mail e o convite aparece lá.
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
/**
 * Os assuntos que a conversa oferece: os que vêm dos advogados (fixos, em
 * cinza) e os que o escritório escreveu (removíveis).
 *
 * A separação não é enfeite: o dono precisa saber o que já está lá sem ele para
 * não reescrever "Direito de Família" que o perfil da Camila já traz — e o que
 * ele escreve some se um advogado passar a ter aquela área? Não: repetido é
 * dobrado uma vez só na leitura (ver firms.service.toApi), e o dele continua
 * valendo se o advogado sair.
 */
/** Atalho para uma tela do escritório que não é o editor. */
function AtalhoDoEscritorio({
  to,
  titulo,
  texto,
  icone,
}: {
  to: string
  titulo: string
  texto: string
  icone: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-xl2 border border-ink/10 bg-paper p-3.5 transition-all hover:-translate-y-0.5 hover:border-burgundy/30 hover:shadow-card"
    >
      <span className="mt-0.5 shrink-0 rounded-lg bg-burgundy/[0.07] p-2 text-burgundy">
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{titulo}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-faint">{texto}</span>
      </span>
    </Link>
  )
}

function ListaDeAssuntos({
  derivados,
  proprios,
  onChange,
}: {
  derivados: string[]
  proprios: string[]
  onChange: (lista: string[]) => void
}) {
  const [novo, setNovo] = useState('')
  const MAX = 12
  const jaTem = (t: string) =>
    [...derivados, ...proprios].some((a) => a.toLowerCase() === t.toLowerCase())

  function adicionar() {
    const texto = novo.trim().slice(0, 60)
    if (!texto || jaTem(texto) || proprios.length >= MAX) return
    onChange([...proprios, texto])
    setNovo('')
  }

  return (
    <div className="space-y-2">
      {(derivados.length > 0 || proprios.length > 0) && (
        <ul className="flex flex-wrap gap-1.5">
          {derivados.map((a) => (
            <li
              key={`d-${a}`}
              className="rounded-full border border-ink/10 bg-paper-soft px-2.5 py-1 text-[12.5px] text-ink-faint"
              title="Vem da área principal de um advogado"
            >
              {a}
            </li>
          ))}
          {proprios.map((a) => (
            <li
              key={`p-${a}`}
              className="inline-flex items-center gap-1 rounded-full border border-burgundy/25 bg-burgundy/[0.06] py-1 pl-2.5 pr-1 text-[12.5px] text-ink"
            >
              {a}
              <button
                type="button"
                onClick={() => onChange(proprios.filter((x) => x !== a))}
                aria-label={`Remover o assunto ${a}`}
                className="rounded-full p-0.5 text-ink-faint transition-colors hover:text-burgundy"
              >
                <TrashIcon width={13} height={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {proprios.length < MAX && (
        <div className="flex gap-2">
          <TextInput
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              // Enter dentro de um editor que salva sozinho não pode submeter
              // nada: aqui ele só acrescenta o assunto.
              e.preventDefault()
              adicionar()
            }}
            maxLength={60}
            placeholder="Ex.: Direito Imobiliário"
          />
          <button
            type="button"
            onClick={adicionar}
            disabled={!novo.trim() || jaTem(novo.trim())}
            className="shrink-0 rounded-lg border border-ink/15 px-3 text-[13px] font-semibold text-ink transition-colors hover:border-burgundy/40 disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
      )}
      {!derivados.length && !proprios.length && (
        <p className="text-[12px] leading-relaxed text-ink-faint">
          Sem nenhum assunto, a conversa pula a pergunta e vai direto para a escolha do advogado.
        </p>
      )}
    </div>
  )
}

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
