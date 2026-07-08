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
