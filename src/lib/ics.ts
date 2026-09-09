// O compromisso saindo daqui para a agenda do telefone — em iCalendar (.ics).
//
// POR QUE .ics, E NÃO "integrar com o Google"
//
// Integrar com uma agenda específica é escolher por quem usa: pede conta,
// permissão de escrita no calendário alheio, chave de API, renovação de token —
// e ainda deixa de fora quem usa iPhone, Outlook ou Samsung. O .ics inverte a
// pergunta: a gente entrega um ARQUIVO no formato que todas elas leem (RFC 5545)
// e é o próprio aparelho que decide qual agenda abre. Zero conta, zero permissão,
// zero servidor no meio — é o mesmo raciocínio do vCard do cartão digital.
//
// HORA LOCAL FLUTUANTE, DE PROPÓSITO
//
// `DTSTART:20261125T140000`, sem `Z` e sem `TZID`: a RFC chama isso de hora
// flutuante, e ela cai às 14h no relógio de quem abrir. É exatamente como a
// grade já pensa ("quarta às 14h", nunca um instante em UTC) — converter para
// fuso aqui só criaria bug de virada de dia sem entregar nada em troca.
//
// O QUE NÃO ATRAVESSA
//
// O título que o advogado digita ("Reunião — João") é montado e baixado NO
// APARELHO DELE. Não passa pela nossa API, não vai para o banco, não fica em
// log. A coluna do perfil continua guardando só data e hora — ver
// lib/assistant.ts, "Horários ocupados".

import { downloadFile } from './vcard'

export interface Compromisso {
  /** início em hora local, "AAAA-MM-DDTHH:MM" (a mesma chave dos ocupados) */
  inicio: string
  /** duração em minutos */
  duracaoMin: number
  /** título do evento — o que aparece na agenda */
  titulo: string
  /** endereço, quando o atendimento é presencial e o perfil publicou um */
  local?: string
  /** linha de contexto dentro do evento */
  descricao?: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Escapa o que a RFC 5545 reserva dentro de um valor de texto: vírgula e
 * ponto-e-vírgula separam campos, a contrabarra escapa, e a quebra de linha vira
 * `\n` literal. Sem isto, um endereço com vírgula ("Rua X, 100") parte o campo em
 * dois e a agenda importa lixo — ou recusa o arquivo inteiro.
 */
function escapar(valor: string): string {
  return valor
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Dobra linhas em 75 octetos, como a RFC exige — a continuação começa com um
 * espaço. Conta em BYTES (UTF-8), não em caracteres: "ã" ocupa dois, e dobrar
 * pela contagem de caracteres estoura o limite em texto com acento, que aqui é
 * todo texto. Nunca parte no meio de um caractere de vários bytes.
 */
function dobrar(linha: string): string {
  const bytes = new TextEncoder().encode(linha)
  if (bytes.length <= 75) return linha

  const partes: string[] = []
  let atual = ''
  let usados = 0
  let limite = 75
  for (const ch of linha) {
    const tamanho = new TextEncoder().encode(ch).length
    if (usados + tamanho > limite) {
      partes.push(atual)
      atual = ch
      usados = tamanho + 1 // o espaço da continuação também conta
      limite = 75
    } else {
      atual += ch
      usados += tamanho
    }
  }
  if (atual) partes.push(atual)
  return partes.join('\r\n ')
}

/** "2026-11-25T14:00" + 45 min → "20261125T144500" (hora local, flutuante). */
function somarMinutos(inicio: string, minutos: number): string {
  const [data, hora] = inicio.split('T')
  const [ano, mes, dia] = data.split('-').map(Number)
  const [h, m] = hora.split(':').map(Number)
  // Aritmética por Date: 23:30 + 45 min tem de virar o dia, e o mês, e o ano.
  const fim = new Date(ano, mes - 1, dia, h, m + minutos)
  return (
    `${fim.getFullYear()}${pad2(fim.getMonth() + 1)}${pad2(fim.getDate())}` +
    `T${pad2(fim.getHours())}${pad2(fim.getMinutes())}00`
  )
}

/** "2026-11-25T14:00" → "20261125T140000". */
function comoIcs(inicio: string): string {
  return `${inicio.slice(0, 4)}${inicio.slice(5, 7)}${inicio.slice(8, 10)}T${inicio.slice(11, 13)}${inicio.slice(14, 16)}00`
}

/** Agora em UTC, formato do DTSTAMP: "20260909T153000Z". */
function agoraUtc(agora: Date): string {
  return `${agora.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

/**
 * O arquivo .ics com um ou mais compromissos.
 *
 * `dono` entra só no UID — o identificador estável do evento. Estável importa:
 * adicionar o mesmo horário duas vezes ATUALIZA o evento na agenda em vez de
 * criar um segundo idêntico, que é o que acontece com UID sorteado.
 */
export function buildIcs(
  compromissos: Compromisso[],
  dono: string,
  agora: Date = new Date(),
): string {
  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//advoc.me//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const c of compromissos) {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${c.inicio.replace(/[-:]/g, '')}-${dono || 'perfil'}@advoc.me`,
      `DTSTAMP:${agoraUtc(agora)}`,
      `DTSTART:${comoIcs(c.inicio)}`,
      `DTEND:${somarMinutos(c.inicio, c.duracaoMin)}`,
      `SUMMARY:${escapar(c.titulo)}`,
    )
    if (c.local) linhas.push(`LOCATION:${escapar(c.local)}`)
    if (c.descricao) linhas.push(`DESCRIPTION:${escapar(c.descricao)}`)
    linhas.push(
      // Lembrete uma hora antes. É o padrão de quem marca reunião, e chega antes
      // de o compromisso virar surpresa.
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT1H',
      `DESCRIPTION:${escapar(c.titulo)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }

  linhas.push('END:VCALENDAR')
  // CRLF é exigência da RFC, não gosto: agenda que segue a norma à risca recusa
  // arquivo com LF sozinho.
  return linhas.map(dobrar).join('\r\n') + '\r\n'
}

/** Nome do arquivo: "consulta-2026-11-25-1400.ics". */
export function nomeDoArquivo(compromissos: Compromisso[]): string {
  if (compromissos.length === 1) {
    const c = compromissos[0]
    return `compromisso-${c.inicio.slice(0, 10)}-${c.inicio.slice(11, 13)}${c.inicio.slice(14, 16)}.ics`
  }
  return `compromissos-${compromissos.length}.ics`
}

/** Baixa o .ics — o aparelho abre e pergunta em qual agenda salvar. */
export function baixarIcs(compromissos: Compromisso[], dono: string) {
  downloadFile(buildIcs(compromissos, dono), nomeDoArquivo(compromissos), 'text/calendar')
}

/**
 * Plano B: o mesmo compromisso como link do Google Agenda.
 *
 * Existe por causa do navegador embutido (o do Instagram, o do WhatsApp), que
 * engole download de arquivo sem erro nenhum — a mesma armadilha documentada em
 * lib/whatsapp.ts. Este caminho é NAVEGAÇÃO comum, e navegação eles deixam
 * passar. Um evento só: o formato de link do Google não carrega vários.
 *
 * `ctz` sai do fuso do próprio aparelho, e não de uma constante: sem ele o
 * Google lê a data como UTC e o compromisso das 14h chega às 11h. Fixar
 * "America/Sao_Paulo" erraria com quem atende no Acre.
 */
export function linkGoogleAgenda(c: Compromisso): string {
  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: c.titulo,
    dates: `${comoIcs(c.inicio)}/${somarMinutos(c.inicio, c.duracaoMin)}`,
    ctz: fuso,
  })
  if (c.descricao) params.set('details', c.descricao)
  if (c.local) params.set('location', c.local)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
