// Assistente virtual de agendamento — a lógica por trás da conversa guiada do perfil.
//
// O assistente NÃO é uma IA nem presta qualquer orientação jurídica: é um roteiro
// fechado (dia → horário → assunto → nome) montado a partir da disponibilidade que o
// próprio advogado marcou. No fim, tudo vira UMA mensagem no WhatsApp dele.
//
// Conformidade (Prov. 205/2021 + CED): a Cartilha do CFOAB veda usar chats para
// captar clientela de forma disfarçada. Por isso o roteiro é estritamente operacional
// — nada de triagem de mérito, promessa de resultado, preço, urgência ou "consultoria"
// automática. O texto de abertura escrito pelo advogado passa pela mesma checagem de
// conformidade das demais peças (ver lib/oab.ts).

import { MONTHS_SHORT, WEEKDAYS_FULL, WEEKDAYS_SHORT } from './booking'
import { whatsappHref } from './whatsapp'
import type { AssistantConfig, AssistantDay, FaixaDeAtendimento, Profile } from './types'
import { enderecoEmLinha, enderecoVisivel, type Endereco } from './endereco'
import { linhasDaTriagem, type RespostaDeTriagem } from './triagem'

/** Manhã e tarde, com atendimentos de uma hora: 09:00, 10:00, 14:00, 15:00 e 16:00. */
export const FAIXAS_PADRAO: FaixaDeAtendimento[] = [
  { inicio: '09:00', fim: '11:00' },
  { inicio: '14:00', fim: '17:00' },
]

const WEEKDAY_TIMES_DEFAULT = ['09:00', '10:00', '14:00', '15:00', '16:00']

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  days: [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    times: [...WEEKDAY_TIMES_DEFAULT],
    faixas: FAIXAS_PADRAO.map((f) => ({ ...f })),
  })),
  durationMin: 60,
  leadHours: 12,
  horizonDays: 14,
  greeting: '',
}

/** Quantos dias/horários o assistente pode oferecer, no máximo, em cada tela. */
export const MAX_DAY_CHIPS = 6

// ---- Conversão e ordenação de horários ----

export function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "14:30" → 870. Retorna NaN para entradas inválidas. */
export function timeToMin(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

/** Descarta lixo, remove repetidos e ordena cronologicamente. */
export function normalizeTimes(times: string[]): string[] {
  const valid = times.filter((t) => Number.isFinite(timeToMin(t)))
  return [...new Set(valid.map((t) => minToTime(timeToMin(t))))].sort(
    (a, b) => timeToMin(a) - timeToMin(b),
  )
}

/** Config sempre utilizável: preenche o que faltar e sanea dias/horários. */
export function resolveAssistantConfig(
  config?: AssistantConfig | null,
  now: Date = new Date(),
): AssistantConfig {
  const base = config ?? DEFAULT_ASSISTANT_CONFIG
  const byWeekday = new Map<number, AssistantDay>()
  for (const d of base.days ?? []) {
    if (!Number.isInteger(d?.weekday) || d.weekday < 0 || d.weekday > 6) continue
    const times = normalizeTimes(d.times ?? [])
    if (!times.length) continue
    const faixas = normalizeFaixas(d.faixas)
    byWeekday.set(
      d.weekday,
      faixas.length ? { weekday: d.weekday, times, faixas } : { weekday: d.weekday, times },
    )
  }
  const days = [...byWeekday.values()].sort((a, b) => a.weekday - b.weekday)
  return {
    days,
    durationMin: clamp(base.durationMin, 15, 180, DEFAULT_ASSISTANT_CONFIG.durationMin),
    leadHours: clamp(base.leadHours, 0, 168, DEFAULT_ASSISTANT_CONFIG.leadHours),
    horizonDays: clamp(base.horizonDays, 1, 90, DEFAULT_ASSISTANT_CONFIG.horizonDays),
    greeting: base.greeting ?? '',
    busy: normalizeBusy(base.busy, now),
  }
}

function clamp(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

/** Total de horários marcados na semana — usado no resumo do editor. */
export function weeklySlotCount(config: AssistantConfig): number {
  return config.days.reduce((sum, d) => sum + d.times.length, 0)
}

// ---- Faixas de atendimento ("das 07:00 às 11:00") --------------------------
//
// Ninguém pensa a própria agenda hora por hora: pensa "de manhã das 7 às 11, de
// tarde das 13 às 17". O editor monta a grade assim, e os horários saem da faixa
// no passo da duração do atendimento. A conversa continua oferecendo `times` —
// as faixas são só a forma de escrever, guardada para o editor reabrir igual.

/** Teto de faixas por dia (o servidor corta no mesmo número). */
export const MAX_FAIXAS = 12

/** 23:59 — o último minuto que uma faixa pode alcançar. */
export const FIM_DO_DIA = 23 * 60 + 59

/** Faixas utilizáveis: formato de hora, início antes do fim, com teto. Mantém a ordem digitada. */
export function normalizeFaixas(raw: unknown): FaixaDeAtendimento[] {
  if (!Array.isArray(raw)) return []
  const out: FaixaDeAtendimento[] = []
  for (const f of raw as Partial<FaixaDeAtendimento>[]) {
    const ini = timeToMin(String(f?.inicio ?? ''))
    const fim = timeToMin(String(f?.fim ?? ''))
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || ini >= fim) continue
    out.push({ inicio: minToTime(ini), fim: minToTime(fim) })
    if (out.length === MAX_FAIXAS) break
  }
  return out
}

/**
 * Os horários que cabem nas faixas: começa no início e anda de `durationMin` em
 * `durationMin`, oferecendo só o atendimento que TERMINA até o fim da faixa — "das
 * 7 às 11" com uma hora dá 07:00, 08:00, 09:00 e 10:00, nunca 11:00. Faixa mais
 * curta que um atendimento ainda oferece o início: sumir com ela em silêncio
 * seria pior do que passar alguns minutos.
 */
export function horariosDasFaixas(faixas: FaixaDeAtendimento[], durationMin: number): string[] {
  const passo = Math.max(15, Math.round(durationMin) || 60)
  const out: string[] = []
  for (const f of faixas) {
    const ini = timeToMin(f.inicio)
    const fim = timeToMin(f.fim)
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || ini >= fim) continue
    for (let m = ini; m === ini || m + passo <= fim; m += passo) out.push(minToTime(m))
  }
  return normalizeTimes(out)
}

/**
 * As faixas de um dia, para o editor mostrar.
 *
 * As gravadas valem só se ainda geram exatamente os horários do dia — senão foram
 * escritas por outra versão, ou a duração mudou por fora, e mostrar a faixa
 * diria uma coisa enquanto a conversa oferece outra. Nesse caso (e na grade
 * antiga, que só tem horários) a faixa é reconstruída juntando os horários
 * seguidos no passo da duração: nada muda no que o visitante vê.
 */
export function faixasDoDia(day: AssistantDay, durationMin: number): FaixaDeAtendimento[] {
  const times = normalizeTimes(day.times ?? [])
  const gravadas = normalizeFaixas(day.faixas)
  if (gravadas.length && horariosDasFaixas(gravadas, durationMin).join() === times.join()) {
    return gravadas
  }
  const faixa = (ini: number, fim: number): FaixaDeAtendimento => ({
    inicio: minToTime(ini),
    fim: minToTime(Math.min(fim, FIM_DO_DIA)),
  })
  const out: FaixaDeAtendimento[] = []
  let ini: number | null = null
  let ultimo = 0
  for (const t of times) {
    const m = timeToMin(t)
    if (ini !== null && m - ultimo === durationMin) {
      ultimo = m
      continue
    }
    if (ini !== null) out.push(faixa(ini, ultimo + durationMin))
    ini = m
    ultimo = m
  }
  if (ini !== null) out.push(faixa(ini, ultimo + durationMin))
  return out
}

/** Um dia montado a partir das faixas — os horários sempre saem delas. */
export function diaDasFaixas(
  weekday: number,
  faixas: FaixaDeAtendimento[],
  durationMin: number,
): AssistantDay {
  return { weekday, faixas, times: horariosDasFaixas(faixas, durationMin) }
}

/**
 * Os horários da grade que ficariam EM CIMA de um compromisso: começam antes de
 * ele acabar e acabariam depois de ele começar. Uma reunião das 14:00 às 16:00
 * fecha 14:00 e 15:00 — e, com atendimentos de 45 minutos, também o das 13:30.
 */
export function horariosQueBatem(
  times: string[],
  inicio: string,
  duracaoMin: number,
  durationMin: number,
): string[] {
  const ini = timeToMin(inicio)
  const fim = ini + duracaoMin
  return times.filter((t) => {
    const m = timeToMin(t)
    return m < fim && m + durationMin > ini
  })
}

/** A faixa em que um horário cai — "das 13:00 às 17:00" para 16:00 —, ou `null`. */
export function faixaDoHorario(
  day: AssistantDay,
  time: string,
  durationMin: number,
): FaixaDeAtendimento | null {
  const m = timeToMin(time)
  return (
    faixasDoDia(day, durationMin).find((f) => timeToMin(f.inicio) <= m && m < timeToMin(f.fim)) ??
    null
  )
}

/**
 * O que o advogado precisa saber sobre as faixas que digitou.
 *
 * Nada disso é erro — a grade continua valendo —, mas em cada caso a faixa diz
 * uma coisa e a conversa oferece outra: "das 18:00 às 18:30" com atendimentos de
 * uma hora oferece um horário que termina às 19:00; "das 07:00 às 11:30" deixa
 * meia hora sem horário; duas faixas sobrepostas repetem horários. Sem o aviso,
 * ele só descobre olhando a conversa de fora.
 */
export function avisosDasFaixas(faixas: FaixaDeAtendimento[], durationMin: number): string[] {
  const avisos: string[] = []
  for (const f of faixas) {
    const ini = timeToMin(f.inicio)
    const fim = timeToMin(f.fim)
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || ini >= fim) continue
    const tamanho = fim - ini
    if (tamanho < durationMin) {
      const termina = ini + durationMin
      avisos.push(
        `Das ${f.inicio} às ${f.fim} não cabe um atendimento de ${durationMin} min: só ${f.inicio} é oferecido, e ele termina ${
          termina >= 24 * 60 ? 'depois da meia-noite' : `às ${minToTime(termina)}`
        }.`,
      )
      continue
    }
    const sobra = tamanho % durationMin
    if (sobra >= 15) {
      const ultimo = ini + (Math.floor(tamanho / durationMin) - 1) * durationMin
      avisos.push(
        `Das ${f.inicio} às ${f.fim}, o último atendimento vai das ${minToTime(ultimo)} às ${minToTime(ultimo + durationMin)}: os ${sobra} min finais ficam sem horário.`,
      )
    }
  }
  for (let i = 0; i < faixas.length; i++) {
    for (let j = i + 1; j < faixas.length; j++) {
      const a = faixas[i]
      const b = faixas[j]
      if (timeToMin(a.inicio) < timeToMin(b.fim) && timeToMin(b.inicio) < timeToMin(a.fim)) {
        avisos.push(
          `As faixas ${a.inicio}–${a.fim} e ${b.inicio}–${b.fim} se sobrepõem: os horários repetidos aparecem uma vez só.`,
        )
      }
    }
  }
  return avisos
}

// ---- Datas oferecidas na conversa ----

export interface AssistantDayOption {
  /** chave estável YYYY-MM-DD (hora local) */
  key: string
  date: Date
  weekday: number
  /** "Seg, 25 ago" — texto do chip */
  label: string
  /** "segunda-feira, 25 de agosto" — leitores de tela e resumo */
  longLabel: string
  /** "hoje" / "amanhã" quando aplicável, senão vazio */
  relative: string
  times: string[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Nome do dia por extenso, em minúsculas ("segunda-feira", "sábado"). */
export function weekdayLong(weekday: number): string {
  const name = WEEKDAYS_FULL[weekday] ?? ''
  const util = weekday >= 1 && weekday <= 5
  return `${name.toLowerCase()}${util ? '-feira' : ''}`
}

/** Chave estável de um dia, na hora local: 25/11/2026 → "2026-11-25". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Um dia concreto com os horários informados, já com os rótulos da conversa. */
function describeDay(day: Date, times: string[], now: Date): AssistantDayOption {
  const wd = day.getDay()
  const hoje = new Date(now)
  hoje.setHours(0, 0, 0, 0)
  const dias = Math.round((day.getTime() - hoje.getTime()) / 86_400_000)
  return {
    key: dayKey(day),
    date: day,
    weekday: wd,
    label: `${WEEKDAYS_SHORT[wd]}, ${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`,
    longLabel: `${weekdayLong(wd)}, ${day.getDate()} de ${MONTHS_FULL[day.getMonth()]}`,
    relative: dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : '',
    times,
  }
}

/**
 * Datas concretas que o assistente pode oferecer: percorre os próximos
 * `horizonDays` dias, mantém só os dias da semana configurados e, dentro deles, só
 * os horários que ainda respeitam a antecedência mínima e que o advogado não
 * marcou como ocupados. Dias sem horário livre simplesmente não aparecem.
 */
export function buildAssistantDays(
  config: AssistantConfig,
  now: Date = new Date(),
): AssistantDayOption[] {
  const cfg = resolveAssistantConfig(config, now)
  const byWeekday = new Map(cfg.days.map((d) => [d.weekday, d.times]))
  const minTime = now.getTime() + cfg.leadHours * 3600_000
  const ocupados = new Set(cfg.busy ?? [])
  const out: AssistantDayOption[] = []

  for (let i = 0; i <= cfg.horizonDays; i++) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() + i)
    const times = byWeekday.get(day.getDay())
    if (!times?.length) continue

    const key = dayKey(day)
    const free = times.filter((t) => {
      if (ocupados.has(busyKey(key, t))) return false
      const slot = new Date(day)
      slot.setMinutes(timeToMin(t))
      return slot.getTime() >= minTime
    })
    if (!free.length) continue

    out.push(describeDay(day, free, now))
  }
  return out
}

// ---- Horários ocupados (marcados pelo próprio advogado) --------------------
//
// O assistente oferece uma GRADE semanal, que se repete. A vida não se repete: o
// cliente que ligou direto, a audiência, o horário combinado por fora. Sem um
// jeito de dizer "esse já foi", a conversa segue oferecendo um horário que não
// existe mais — e quem descobre isso é o visitante, depois de mandar o pedido.
//
// A marcação é só data + hora. Nunca de quem é o compromisso, nunca o motivo: o
// assistente não guarda dado de ninguém, e continua não guardando.

/** Formato de um horário ocupado: "2026-11-25T14:00" (hora local, sem fuso). */
const BUSY_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/

/** Teto de horários guardados — a lista se limpa sozinha, mas nunca cresce sem fim. */
export const MAX_BUSY = 400

/** "2026-11-25" + "14:00" → "2026-11-25T14:00". */
export function busyKey(day: string, time: string): string {
  return `${day}T${time}`
}

/** Existe mesmo? Barra 31/02 e afins, que o formato sozinho deixaria passar. */
function dataReal(ano: number, mes: number, dia: number): boolean {
  const d = new Date(ano, mes - 1, dia)
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia
}

/**
 * Descarta o que não é horário, o que já passou e o que se repete; ordena e limita.
 *
 * Jogar o passado fora na própria normalização é o que impede a lista de virar
 * arquivo morto: ela encolhe sozinha a cada leitura e a cada gravação, sem faxina
 * agendada, sem tarefa noturna, sem uma linha de infraestrutura a mais.
 */
export function normalizeBusy(list: unknown, now: Date = new Date()): string[] {
  const hoje = dayKey(now)
  const valid = (Array.isArray(list) ? list : []).filter((v): v is string => {
    if (typeof v !== 'string') return false
    const m = BUSY_RE.exec(v)
    return !!m && v.slice(0, 10) >= hoje && dataReal(Number(m[1]), Number(m[2]), Number(m[3]))
  })
  return [...new Set(valid)].sort().slice(0, MAX_BUSY)
}

/**
 * Os horários de UMA data específica que ainda estão livres — inclusive de uma
 * data além do horizonte que a conversa pública alcança hoje. É o que o advogado
 * usa para marcar: ele sabe de um compromisso que o assistente ainda nem começou
 * a oferecer, e adiantar isso não custa nada.
 *
 * Devolve `null` quando a data não existe, já passou, cai num dia que ele não
 * atende ou não sobrou horário — os casos em que não há o que marcar.
 */
export function assistantDayAt(
  config: AssistantConfig,
  key: string,
  now: Date = new Date(),
): AssistantDayOption | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (!dataReal(ano, mes, dia)) return null
  if (key < dayKey(now)) return null

  const day = new Date(ano, mes - 1, dia)
  const cfg = resolveAssistantConfig(config, now)
  const times = cfg.days.find((d) => d.weekday === day.getDay())?.times ?? []
  const ocupados = new Set(cfg.busy ?? [])
  // Hoje, o que já começou não tem mais o que fechar: some da lista em vez de
  // virar um toque que não muda nada para quem visita.
  const agoraMin = key === dayKey(now) ? now.getHours() * 60 + now.getMinutes() : -1
  const livres = times.filter((t) => !ocupados.has(busyKey(key, t)) && timeToMin(t) > agoraMin)
  if (!livres.length) return null
  return describeDay(day, livres, now)
}

/** Por que uma data não tem horário para fechar — cada caso pede uma resposta diferente. */
export type SemHorario = 'data-invalida' | 'passada' | 'nao-atende' | 'lotado' | 'ja-passaram'

/**
 * O motivo de `assistantDayAt` ter devolvido `null`.
 *
 * "Não há horário" sozinho deixa o advogado sem saber o que fazer: a data já
 * passou? ele não atende nesse dia da semana? já fechou tudo? os de hoje já
 * passaram? Cada resposta leva a um gesto diferente, e a conversa precisa dizer
 * qual. Devolve `null` quando a data TEM horário livre.
 */
export function motivoSemHorario(
  config: AssistantConfig,
  key: string,
  now: Date = new Date(),
): SemHorario | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m || !dataReal(Number(m[1]), Number(m[2]), Number(m[3]))) return 'data-invalida'
  if (key < dayKey(now)) return 'passada'
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const cfg = resolveAssistantConfig(config, now)
  const times = cfg.days.find((d) => d.weekday === day.getDay())?.times ?? []
  if (!times.length) return 'nao-atende'
  const ocupados = new Set(cfg.busy ?? [])
  const livres = times.filter((t) => !ocupados.has(busyKey(key, t)))
  if (!livres.length) return 'lotado'
  if (key === dayKey(now)) {
    const agoraMin = now.getHours() * 60 + now.getMinutes()
    if (livres.every((t) => timeToMin(t) <= agoraMin)) return 'ja-passaram'
  }
  return null
}

/**
 * Tem FORMA de data ("31/02", "25/13")? Serve para responder "essa data não
 * existe" em vez de "não entendi" — quem digitou 31/02 escreveu uma data, só errou.
 */
export function pareceData(text: string): boolean {
  return /^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2}|\d{4}))?$/.test(text.trim())
}

/**
 * O que o advogado digitou, virando data: "25/11", "25/11/26", "25-11-2026".
 * Sem o ano, vale a PRÓXIMA ocorrência (hoje inclusive) — quem escreve "25/11"
 * em dezembro está falando do ano que vem, e ninguém marca para trás.
 */
export function parseBrDate(text: string, now: Date = new Date()): string | null {
  const m = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2}|\d{4}))?$/.exec(text.trim())
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null

  if (m[3]) {
    const bruto = Number(m[3])
    const ano = bruto < 100 ? 2000 + bruto : bruto
    return dataReal(ano, mes, dia) ? `${ano}-${pad2(mes)}-${pad2(dia)}` : null
  }
  const hoje = dayKey(now)
  for (const ano of [now.getFullYear(), now.getFullYear() + 1]) {
    if (!dataReal(ano, mes, dia)) continue
    const key = `${ano}-${pad2(mes)}-${pad2(dia)}`
    if (key >= hoje) return key
  }
  return null
}

/** "2026-11-25T14:00" → "quarta-feira, 25 de novembro às 14:00". */
export function formatBusyLong(key: string): string {
  const m = BUSY_RE.exec(key)
  if (!m) return ''
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${weekdayLong(day.getDay())}, ${day.getDate()} de ${MONTHS_FULL[day.getMonth()]} às ${key.slice(11)}`
}

/** "25 nov · 14:00" — rótulo curto, para as fichas do editor. */
export function formatBusyShort(key: string): string {
  const m = BUSY_RE.exec(key)
  if (!m) return ''
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${day.getDate()} ${MONTHS_SHORT[day.getMonth()]} · ${key.slice(11)}`
}

const MONTHS_FULL = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// ---- Endereço no roteiro presencial ----

/**
 * A fala do assistente logo depois de alguém escolher **presencial**.
 *
 * Quem marca uma conversa presencial acabou de decidir sair de casa, e a
 * pergunta imediata é "onde?". Deixar isso para o visitante procurar de volta no
 * topo da página — ou, pior, perguntar no WhatsApp — é a conversa devolvendo ao
 * usuário um trabalho que ela já tinha como fazer.
 *
 * Vem com a cidade, ao contrário da linha do perfil: o histórico da conversa é
 * lido (e às vezes fotografado) fora do contexto da página.
 *
 * Devolve string vazia quando não há endereço publicado — e aí a conversa segue
 * exatamente como seguia antes, sem uma fala pela metade.
 */
export function falaDoEnderecoPresencial(local: {
  address?: Endereco
  city: string
  state: string
}): string {
  if (!enderecoVisivel(local.address)) return ''
  return `O atendimento presencial é em ${enderecoEmLinha(local.address, local.city, local.state)}.`
}

// ---- Identidade do assistente ----
// Mora em assistantTitle.ts (módulo leve, pelo peso do pacote do minisite) e é
// reexportada aqui para os consumidores do lado pesado não mudarem.

import { firstName } from './assistantTitle'
export { assistantTitle, firstName } from './assistantTitle'

// ---- Mensagem final (WhatsApp) ----

export interface AssistantAnswers {
  day?: AssistantDayOption
  time?: string
  /** 'presencial' | 'online' — só perguntado quando o perfil atende dos dois jeitos */
  format?: string
  subject?: string
  detail?: string
  name?: string
  /**
   * As perguntas da TRIAGEM respondidas, na ordem em que foram feitas (plano
   * Max — ver lib/triagem.ts). Vazio ou ausente no perfil sem triagem, e aí a
   * mensagem sai exatamente como sempre saiu.
   */
  triagem?: RespostaDeTriagem[]
}

/** Resumo humano do horário escolhido: "segunda-feira, 25 de agosto às 14:00". */
export function formatChoice(answers: AssistantAnswers): string {
  if (!answers.day || !answers.time) return ''
  return `${answers.day.longLabel} às ${answers.time}`
}

/**
 * Monta a mensagem que o visitante envia ao advogado. Texto sóbrio e factual:
 * sem promessa, sem preço, sem apelo — só os dados do pedido.
 *
 * Com TRIAGEM, o bloco das perguntas entra depois dos campos estruturados, com a
 * ressalva de que aquilo foi escrito pelo visitante e não é análise jurídica
 * (ver linhasDaTriagem). A abertura e o fecho mudam quando não há horário
 * escolhido: uma triagem sem grade é um pedido de CONTATO, e prometer "aguardo a
 * confirmação" de um horário que ninguém marcou seria a mensagem mentindo.
 */
export function buildAssistantMessage(
  profile: Pick<Profile, 'name'>,
  answers: AssistantAnswers,
  durationMin?: number,
): string {
  const first = firstName(profile.name)
  const horario = formatChoice(answers)
  const fields: (string | null)[] = [
    answers.name?.trim() ? `Nome: ${answers.name.trim()}` : null,
    horario ? `Dia e horário: ${horario}` : null,
    horario && durationMin ? `Duração prevista: ${durationMin} min` : null,
    answers.format ? `Formato: ${cap(answers.format)}` : null,
    answers.subject?.trim() ? `Assunto: ${answers.subject.trim()}` : null,
    answers.detail?.trim() ? `Detalhe: ${answers.detail.trim()}` : null,
  ]
  const triagem = linhasDaTriagem(answers.triagem ?? [])
  return [
    `Olá${first ? `, ${first}` : ''}! Falei com seu assistente virtual no advoc.me e gostaria de ${
      horario ? 'marcar uma conversa' : 'falar com você'
    }.`,
    '',
    ...fields.filter((l): l is string => !!l),
    ...(triagem.length ? ['', ...triagem] : []),
    '',
    horario ? 'Fico no aguardo da sua confirmação.' : 'Fico no aguardo do seu retorno.',
  ].join('\n')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Link wa.me com a mensagem pronta — undefined se o perfil não tem WhatsApp. */
export function assistantWhatsappHref(
  profile: Pick<Profile, 'name' | 'contact'>,
  answers: AssistantAnswers,
  durationMin?: number,
): string | undefined {
  // O número passa por `whatsappHref`, que é quem sabe o formato que o wa.me
  // exige (só dígitos, com DDI). Montar a URL à mão aqui era o que deixava um
  // "+55 (11) …" gravado pela API virar link morto — ver lib/whatsapp.ts.
  return whatsappHref(profile.contact?.whatsapp, buildAssistantMessage(profile, answers, durationMin))
}

// ---- Assistente do ESCRITÓRIO ---------------------------------------------
//
// Cada advogado da sociedade é um perfil, e quem liga o assistente no próprio
// perfil tem uma grade e fecha os horários ocupados em /agenda. Quando o visitante
// escolhe um advogado assim, a conversa do escritório oferece os horários livres
// DESSA agenda — os mesmos do perfil dele. Sem escolha, ou com alguém sem agenda,
// não há de onde tirar horário: o roteiro pergunta dia e PERÍODO, como uma
// secretária faria, e quem recebe o pedido confirma.
//
// Duas travas de conformidade que valem aqui e não valem no perfil individual:
//   • a lista de advogados é sempre alfabética e nunca vem com recomendação
//     ("o mais indicado para o seu caso" é ranking, e ranking é vedado);
//   • escolher advogado é opcional — "tanto faz" é a primeira opção.

/** Preferência de horário oferecida pelo assistente do escritório. */
export interface FirmPeriodOption {
  id: string
  /** texto do chip */
  label: string
}

export const FIRM_PERIODS: FirmPeriodOption[] = [
  { id: 'esta-manha', label: 'Esta semana, de manhã' },
  { id: 'esta-tarde', label: 'Esta semana, à tarde' },
  { id: 'proxima-manha', label: 'Próxima semana, de manhã' },
  { id: 'proxima-tarde', label: 'Próxima semana, à tarde' },
  { id: 'tanto-faz', label: 'Tanto faz' },
]

/** "Sem preferência" na escolha de advogado — nunca uma sugestão da plataforma. */
export const FIRM_ANY_LAWYER = 'Tanto faz'

export interface FirmAssistantAnswers {
  area?: string
  /** nome do advogado escolhido; ausente = sem preferência */
  lawyer?: string
  /** id do advogado escolhido — é por ele que o destino é achado (nomes se repetem) */
  lawyerId?: string
  /** 'presencial' | 'online' */
  format?: string
  /** dia escolhido na agenda do advogado, quando ele tem uma */
  day?: AssistantDayOption
  /** horário escolhido nesse dia */
  time?: string
  /** rótulo da preferência de horário (ver FIRM_PERIODS) — quando não há agenda */
  period?: string
  name?: string
}

/**
 * Mensagem que o visitante envia ao escritório. Mesmo espírito da do perfil:
 * factual, sem promessa, sem preço, sem urgência — só o pedido organizado.
 */
export function buildFirmAssistantMessage(
  firmName: string,
  answers: FirmAssistantAnswers,
  durationMin?: number,
): string {
  // Horário da agenda vence a preferência de período: são respostas a perguntas
  // diferentes, e a mensagem não pode levar as duas e deixar a dúvida para quem lê.
  const horario = answers.day && answers.time ? `${answers.day.longLabel} às ${answers.time}` : ''
  const fields: (string | null)[] = [
    answers.name?.trim() ? `Nome: ${answers.name.trim()}` : null,
    answers.area ? `Assunto: ${answers.area}` : null,
    `Advogado(a): ${answers.lawyer?.trim() || 'sem preferência'}`,
    answers.format ? `Formato: ${capitalize(answers.format)}` : null,
    horario ? `Dia e horário: ${horario}` : null,
    horario && durationMin ? `Duração prevista: ${durationMin} min` : null,
    !horario && answers.period ? `Preferência de horário: ${answers.period}` : null,
  ]
  return [
    `Olá! Vim pela página do ${firmName} no advoc.me e gostaria de marcar uma conversa.`,
    '',
    ...fields.filter((l): l is string => !!l),
    '',
    'Fico no aguardo da confirmação.',
  ].join('\n')
}

/**
 * Para onde o pedido vai. O padrão é o WhatsApp INSTITUCIONAL: mantém o controle do
 * atendimento com o escritório, que é o que a maioria quer. Com `assistantRoute`
 * em 'lawyer', o pedido vai direto para o advogado escolhido — e cai no
 * institucional quando o visitante não escolheu ninguém ou o advogado não informou
 * WhatsApp.
 */
export interface FirmAssistantDestination {
  /** número que vai receber; ausente = ninguém informou WhatsApp */
  whatsapp?: string
  /** para quem o pedido vai, em palavras — a conversa mostra isso ao visitante */
  label: string
  /** true quando o pedido vai direto ao advogado escolhido */
  direct: boolean
}

/** O que o assistente precisa saber do escritório para decidir o destino. */
interface EscritorioDoAssistente {
  contact: { whatsapp?: string }
  lawyers: { id?: string; name: string; whatsapp?: string }[]
  assistantRoute?: string
}

/** Para quem o pedido vai, com o nome — o visitante precisa saber antes de enviar. */
export function firmAssistantDestination(
  firm: EscritorioDoAssistente,
  answers: FirmAssistantAnswers,
): FirmAssistantDestination {
  if (firm.assistantRoute === 'lawyer' && (answers.lawyerId || answers.lawyer)) {
    // Pelo id quando há: dois advogados com o mesmo nome (um com conta, outro
    // listado pelo escritório) mandariam o pedido para o número errado.
    const escolhido = answers.lawyerId
      ? firm.lawyers.find((l) => l.id === answers.lawyerId)
      : firm.lawyers.find((l) => l.name === answers.lawyer)
    // Número que não serve para o wa.me é o mesmo que não ter número: anunciar
    // "vai para Fulano" e entregar um link morto é pior que cair no escritório.
    if (escolhido?.whatsapp && whatsappHref(escolhido.whatsapp)) {
      return { whatsapp: escolhido.whatsapp, label: escolhido.name, direct: true }
    }
  }
  return { whatsapp: firm.contact.whatsapp, label: 'o escritório', direct: false }
}

/** Sem escolher advogado, o pedido tem para onde ir? Esse caminho é sempre o WhatsApp do escritório. */
export function firmRecebeSemPreferencia(firm: EscritorioDoAssistente): boolean {
  return !!whatsappHref(firm.contact.whatsapp)
}

/** Um pedido para ESTE advogado chega a alguém — direto a ele ou pelo escritório? */
export function firmAlcancaAdvogado(
  firm: EscritorioDoAssistente,
  lawyer: { whatsapp?: string },
): boolean {
  return (
    firmRecebeSemPreferencia(firm) ||
    (firm.assistantRoute === 'lawyer' && !!whatsappHref(lawyer.whatsapp))
  )
}

/**
 * Existe algum caminho para um pedido chegar a alguém? Sem nenhum, a conversa
 * avisa já na abertura — e não depois de a pessoa responder tudo.
 */
export function firmTemDestino(firm: EscritorioDoAssistente): boolean {
  return firmRecebeSemPreferencia(firm) || firm.lawyers.some((l) => firmAlcancaAdvogado(firm, l))
}

/** Só o número do destino (ver firmAssistantDestination). */
export function firmAssistantWhatsapp(
  firm: EscritorioDoAssistente,
  answers: FirmAssistantAnswers,
): string | undefined {
  return firmAssistantDestination(firm, answers).whatsapp
}

/** Link wa.me pronto — undefined quando não há número para receber o pedido. */
export function firmAssistantWhatsappHref(
  firm: EscritorioDoAssistente & { name: string },
  answers: FirmAssistantAnswers,
  durationMin?: number,
): string | undefined {
  // `firmAssistantWhatsapp` é quem escolhe o DESTINATÁRIO (o advogado da área, ou
  // a sociedade). Só o formato do número é assunto de `whatsappHref`.
  return whatsappHref(
    firmAssistantWhatsapp(firm, answers),
    buildFirmAssistantMessage(firm.name, answers, durationMin),
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
