// Endereço do escritório — o dado que faltava para o perfil dizer ONDE a pessoa
// é atendida.
//
// O perfil sempre teve cidade e UF, e parava aí. Para quem procura um advogado
// para ir até lá, "São Paulo/SP" não é endereço: é a metade da informação que
// obriga a pessoa a perguntar no WhatsApp o que devia estar na página. Este
// arquivo guarda a rua, o número e o que os transforma em linha lida por
// humano, cartão de contato e link de mapa.
//
// DUAS DECISÕES QUE VALEM POR TODO O RESTO:
//
// 1. Endereço é OPCIONAL e tem interruptor próprio (`publico`). Muita gente
//    atende de casa, e o endereço residencial de quem trabalha com processo
//    criminal ou de família não é dado para publicar por descuido. Preencher e
//    não mostrar é um estado legítimo — o endereço continua indo para o cartão
//    de contato que o próprio advogado baixa, e não para a página pública.
//
// 2. Nada de coordenada, nada de mapa embutido. O link do mapa é um <a> comum
//    que só abre quando a pessoa toca; um iframe do Google carregaria script de
//    terceiro (e cookie de terceiro) na página de todo visitante, para mostrar
//    um mapa que quase ninguém olha.

/** Endereço do escritório. Todo campo é opcional — o perfil mostra o que houver. */
export interface Endereco {
  /** CEP com 8 dígitos, guardado só com dígitos ("01310100"). */
  cep?: string
  /** logradouro: "Av. Paulista" */
  rua?: string
  /** número: "1000" — texto, porque "s/n" e "1000-A" existem */
  numero?: string
  /** complemento: "Conj. 121" */
  complemento?: string
  /** bairro: "Bela Vista" */
  bairro?: string
  /**
   * Mostrar na página pública. Ausente conta como `true`: perfis criados antes
   * deste campo não têm endereço nenhum, e quem preenche um endereço no editor
   * está preenchendo para aparecer — a exceção é quem desliga de propósito.
   */
  publico?: boolean
}

/** Só os dígitos, no máximo 8. */
export function digitosDeCep(valor: string): string {
  return (valor ?? '').replace(/\D/g, '').slice(0, 8)
}

/** "01310100" → "01310-100". Incompleto sai como está, para poder ser digitado. */
export function formatarCep(valor: string): string {
  const d = digitosDeCep(valor)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** CEP completo (8 dígitos)? Não confere se ele EXISTE — isso é a consulta. */
export function cepCompleto(valor: string): boolean {
  return digitosDeCep(valor).length === 8
}

/** Tem alguma coisa preenchida? Um endereço vazio não ocupa espaço no perfil. */
export function temEndereco(e?: Endereco | null): boolean {
  if (!e) return false
  return !!(e.cep || e.rua || e.numero || e.complemento || e.bairro)
}

/**
 * O endereço aparece para o visitante?
 *
 * Precisa de rua — sem logradouro não há endereço, só um CEP solto que ninguém
 * usa para chegar a lugar nenhum — e do interruptor ligado.
 */
export function enderecoVisivel(e?: Endereco | null): boolean {
  return !!e?.rua?.trim() && e.publico !== false
}

/**
 * A primeira linha: "Av. Paulista, 1000 — Conj. 121".
 *
 * Travessão entre o número e o complemento, vírgula dentro do logradouro: é
 * como endereço se escreve em português, e o cartão de visita impresso e a
 * página têm de dizer a mesma coisa da mesma forma.
 */
export function linhaLogradouro(e?: Endereco | null): string {
  if (!e) return ''
  const rua = [e.rua?.trim(), e.numero?.trim()].filter(Boolean).join(', ')
  const compl = e.complemento?.trim()
  return [rua, compl].filter(Boolean).join(' — ')
}

/** A segunda linha: "Bela Vista, São Paulo/SP · 01310-100". */
export function linhaLocalidade(e: Endereco | null | undefined, cidade: string, uf: string): string {
  const local = [cidade?.trim(), uf?.trim()].filter(Boolean).join('/')
  const antes = [e?.bairro?.trim(), local].filter(Boolean).join(', ')
  const cep = e?.cep ? formatarCep(e.cep) : ''
  return [antes, cep].filter(Boolean).join(' · ')
}

/** As duas linhas numa só, para vCard, PDF e qualquer lugar de uma linha só. */
export function enderecoEmLinha(
  e: Endereco | null | undefined,
  cidade: string,
  uf: string,
): string {
  return [linhaLogradouro(e), linhaLocalidade(e, cidade, uf)].filter(Boolean).join(', ')
}

/**
 * Link para o mapa.
 *
 * `google.com/maps/search/?api=1&query=…` é o endereço documentado e universal:
 * no celular ele é interceptado pelo aplicativo do Google Maps (Android e iOS),
 * e no computador abre no navegador. Um link `geo:` ou `maps://` só funcionaria
 * em um dos dois.
 *
 * Devolve `undefined` quando não há endereço de rua. Um mapa apontando só para
 * "São Paulo/SP" abre no meio da cidade — pior que não ter link, porque parece
 * que aponta para o escritório.
 */
export function linkDoMapa(
  e: Endereco | null | undefined,
  cidade: string,
  uf: string,
): string | undefined {
  if (!e?.rua?.trim()) return undefined
  const busca = [enderecoEmLinha(e, cidade, uf), 'Brasil'].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}`
}

/**
 * O bloco ADR do vCard 3.0.
 *
 * A ordem dos sete campos é a da RFC 2426 e não é negociável: caixa postal,
 * complemento, logradouro, cidade, estado, CEP, país. Fora de ordem, o contato
 * salvo no telefone da pessoa mostra o bairro onde devia estar a rua.
 *
 * O ponto-e-vírgula separa campos, então um complemento com ";" quebraria o
 * cartão inteiro — daí o escape exigido pela própria RFC.
 */
export function adrDoVCard(
  e: Endereco | null | undefined,
  cidade: string,
  uf: string,
): string | undefined {
  const rua = [e?.rua?.trim(), e?.numero?.trim()].filter(Boolean).join(', ')
  if (!rua && !cidade?.trim() && !uf?.trim()) return undefined
  const esc = (v?: string) => (v ?? '').replace(/([\\,;])/g, '\\$1')
  const campos = [
    '', // caixa postal — não coletamos
    esc(e?.complemento?.trim() || e?.bairro?.trim()),
    esc(rua),
    esc(cidade?.trim()),
    esc(uf?.trim()),
    esc(e?.cep ? formatarCep(e.cep) : ''),
    'Brasil',
  ]
  return `ADR;TYPE=WORK:${campos.join(';')}`
}
