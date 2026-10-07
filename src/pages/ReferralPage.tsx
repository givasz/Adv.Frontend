import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { capturarIndicacao } from '@/lib/partners'
import { caminhoDeVolta } from '@/components/ui/SubPage'
import { Marca } from '@/components/ui/Marca'

// advoc.me/r/:code — o link de um participante do Programa Advocme Parceiros.
//
// A página não mostra NADA do parceiro: nem nome, nem foto, nem perfil. Quem
// chega aqui está conhecendo o software, não um advogado — e o link não pode virar
// vitrine de ninguém. Ela grava a indicação (o servidor decide se o código vale) e
// leva ao cadastro. Código inválido, servidor fora ou rede lenta: leva ao cadastro
// do mesmo jeito.

/** Quanto esperar pela captura antes de seguir assim mesmo. */
const ESPERA_MAXIMA_MS = 2500

/** /criar-conta, levando o `next` só se for caminho interno. */
export function destinoDoCadastro(next: string | null | undefined): string {
  const destino = caminhoDeVolta(next, '')
  return destino ? `/criar-conta?next=${encodeURIComponent(destino)}` : '/criar-conta'
}

/** Captura e segue — nunca fica parada, nunca lança. */
export async function seguirParaCadastro(
  code: string,
  next: string | null,
  capturar: (c: string) => Promise<boolean>,
  ir: (destino: string) => void,
  esperaMs = ESPERA_MAXIMA_MS,
): Promise<void> {
  await Promise.race([
    capturar(code).catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), esperaMs)),
  ])
  ir(destinoDoCadastro(next))
}

export default function ReferralPage() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'advoc.me — o site profissional para a advocacia'
    let vivo = true
    void seguirParaCadastro(code, params.get('next'), capturarIndicacao, (destino) => {
      if (vivo) navigate(destino, { replace: true })
    })
    return () => {
      vivo = false
    }
  }, [code, params, navigate])

  return <AvisoDeChegada />
}

/** O que aparece por um instante: uma frase sobre o Advocme, e só. */
export function AvisoDeChegada() {
  return (
    <main className="grain flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper-deep px-6 text-center">
      <Marca size={40} />
      <h1 className="font-display text-[24px] font-semibold leading-tight text-ink">advoc.me</h1>
      <p className="max-w-sm text-[14px] leading-relaxed text-ink-soft">
        A página profissional para quem advoga. Estamos abrindo o cadastro para você.
      </p>
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy"
        role="status"
        aria-label="Abrindo o cadastro"
      />
    </main>
  )
}
