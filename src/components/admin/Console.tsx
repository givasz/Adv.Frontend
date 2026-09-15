// A moldura do console: menu lateral, barra superior e a área de trabalho.
//
// Desenho de ferramenta, não de site. O menu é fixo à esquerda no desktop e
// vira uma faixa rolável no celular — nunca um painel sobreposto (o painel
// inteiro deixou de usar modal). A ordem dos itens é a ordem de atendimento:
// primeiro quem está esperando resposta (filas, com contagem), depois as
// ferramentas de consulta, depois os números, e por último quem administra.
//
// Quem não tem a permissão não vê a seção — e, se forçar a URL, a API recusa do
// mesmo jeito. Esconder é conforto; a fronteira é o servidor.

import type { ReactNode, SVGProps } from 'react'
import type { AdminMe } from '@/lib/adminApi'
import {
  ChartIcon,
  ClockIcon,
  FingerprintIcon,
  FlagIcon,
  MessageIcon,
  ScaleIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
} from '@/components/ui/icons'
import { Marca } from '@/components/ui/Marca'
import { Botao, Chip, Contador, ROLE_NOME, ROLE_TOM, iniciais, type Tom } from './pecas'
import { useContadores, type Contadores } from './contadores'

export type SecaoId =
  | 'inicio'
  | 'denuncias'
  | 'contestacoes'
  | 'suporte'
  | 'advogados'
  | 'historico'
  | 'levantamentos'
  | 'equipe'
  | 'conta'

type Grupo = 'inicio' | 'filas' | 'ferramentas' | 'analise' | 'administracao'

export interface Secao {
  id: SecaoId
  label: string
  descricao: string
  grupo: Grupo
  /** Permissão que abre a seção; vazio = qualquer pessoa logada. */
  permissao: string
  icone: (p: SVGProps<SVGSVGElement>) => JSX.Element
  /** Qual contador do menu esta seção mostra, e em que tom. */
  contagem?: (c: Contadores) => { valor: number; tom: Tom }
}

const GRUPO_NOME: Record<Grupo, string> = {
  inicio: '',
  filas: 'Filas',
  ferramentas: 'Ferramentas',
  analise: 'Análise',
  administracao: 'Administração',
}

export const SECOES: readonly Secao[] = [
  {
    id: 'inicio',
    label: 'Visão geral',
    descricao: 'O que está esperando resposta e como a plataforma está hoje.',
    grupo: 'inicio',
    permissao: '',
    icone: ScaleIcon,
  },
  {
    id: 'denuncias',
    label: 'Denúncias',
    descricao: 'Perfis denunciados por visitantes. Cada linha é um perfil; a ficha compara a acusação com o texto no ar.',
    grupo: 'filas',
    permissao: 'moderacao:ler',
    icone: FlagIcon,
    contagem: (c) => ({ valor: c.denuncias, tom: 'perigo' }),
  },
  {
    id: 'contestacoes',
    label: 'Contestações',
    descricao: 'Respostas dos advogados a medidas aplicadas. Tem prazo: sem resposta em 10 dias, a medida cai sozinha.',
    grupo: 'filas',
    permissao: 'moderacao:ler',
    icone: ShieldIcon,
    contagem: (c) => ({ valor: c.contestacoes, tom: c.contestacoesVencendo > 0 ? 'perigo' : 'aviso' }),
  },
  {
    id: 'suporte',
    label: 'Suporte',
    descricao: 'Chamados abertos pelos advogados, com a página e o navegador de onde saíram.',
    grupo: 'filas',
    permissao: 'suporte:ler',
    icone: MessageIcon,
    contagem: (c) => ({ valor: c.chamados, tom: 'acento' }),
  },
  {
    id: 'advogados',
    label: 'Advogados',
    descricao: 'Busca por nome, OAB, cidade ou endereço — inclusive perfis não publicados.',
    grupo: 'ferramentas',
    permissao: 'contas:ler',
    icone: SearchIcon,
  },
  {
    id: 'historico',
    label: 'Histórico',
    descricao: 'Tudo o que o console fez: quem, quando, sobre quem e por quê. Nada aqui é apagado.',
    grupo: 'ferramentas',
    permissao: 'auditoria:ler',
    icone: ClockIcon,
  },
  {
    id: 'levantamentos',
    label: 'Levantamentos',
    descricao: 'Os números da plataforma: contas, planos, uso e onde os perfis estão.',
    grupo: 'analise',
    permissao: 'metricas:ler',
    icone: ChartIcon,
  },
  {
    id: 'equipe',
    label: 'Equipe',
    descricao: 'Quem administra: papéis, segundo fator, sessões abertas.',
    grupo: 'administracao',
    permissao: 'admins:gerir',
    icone: UserIcon,
  },
  {
    id: 'conta',
    label: 'Minha conta',
    descricao: 'Sua senha e o seu segundo fator.',
    grupo: 'administracao',
    permissao: '',
    icone: FingerprintIcon,
  },
]

export function secoesDe(me: AdminMe): Secao[] {
  return SECOES.filter((s) => {
    if (s.permissao && !me.permissoes.includes(s.permissao)) return false
    // A conta de emergência do .env não tem linha no banco — não há senha nem
    // segundo fator para mudar.
    if (s.id === 'conta' && !me.id) return false
    return true
  })
}

export function Console({
  me,
  secao,
  onSecao,
  onLogout,
  children,
}: {
  me: AdminMe
  secao: SecaoId
  onSecao: (s: SecaoId) => void
  onLogout: () => void
  children: ReactNode
}) {
  const secoes = secoesDe(me)
  const { contadores } = useContadores()
  const atual = SECOES.find((s) => s.id === secao) ?? SECOES[0]
  const grupos = (['inicio', 'filas', 'ferramentas', 'analise', 'administracao'] as Grupo[])
    .map((g) => ({ id: g, itens: secoes.filter((s) => s.grupo === g) }))
    .filter((g) => g.itens.length > 0)

  return (
    <div className="console min-h-dvh bg-adm-bg font-ui text-adm-ink lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* ───────────── menu ───────────── */}
      <aside className="flex flex-col bg-adm-side text-slate-300 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4 lg:pb-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/95">
            <Marca size={16} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] font-semibold text-white">advoc.me</span>
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Console
            </span>
          </span>
          {!me.producao && (
            <span className="ml-auto rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              dev
            </span>
          )}
        </div>

        <nav
          aria-label="Seções do console"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-3 lg:pb-4"
        >
          {grupos.map((g) => (
            <div key={g.id} className="flex shrink-0 gap-1 lg:flex-col">
              {GRUPO_NOME[g.id] && (
                <p className="hidden px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 lg:block">
                  {GRUPO_NOME[g.id]}
                </p>
              )}
              {g.itens.map((s) => {
                const ativo = s.id === secao
                const cont = s.contagem?.(contadores)
                const Icone = s.icone
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSecao(s.id)}
                    aria-current={ativo ? 'page' : undefined}
                    aria-label={s.label}
                    title={cont && cont.valor > 0 ? `${s.label}: ${cont.valor}` : s.label}
                    className={`flex h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium transition-colors ${
                      ativo
                        ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icone
                      width={16}
                      height={16}
                      strokeWidth={1.8}
                      className={ativo ? 'text-adm-accent-soft' : 'text-slate-400'}
                      aria-hidden
                    />
                    <span className="whitespace-nowrap lg:flex-1">{s.label}</span>
                    {cont && cont.valor > 0 && (
                      <span aria-hidden>
                        <Contador valor={cont.valor} tom={cont.tom} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Quem está logado, sempre à vista: num painel que decide o que sai do
            ar, "em nome de quem" é a primeira informação da tela. */}
        <div className="hidden border-t border-white/10 px-3 py-3 lg:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-adm-accent text-[11px] font-bold text-white">
              {iniciais(me.name)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-white">{me.name}</span>
              <span className="block truncate text-[11px] text-slate-400">{ROLE_NOME[me.role]}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* ───────────── área de trabalho ───────────── */}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-adm-border bg-white/90 px-4 backdrop-blur lg:px-6">
          <span className="min-w-0 truncate text-[13px] text-adm-muted">
            Console <span className="mx-1 text-adm-faint">/</span>
            <span className="font-medium text-adm-ink">{atual.label}</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Chip tom={ROLE_TOM[me.role]} className="hidden sm:inline-flex">
              {ROLE_NOME[me.role]}
            </Chip>
            <span className="truncate text-[12.5px] text-adm-soft lg:hidden">{me.name}</span>
            <Botao tamanho="sm" variante="fantasma" onClick={onLogout} className="lg:hidden">
              Sair
            </Botao>
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  )
}
