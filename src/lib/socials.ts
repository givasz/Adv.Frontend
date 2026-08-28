// Validação de links de redes sociais do perfil.
//
// Objetivo de conformidade: o Prov. 205/2021 permite links de contato/redes, mas
// eles devem levar a CANAIS PROFISSIONAIS (não ao perfil pessoal do advogado) e
// à plataforma correta. Aqui checamos o que dá para checar automaticamente:
//  - a URL é válida e usa http(s);
//  - o domínio corresponde à rede escolhida (ex.: Instagram → instagram.com).
// Não há como um sistema decidir se um perfil é "pessoal" ou "profissional"; por
// isso o editor também exibe um lembrete fixo orientando o advogado.

import type { SocialKind } from './types'

export type SocialCheck = 'empty' | 'ok' | 'invalid' | 'mismatch'

export interface SocialValidation {
  status: SocialCheck
  message?: string
}

// Domínios aceitos por rede (sem "www."). `website` aceita qualquer host.
const HOSTS: Record<Exclude<SocialKind, 'website'>, string[]> = {
  instagram: ['instagram.com'],
  linkedin: ['linkedin.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
}

const PLATFORM_LABEL: Record<SocialKind, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  website: 'site',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
}

function normalizeHost(host: string): string {
  return host.replace(/^www\./, '').toLowerCase()
}

export function validateSocialUrl(kind: SocialKind, rawUrl: string): SocialValidation {
  const url = rawUrl.trim()
  if (!url) return { status: 'empty' }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return {
      status: 'invalid',
      message: 'Endereço inválido. Cole a URL completa, começando com https://',
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { status: 'invalid', message: 'Use um link https:// (canal profissional na web).' }
  }

  if (kind === 'website') return { status: 'ok' }

  const host = normalizeHost(parsed.hostname)
  const accepted = HOSTS[kind]
  const matches = accepted.some((h) => host === h || host.endsWith(`.${h}`))
  if (!matches) {
    return {
      status: 'mismatch',
      message: `Este link não parece ser do ${PLATFORM_LABEL[kind]}. Confira se colou no campo certo.`,
    }
  }

  return { status: 'ok' }
}

// ---------------------------------------------------------------------------
// ENTRADA HUMANA → ENDEREÇO DE VERDADE
//
// Ninguém decora a URL do próprio perfil. As pessoas escrevem `@joaosilva`, ou
// `joaosilva`, ou colam `instagram.com/joaosilva` sem o `https://`. Nada disso
// era aceito: o campo avisava "Endereço inválido", a pessoa salvava assim mesmo
// e o servidor DESCARTAVA a rede em silêncio — `safeUrl('@joao')` monta
// `https://@joao`, que não tem hostname, devolve null, e o `.filter` remove a
// linha. O link simplesmente sumia do perfil, sem erro e sem aviso.
//
// A regra aqui é a mesma do resto do produto: consertar o que dá para consertar
// sozinho, e explicar em português o que não dá.
// ---------------------------------------------------------------------------

/**
 * Onde mora o perfil de cada rede. `website` não entra: um site não tem
 * "usuário", então `@algo` ali é engano de campo, não abreviação.
 */
const BASE_DO_PERFIL: Record<Exclude<SocialKind, 'website'>, string> = {
  instagram: 'https://instagram.com/',
  // O LinkedIn separa pessoa (/in/) de empresa (/company/). Quem escreve só o
  // usuário está falando do próprio perfil — que é o caso deste campo.
  linkedin: 'https://linkedin.com/in/',
  facebook: 'https://facebook.com/',
  // YouTube e TikTok carregam o @ no PRÓPRIO endereço, ao contrário das outras.
  youtube: 'https://youtube.com/@',
  tiktok: 'https://tiktok.com/@',
}

export interface SocialNormalization {
  /** o valor a gravar — vazio quando não deu para entender */
  url: string
  /** mudou em relação ao que foi digitado? (a tela avisa o que foi entendido) */
  changed: boolean
  /** por que não deu, quando `url` volta vazio e havia texto */
  error?: string
}

/** Usuário válido: letras, números, ponto, hífen, sublinhado. Sem espaço. */
const USUARIO_OK = /^[a-zA-Z0-9._-]+$/

/**
 * Interpreta o que foi digitado no campo de uma rede.
 *
 * Chamada ao SAIR do campo, nunca a cada tecla: reescrever o texto enquanto a
 * pessoa digita faz o cursor pular e transforma `i` em `https://instagram.com/i`
 * antes de ela terminar a palavra.
 */
export function normalizeSocialUrl(kind: SocialKind, raw: string): SocialNormalization {
  const texto = raw.trim()
  if (!texto) return { url: '', changed: false }

  const igual = (url: string) => ({ url, changed: url !== raw })

  // Já veio com esquema: é endereço, e o que decide se presta é validateSocialUrl.
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) return igual(texto)

  const arroba = texto.startsWith('@')
  const semArroba = arroba ? texto.slice(1) : texto

  if (arroba && !semArroba) {
    return { url: '', changed: false, error: 'Falta o usuário depois do @.' }
  }

  // Endereço colado sem o `https://`. O que separa endereço de usuário é a
  // BARRA, não o ponto: `joao.silva` é um usuário legítimo no Facebook e no
  // Instagram, e tratá-lo como domínio produzia `https://joao.silva` — um link
  // morto, gravado sem que ninguém percebesse.
  //
  // Num campo de rede, um domínio sem caminho (`instagram.com`) não aponta para
  // perfil nenhum; quem cola endereço cola o caminho junto, e aí vem a barra.
  // (`@` na frente de um endereço é dedo trocado, não abreviação.)
  const ehEnderecoDaPropriaRede =
    kind !== 'website' &&
    HOSTS[kind].some((h) => {
      const semWww = normalizeHost(semArroba)
      return semWww === h || semWww.endsWith(`.${h}`)
    })
  if (semArroba.includes('/') || ehEnderecoDaPropriaRede) {
    return igual(`https://${semArroba}`)
  }
  // O site é o único campo em que um domínio solto É a resposta certa.
  if (kind === 'website' && semArroba.includes('.')) {
    return igual(`https://${semArroba}`)
  }

  // Daqui para baixo é um nome de usuário solto.
  if (kind === 'website') {
    return {
      url: '',
      changed: false,
      error: 'Um site precisa do endereço completo, como seusite.com.br.',
    }
  }
  if (!USUARIO_OK.test(semArroba)) {
    return {
      url: '',
      changed: false,
      error: 'Nome de usuário não pode ter espaços nem símbolos. Ou cole o link completo.',
    }
  }
  return igual(`${BASE_DO_PERFIL[kind]}${semArroba}`)
}

/**
 * Frase curta explicando o que foi entendido, para a tela mostrar depois da
 * correção automática. Sem isto, o campo mudaria sozinho debaixo da pessoa —
 * que é a diferença entre um produto prestativo e um que parece ter um bug.
 */
export function explicaNormalizacao(digitado: string, url: string): string | null {
  if (!url || url === digitado.trim()) return null
  return `Entendemos como ${url}`
}
