import { useRef, useState } from 'react'
import { Field, TextInput, Toggle } from './fields'
import { buscarCep } from '@/lib/cep'
import {
  cepCompleto,
  digitosDeCep,
  enderecoEmLinha,
  formatarCep,
  linkDoMapa,
  temEndereco,
  type Endereco,
} from '@/lib/endereco'
import { ExternalLinkIcon, PinIcon } from '@/components/ui/icons'

/**
 * Endereço do escritório — os campos, a consulta de CEP e o aviso de privacidade.
 *
 * Um componente só, usado pelo perfil do advogado e pelo editor do escritório:
 * a sede de uma sociedade e a sala de um advogado autônomo se preenchem do
 * mesmo jeito, e duas cópias disto seriam duas máscaras de CEP que divergem.
 *
 * O CEP puxa rua, bairro, cidade e UF (ver lib/cep.ts) — mas NUNCA sobrescreve
 * o que a pessoa já escreveu num campo. Autocompletar que apaga texto alheio é
 * pior do que não autocompletar: a pessoa perde o que digitou e nem vê quando.
 */
export function EnderecoCampos({
  address,
  city,
  state,
  onChange,
  onLocal,
}: {
  address: Endereco | undefined
  city: string
  state: string
  onChange: (e: Endereco) => void
  /** O CEP também sabe a cidade e a UF — quem as guarda é a tela de cima. */
  onLocal: (v: { city: string; state: string }) => void
}) {
  const e = address ?? {}
  const [buscando, setBuscando] = useState(false)
  const [semCep, setSemCep] = useState(false)
  // Guarda o último CEP consultado para não repetir a busca quando a pessoa
  // volta ao campo e sai dele sem mudar nada.
  const ultimo = useRef('')

  // O ESTADO MAIS RECENTE, e não o da renderização em que a consulta começou.
  //
  // A consulta é assíncrona: entre pedir o CEP e receber a resposta a pessoa
  // continua digitando — quase sempre no "Número", que é o campo vizinho. Se o
  // preenchimento automático montasse o endereço a partir do que ele valia
  // quando a busca saiu, esse número recém-digitado seria apagado no instante
  // em que a rua aparecesse, e a pessoa não teria como saber por quê.
  const agora = useRef({ e, city, state })
  agora.current = { e, city, state }

  const mexer = (patch: Partial<Endereco>) => onChange({ ...agora.current.e, ...patch })

  const consultar = async (digitos: string) => {
    if (!cepCompleto(digitos) || digitos === ultimo.current) return
    ultimo.current = digitos
    setBuscando(true)
    setSemCep(false)
    const achado = await buscarCep(digitos)
    setBuscando(false)
    if (!achado) {
      setSemCep(true)
      return
    }
    const atual = agora.current
    // Só preenche o que está VAZIO. Ver o comentário do topo.
    mexer({
      cep: digitos,
      rua: atual.e.rua?.trim() ? atual.e.rua : achado.rua,
      bairro: atual.e.bairro?.trim() ? atual.e.bairro : achado.bairro,
    })
    if (!atual.city.trim() && achado.cidade) {
      onLocal({ city: achado.cidade, state: achado.uf || atual.state })
    } else if (!atual.state.trim() && achado.uf) {
      onLocal({ city: atual.city, state: achado.uf })
    }
  }

  const mapa = linkDoMapa(e, city, state)

  return (
    <>
      <div className="grid grid-cols-[130px_1fr] gap-3">
        <Field label="CEP" hint={buscando ? 'buscando…' : undefined}>
          <TextInput
            value={formatarCep(e.cep ?? '')}
            inputMode="numeric"
            placeholder="01310-100"
            aria-label="CEP do escritório"
            onChange={(ev) => {
              const d = digitosDeCep(ev.target.value)
              setSemCep(false)
              mexer({ cep: d })
              // A consulta dispara sozinha ao completar os 8 dígitos: ninguém
              // deveria precisar tocar num botão "buscar" depois de digitar o
              // CEP inteiro. Sair do campo antes disso também dispara (onBlur),
              // para quem cola o número.
              if (cepCompleto(d)) void consultar(d)
            }}
            onBlur={(ev) => void consultar(digitosDeCep(ev.target.value))}
          />
        </Field>
        <Field label="Número" hint="opcional">
          <TextInput
            value={e.numero ?? ''}
            maxLength={20}
            placeholder="1000"
            aria-label="Número do endereço"
            onChange={(ev) => mexer({ numero: ev.target.value })}
          />
        </Field>
      </div>
      {semCep && (
        <p className="-mt-1 text-[11.5px] leading-relaxed text-brass-deep">
          Não encontramos esse CEP agora. Você pode preencher o endereço à mão.
        </p>
      )}

      <Field label="Rua / avenida">
        <TextInput
          value={e.rua ?? ''}
          maxLength={120}
          placeholder="Av. Paulista"
          onChange={(ev) => mexer({ rua: ev.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Complemento" hint="opcional">
          <TextInput
            value={e.complemento ?? ''}
            maxLength={60}
            placeholder="Conj. 121"
            onChange={(ev) => mexer({ complemento: ev.target.value })}
          />
        </Field>
        <Field label="Bairro" hint="opcional">
          <TextInput
            value={e.bairro ?? ''}
            maxLength={80}
            placeholder="Bela Vista"
            onChange={(ev) => mexer({ bairro: ev.target.value })}
          />
        </Field>
      </div>

      {/* O interruptor só aparece quando há endereço: um controle para esconder
          o que ainda não existe não decide nada e só ocupa espaço. */}
      {temEndereco(e) && (
        <div className="rounded-lg border border-ink/10 bg-paper-deep/60 p-3">
          <Toggle
            checked={e.publico !== false}
            onChange={(v) => mexer({ publico: v })}
            label="Mostrar o endereço no perfil"
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
            {e.publico === false
              ? 'O endereço fica só com você — não aparece na página nem no cartão de contato que o visitante salva.'
              : 'Quem atende em casa costuma deixar desligado: o endereço continua guardado e some da página pública.'}
          </p>
        </div>
      )}

      {mapa && e.publico !== false && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-brass/25 bg-brass/8 p-3">
          <span className="inline-flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft">
            <PinIcon width={14} height={14} className="mt-0.5 shrink-0 text-brass-deep" aria-hidden />
            {enderecoEmLinha(e, city, state)}
          </span>
          <a
            href={mapa}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 self-start text-[12px] font-semibold text-brass-deep hover:underline"
          >
            Conferir no mapa
            <ExternalLinkIcon width={12} height={12} />
          </a>
        </div>
      )}
    </>
  )
}
