// Cartão de contato (vCard 3.0) e download de arquivos — usados tanto pela barra
// de compartilhar do perfil público quanto pelo "cartão digital" do editor.
//
// Só canais profissionais informados, sem linguagem de venda: serve para eventos
// (OAB, congressos) como captação passiva, dentro do Prov. 205/2021.

import type { Profile } from './types'
import { adrDoVCard } from './endereco'

export function buildVCard(profile: Profile, url: string): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${profile.name}`, `N:${profile.name};;;;`]
  lines.push(`TITLE:Advogado(a) — ${profile.oabNumber}`)
  if (profile.headline) lines.push(`ROLE:${profile.headline}`)
  if (profile.contact.whatsapp) lines.push(`TEL;TYPE=CELL:+${profile.contact.whatsapp}`)
  if (profile.contact.email) lines.push(`EMAIL;TYPE=WORK:${profile.contact.email}`)
  const site = profile.socials.find((s) => s.kind === 'website')?.url
  if (site) lines.push(`URL:${site}`)
  lines.push(`URL:${url}`)
  // O endereço vai INTEIRO quando existe: era só cidade/UF, e um contato salvo
  // sem rua nem CEP é um contato que não leva ninguém ao escritório. O ADR
  // completo (e o escape que a RFC exige) vive em lib/endereco.ts.
  //
  // O endereço marcado como não-público NÃO entra: o cartão que o visitante
  // salva é conteúdo público como qualquer outro, e vazá-lo por aqui seria a
  // forma mais silenciosa de furar o interruptor.
  const adr =
    profile.address?.publico === false
      ? adrDoVCard(undefined, profile.city, profile.state)
      : adrDoVCard(profile.address, profile.city, profile.state)
  if (adr) lines.push(adr)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function downloadFile(content: string | Blob, filename: string, type = 'text/plain') {
  const blob =
    typeof content === 'string' ? new Blob([content], { type: `${type};charset=utf-8` }) : content
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  // O link PRECISA estar no documento: o Firefox ignora `click()` em elemento
  // solto e o download simplesmente não acontece. E o endereço só é liberado no
  // quadro seguinte — revogar na mesma linha aborta o arquivo no Safari.
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a)
    URL.revokeObjectURL(href)
  }, 1000)
}
