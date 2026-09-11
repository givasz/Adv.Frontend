// Entregar o PDF a quem pediu — no computador e no celular.
//
// No computador, download comum. No celular (toque como ponteiro principal), a
// folha de compartilhar do sistema: o Safari do iPhone ignora o atributo
// `download` e abriria o PDF numa aba — de onde a pessoa não sabe tirar o
// arquivo. Mesma decisão do cartão de visita (lib/cardExport.ts).
//
// A folha de compartilhar exige o gesto do usuário ainda "fresco": por isso a
// tela gera o arquivo ANTES e só chama isto no clique do botão de baixar.

import { downloadFile } from '../vcard'

export async function entregarPdf(bytes: Uint8Array, nome: string): Promise<void> {
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  const blob = new Blob([copia.buffer], { type: 'application/pdf' })
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean
    share?: (d: { files: File[]; title?: string }) => Promise<void>
  }
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (toque && typeof File !== 'undefined' && nav.canShare && nav.share) {
    try {
      const arquivo = new File([blob], nome, { type: 'application/pdf' })
      if (nav.canShare({ files: [arquivo] })) {
        await nav.share({ files: [arquivo], title: nome })
        return
      }
    } catch (e) {
      // Cancelar a folha não é erro — é a pessoa desistindo. Qualquer outra
      // recusa cai no download comum.
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  downloadFile(blob, nome)
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export function dataEHora(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : DATA_HORA.format(d)
}

export function dataCurtaDeTela(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : DATA.format(d)
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  const kb = bytes / 1024
  if (kb < 1024) return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(kb)} KB`
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(kb / 1024)} MB`
}
