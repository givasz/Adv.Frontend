import { useEffect, useState } from 'react'
import { googleAtivo, urlEntrarComGoogle } from '@/lib/auth'
import { navegadorEmbutido } from '@/lib/navegadorEmbutido'

/**
 * "Continuar com o Google" — o botão e a divisória acima do formulário de e-mail.
 *
 * Só aparece quando o servidor diz que a entrada com o Google está ligada (as
 * chaves existem e a Política declara o Google — ver backend src/auth/google.ts).
 * A pergunta não segura a tela: o formulário de e-mail aparece na hora, e o
 * botão surge quando a resposta chega.
 *
 * É um LINK, não um botão com fetch: ir ao Google é navegação de verdade, na
 * mesma aba. Popup é bloqueado no celular, e o COOP da página (same-origin, ver
 * netlify.toml) cortaria a conversa com ele de qualquer jeito.
 *
 * O visual segue as regras de marca do Google — fundo branco, borda cinza, o "G"
 * colorido sem alteração e o texto "Continuar com o Google". Elas são condição de
 * uso do login, e a verificação de marca do Google confere.
 */
export function BotaoGoogle({ next, lembrar }: { next: string; lembrar: boolean }) {
  const [ativo, setAtivo] = useState(false)
  const [embutido] = useState(() => navegadorEmbutido())

  useEffect(() => {
    let vivo = true
    void googleAtivo().then((a) => {
      if (vivo) setAtivo(a)
    })
    return () => {
      vivo = false
    }
  }, [])

  if (!ativo) return null

  return (
    <div className="mt-6">
      {embutido ? (
        <p className="rounded-lg border border-ink/10 bg-paper-soft/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Para entrar com o Google, abra esta página no navegador.</span>{' '}
          O Google não deixa entrar por dentro de aplicativos como Instagram e Facebook: toque no menu ⋯
          e escolha “Abrir no navegador”. Com e-mail e senha dá para entrar aqui mesmo.
        </p>
      ) : (
        <a
          href={urlEntrarComGoogle(next, lembrar)}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#747775] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1F1F1F] transition-colors hover:bg-[#F8F9FA] focus:outline-none focus:ring-2 focus:ring-burgundy/25"
        >
          <LogoGoogle />
          Continuar com o Google
        </a>
      )}
      <div className="mt-5 flex items-center gap-3 text-[12px] text-ink-faint">
        <span className="h-px flex-1 bg-ink/10" aria-hidden />
        ou com e-mail
        <span className="h-px flex-1 bg-ink/10" aria-hidden />
      </div>
    </div>
  )
}

/** O "G" do Google, nas cores e proporções originais (não recolorir). */
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
