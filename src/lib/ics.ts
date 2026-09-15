// O compromisso saindo daqui para a agenda do advogado.
//
// ELE ESCOLHE A AGENDA, E A AGENDA ABRE PREENCHIDA
//
// Baixar um arquivo e deixar o aparelho decidir parecia neutro, mas na prática é
// um download: o arquivo cai na pasta, ninguém sabe o que fazer com ele, e o
// compromisso não entra. Então a conversa pergunta EM QUAL agenda, e cada uma
// abre na própria tela de "novo evento" com dia, hora e nome já escritos — o
// advogado só confere e toca em Salvar.
//
// Nada disso é integração: Google e Outlook aceitam o evento inteiro num LINK
// (é navegação comum, sem conta nossa, sem permissão, sem token). O Calendário
// da Apple não tem link — lá vai o .ics (RFC 5545), que o iPhone abre direto na
// tela de adicionar. E o mesmo .ics fica como "outra agenda" para quem usa
// Samsung, Thunderbird e afins — o raciocínio do vCard do cartão digital.
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
// O título que o advogado digita ("Reunião — João") é montado NO APARELHO DELE
// e vai direto para a agenda que ELE escolheu. Não passa pela nossa API, não vai
// para o banco, não fica em log. A coluna do perfil continua guardando só data e
// hora — ver lib/assistant.ts, "Horários ocupados".

import { downloadFile } from './vcard'
import { semMeiaLetra } from './textLimit'

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

/** "2026-11-25T14:00" + minutos → Date no relógio do aparelho. */
function dataLocal(inicio: string, minutos = 0): Date {
  const [data, hora] = inicio.split('T')
  const [ano, mes, dia] = data.split('-').map(Number)
  const [h, m] = hora.split(':').map(Number)
  // Aritmética por Date: 23:30 + 45 min tem de virar o dia, e o mês, e o ano.
  return new Date(ano, mes - 1, dia, h, m + minutos)
}

/** "2026-11-25T14:00" + 45 min → "20261125T144500" (hora local, flutuante). */
function somarMinutos(inicio: string, minutos: number): string {
  const fim = dataLocal(inicio, minutos)
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

/**
 * Vários horários fechados de uma vez (o "dia todo") viram UM compromisso, do
 * primeiro início ao fim do último. Link de Google e Outlook só carrega um evento,
 * e oito eventos com o mesmo nome empilhados no dia não diriam nada que um bloco
 * só não diga melhor.
 */
export function emUmBloco(
  inicios: string[],
  duracaoMin: number,
  dados: Pick<Compromisso, 'titulo' | 'local' | 'descricao'>,
): Compromisso | null {
  if (!inicios.length) return null
  const ordem = [...inicios].sort()
  const primeiro = ordem[0]
  const ultimo = ordem[ordem.length - 1]
  const entre = Math.round((dataLocal(ultimo).getTime() - dataLocal(primeiro).getTime()) / 60_000)
  return { ...dados, inicio: primeiro, duracaoMin: entre + duracaoMin }
}

/** Baixa o .ics — o aparelho abre e pergunta em qual agenda salvar. */
export function baixarIcs(compromissos: Compromisso[], dono: string) {
  downloadFile(buildIcs(compromissos, dono), nomeDoArquivo(compromissos), 'text/calendar')
}

/** iPhone, iPad (que se apresenta como Mac, mas tem toque) ou iPod. */
export function ehIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** Qualquer aparelho da Apple — onde o Calendário da Apple faz sentido oferecer. */
export function ehApple(): boolean {
  if (typeof navigator === 'undefined') return false
  return ehIos() || /Macintosh/.test(navigator.userAgent)
}

/**
 * Safari de verdade — e não o Chrome, o Firefox ou o Edge do iPhone, nem o
 * navegador embutido do Instagram ou do WhatsApp.
 *
 * No iPhone o Calendário da Apple só recebe o compromisso pelo Safari (ver
 * abrirNoCalendarioDaApple): nos outros o toque não fazia nada, e o assistente
 * ainda dizia que tinha aberto. O navegador embutido se denuncia por não trazer
 * `Version/… Safari/` na identificação; os outros, pelo próprio nome.
 */
export function ehSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Version\/[\d.]+.*Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
}

/**
 * O nome do botão: o Calendário pelo aparelho que a pessoa tem na mão. O iPad
 * moderno se apresenta como Mac, e é o toque que o denuncia (ver ehIos).
 */
export function nomeDoCalendarioDaApple(): string {
  if (!ehIos()) return 'Calendário da Apple'
  return /iPhone|iPod/.test(navigator.userAgent) ? 'Calendário do iPhone' : 'Calendário do iPad'
}

/**
 * O Calendário da Apple não aceita evento por link, só por arquivo. No Mac, o
 * download abre o Calendário direto. No iPhone, só é oferecido no Safari (ver
 * ehSafari), e o arquivo sai como endereço `data:` com `download`, NA MESMA ABA:
 * o Safari reconhece o text/calendar e mostra a tela do evento com "Adicionar".
 *
 * É o caminho da add-to-calendar-button, a biblioteca de "adicionar à agenda" mais
 * usada. Antes abríamos o `data:` numa aba nova (`_blank`), e o próprio código dela
 * avisa que, no celular, isso esbarra em restrição de origem. Nunca foi conferido
 * num iPhone de verdade — é o primeiro teste a fazer quando algo falhar aqui.
 */
export function abrirNoCalendarioDaApple(compromissos: Compromisso[], dono: string) {
  if (!ehIos()) {
    baixarIcs(compromissos, dono)
    return
  }
  const a = document.createElement('a')
  a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(semMeiaLetra(buildIcs(compromissos, dono)))}`
  a.download = nomeDoArquivo(compromissos)
  // Com `download` a página não é trocada pelo arquivo, então a mesma aba é segura.
  a.target = '_self'
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => a.remove(), 1000)
}

/**
 * O compromisso como link do Google Agenda — abre a tela de novo evento já
 * preenchida. É NAVEGAÇÃO comum, e por isso passa até pelo navegador embutido (o
 * do Instagram, o do WhatsApp), que engole download sem erro nenhum — a mesma
 * armadilha de lib/whatsapp.ts.
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

/** Conta pessoal (Hotmail, Outlook.com) ou do trabalho (Microsoft 365). */
export type ContaMicrosoft = 'pessoal' | 'trabalho'

/**
 * O compromisso como link do Outlook — a tela de novo evento, preenchida.
 *
 * Conta pessoal e conta do trabalho moram em endereços diferentes, e um não
 * redireciona para o outro levando o evento: por isso são duas opções.
 *
 * O Outlook não tem parâmetro de fuso: a hora vai como INSTANTE em UTC (com `Z`),
 * calculada no relógio do aparelho — o mesmo em que o advogado disse "14h".
 * E o espaço vai como `%20`, não `+`: o Outlook mostra o `+` literal no título.
 *
 * O endereço é o `deeplink/compose` (com `path=/calendar/action/compose`), e não
 * `/calendar/0/action/compose`: este abre em branco ou só a agenda no celular,
 * sem o evento (relatado no Microsoft Q&A). A Microsoft não documenta nenhum dos
 * dois oficialmente — o deeplink é o formato que os geradores de "adicionar à
 * agenda" usam.
 */
export function linkOutlook(c: Compromisso, conta: ContaMicrosoft = 'pessoal'): string {
  const host = conta === 'trabalho' ? 'outlook.office.com' : 'outlook.live.com'
  const utc = (minutos: number) => `${dataLocal(c.inicio, minutos).toISOString().slice(0, 19)}Z`
  const params = new URLSearchParams({
    rru: 'addevent',
    subject: c.titulo,
    startdt: utc(0),
    enddt: utc(c.duracaoMin),
    allday: 'false',
  })
  if (c.descricao) params.set('body', c.descricao)
  if (c.local) params.set('location', c.local)
  // URLSearchParams já codificou todo `+` do texto como %2B; o `+` que sobra é espaço.
  return `https://${host}/calendar/deeplink/compose?path=/calendar/action/compose&${params.toString().replace(/\+/g, '%20')}`
}
