import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  buscarMunicipios,
  carregarMunicipios,
  cidadeOficial,
  municipiosCarregados,
  ufsComCidade,
  type Municipio,
} from '@/lib/municipios'
import { UF_LIST } from '@/lib/brFormat'
import { CheckIcon, PinIcon, SearchIcon } from '@/components/ui/icons'

/**
 * Campo de cidade com a lista oficial do IBGE.
 *
 * O campo antes era um `<input>` livre ao lado de um seletor de UF, e o que ele
 * gravava saía em três lugares que dependem da grafia certa: o título de SEO do
 * perfil ("Advogado(a) em São Paolo" é o que o Google indexa), o link do mapa e
 * a busca do diretório, que compara texto — quem escreveu "Sao Paulo" some da
 * busca por "São Paulo". Nenhum desses erros aparecia para quem digitou.
 *
 * TRÊS DECISÕES:
 *
 * 1. A UF é OPCIONAL para procurar. Quem sabe a cidade não deveria ter de
 *    lembrar a sigla: digitar "Campinas" mostra "Campinas — SP", e escolher
 *    preenche as duas coisas. Com a UF já marcada, a busca se restringe a ela.
 *
 * 2. Digitar à mão continua valendo. A base do IBGE é oficial mas não é a
 *    realidade inteira (distritos, nomes em transição), e um campo que RECUSA o
 *    que não reconhece transforma um caso raro em impossível. Fora da lista, o
 *    campo AVISA — e, quando a cidade existe em outra UF, diz qual.
 *
 * 3. A grafia gravada é a da base. Quem digita "sao paulo" e sai do campo tem
 *    "São Paulo" gravado: o acento vem do IBGE, não da memória da pessoa.
 */
export function CidadeInput({
  city,
  state,
  onChange,
  autoFocus,
  placeholder = 'São Paulo',
  ariaLabel = 'Cidade',
}: {
  city: string
  state: string
  /** Emite as DUAS coisas: escolher na lista pode trocar a UF junto. */
  onChange: (v: { city: string; state: string }) => void
  autoFocus?: boolean
  placeholder?: string
  ariaLabel?: string
}) {
  const listaId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // A base é ~74 KB e chega por import dinâmico. Enquanto ela não chega, o campo
  // funciona como o antigo: texto livre, sem sugestão e sem aviso nenhum — nunca
  // acusar de errado o que ainda não foi conferido.
  const [base, setBase] = useState(municipiosCarregados)
  const [aberto, setAberto] = useState(false)
  const [marcado, setMarcado] = useState(0)
  // O texto DIGITADO vive aqui, separado do que está gravado: é ele que segura
  // o aviso de "não encontramos" enquanto a pessoa ainda está no meio da
  // palavra — acusar erro na segunda letra é ruído, não ajuda.
  const [rascunho, setRascunho] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void carregarMunicipios().then((d) => {
      if (vivo) setBase(d)
    })
    return () => {
      vivo = false
    }
  }, [])

  // Fecha ao tocar fora. `mousedown` e não `click`: no celular, o toque que
  // fecha a lista não pode também ativar o que está embaixo dela.
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('touchstart', fora)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('touchstart', fora)
    }
  }, [aberto])

  const texto = rascunho ?? city
  const sugestoes = useMemo<Municipio[]>(
    () => (base ? buscarMunicipios(base, texto, state || undefined) : []),
    [base, texto, state],
  )

  // O que dizer embaixo do campo quando o que está escrito não está na base.
  const aviso = useMemo(() => {
    if (!base || rascunho !== null || !city.trim() || !state) return null
    if (cidadeOficial(base, state, city)) return null
    const outras = ufsComCidade(base, city)
    if (outras.length) {
      return `Não existe ${city} em ${state} — encontramos em ${outras.join(', ')}.`
    }
    return `Não encontramos ${city} na lista do IBGE. Confira a grafia.`
  }, [base, rascunho, city, state])

  const escolher = (m: Municipio) => {
    setRascunho(null)
    setAberto(false)
    onChange({ city: m.nome, state: m.uf })
    inputRef.current?.blur()
  }

  // Ao sair do campo, o texto solto vira a grafia oficial se houver uma igual
  // ignorando acento e caixa. É o passo que faz "sao paulo" digitado direto,
  // sem tocar na lista, chegar ao banco como "São Paulo".
  const sair = () => {
    setRascunho(null)
    if (!base || !state) return
    const oficial = cidadeOficial(base, state, city)
    if (oficial && oficial !== city) onChange({ city: oficial, state })
  }

  const tecla = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setAberto(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!aberto) {
        setAberto(true)
        setMarcado(0)
        return
      }
      if (!sugestoes.length) return
      const passo = e.key === 'ArrowDown' ? 1 : -1
      setMarcado((i) => (i + passo + sugestoes.length) % sugestoes.length)
      return
    }
    if (e.key === 'Enter' && aberto && sugestoes[marcado]) {
      // Só engole o Enter quando ele REALMENTE escolhe algo — senão o onboarding
      // deixaria de avançar com a tecla, sem explicação nenhuma.
      e.preventDefault()
      escolher(sugestoes[marcado])
    }
  }

  const mostrarLista = aberto && sugestoes.length > 0

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <SearchIcon
          width={15}
          height={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <input
          ref={inputRef}
          value={texto}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostrarLista ? `${listaId}-${marcado}` : undefined}
          aria-label={ariaLabel}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => {
            setRascunho(e.target.value)
            setMarcado(0)
            setAberto(true)
            onChange({ city: e.target.value, state })
          }}
          onFocus={() => setAberto(true)}
          onBlur={sair}
          onKeyDown={tecla}
          className="w-full rounded-lg border border-ink/15 bg-paper-soft py-2.5 pr-3.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
          style={{ paddingLeft: '2.1rem' }}
        />
      </div>

      {mostrarLista && (
        <ul
          id={listaId}
          role="listbox"
          aria-label="Municípios encontrados"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-ink/12 bg-paper-soft py-1 shadow-lift"
        >
          {sugestoes.map((m, i) => {
            const atual = m.nome === city && m.uf === state
            return (
              <li key={`${m.uf}-${m.nome}`}>
                <button
                  type="button"
                  id={`${listaId}-${i}`}
                  role="option"
                  aria-selected={i === marcado}
                  // `mousedown` e não `click`: o clique só chega DEPOIS do blur,
                  // e o blur fecha a lista — o item sumia debaixo do dedo.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    escolher(m)
                  }}
                  onMouseEnter={() => setMarcado(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] transition-colors ${
                    i === marcado ? 'bg-brass/12 text-ink' : 'text-ink-soft'
                  }`}
                >
                  <PinIcon width={13} height={13} className="shrink-0 text-ink-faint" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{m.nome}</span>
                  <span className="shrink-0 text-[11.5px] font-semibold text-ink-faint">{m.uf}</span>
                  {atual && <CheckIcon width={13} height={13} className="shrink-0 text-brass-deep" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {aviso && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-brass-deep">
          {aviso} Você pode manter assim se estiver certo.
        </p>
      )}
    </div>
  )
}

/**
 * O par UF + Cidade, na ordem em que o campo funciona melhor.
 *
 * A UF vem PRIMEIRO por um motivo prático: escolhida, ela reduz a busca de
 * 5.571 nomes para os da UF, e "Bom Jesus" — que existe em nove estados —
 * deixa de devolver nove linhas quase iguais. Quem preferir começar pela
 * cidade continua podendo: sem UF, a busca é no Brasil inteiro e a escolha
 * preenche a sigla sozinha.
 */
export function CidadeUfCampos({
  city,
  state,
  onChange,
  autoFocus,
}: {
  city: string
  state: string
  onChange: (v: { city: string; state: string }) => void
  autoFocus?: boolean
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">UF</span>
        <select
          value={state}
          onChange={(e) => onChange({ city, state: e.target.value })}
          aria-label="Estado (UF)"
          className="w-full rounded-lg border border-ink/15 bg-paper-soft px-2 py-2.5 text-[14px] text-ink transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        >
          <option value="">UF</option>
          {UF_LIST.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      {/* Sem `Field`: o rótulo dele envolve o conteúdo num <label>, e um <label>
          em volta de um combobox com lista faz o clique numa sugestão devolver o
          foco ao input — o mesmo engano já cometido no LogoUpload. */}
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">Cidade</span>
        <CidadeInput city={city} state={state} onChange={onChange} autoFocus={autoFocus} />
      </div>
    </div>
  )
}
