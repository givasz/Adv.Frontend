import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { aceitarTermos, useAuth } from '@/lib/auth'
import { TERMS_UPDATED } from '@/lib/legalIdentity'
import { ArrowRight, CheckIcon } from './icons'

// O AVISO DE MUDANÇA DOS TERMOS — a promessa do item 13 virando mecanismo.
//
// Os Termos dizem que mudanças relevantes são avisadas na plataforma. Sem uma
// peça como esta, "avisar" seria publicar um texto novo em silêncio e torcer
// para ninguém reparar — e um documento que a pessoa nunca soube que mudou tem o
// mesmo problema do documento que ela nunca soube que existia (CDC, art. 46).
//
// Também é por aqui que a base ANTERIOR ao registro de aceite passa a ter
// registro: contas criadas quando a plataforma só exibia "ao continuar você
// concorda" chegam com `termsVersion` vazia, e o servidor as devolve como
// pendentes. Em vez de presumir um aceite que não existe, pedimos um.
//
// O QUE ESTA FAIXA NÃO FAZ
// ------------------------
// Não tranca a conta. Ler o painel, editar rascunho, exportar os dados, trocar a
// senha e sair continuam funcionando — condicionar tudo isso a um aceite seria
// usar o acesso da pessoa como refém, que é a prática que o CDC (art. 39, IV)
// chama de abusiva. O que fica travado, no servidor, é PUBLICAR: colocar
// conteúdo no ar é o ato em que os Termos são de fato o contrato.
//
// Não é sobreposição. Segue a regra da casa (REGRAS de produto: sem modais): é
// uma faixa no topo que empurra a página para baixo e um painel que abre em
// linha. Nada cobre o que a pessoa estava fazendo.

/** Onde a faixa aparece: as telas da conta. Some no perfil público e na landing. */
const TELAS_DO_APP = ['/painel', '/editor', '/comecar', '/planos', '/assinar', '/plano', '/conta', '/escritorio', '/suporte']

export function AvisoDeTermos() {
  const { termsPending } = useAuth()
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const naTela = TELAS_DO_APP.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!termsPending || !naTela) return null

  async function confirmar() {
    if (salvando) return
    setSalvando(true)
    setErro(null)
    try {
      await aceitarTermos()
      // Sem estado de "pronto": o aceite gravado zera `termsPending`, a faixa
      // some sozinha e a pessoa volta ao que estava fazendo. Um "salvo!" numa
      // barra que desaparece no mesmo instante é confete que ninguém lê.
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar agora.')
      setSalvando(false)
    }
  }

  return (
    <div className="border-b border-brass/30 bg-brass/10">
      <div className="mx-auto max-w-5xl px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-medium leading-snug text-ink">
            Atualizamos os Termos de Uso e a Política de Privacidade em {TERMS_UPDATED}.
            <span className="ml-1 font-normal text-ink-soft">
              Publicar o perfil depende do seu aceite.
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="-my-1 px-1 py-2 text-[13px] font-semibold text-burgundy hover:underline"
            >
              {aberto ? 'Fechar' : 'O que mudou'}
            </button>
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={salvando}
              className="btn-primary !py-2 !text-[13px] disabled:opacity-60"
            >
              {salvando ? 'Registrando…' : 'Li e aceito'}
              {!salvando && <CheckIcon width={15} height={15} strokeWidth={2.6} />}
            </button>
          </div>
        </div>

        {/* Painel em linha, não sobreposição. A altura NÃO é animada — abrir e
            fechar é opacidade e deslize, pela mesma razão do resto do produto:
            animar height trava no celular. */}
        {aberto && (
          <div className="mt-3 border-t border-brass/25 pt-3 text-[12.5px] leading-relaxed text-ink-soft">
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Passamos a identificar a empresa que opera a plataforma, com CNPJ e endereço.
              </li>
              <li>
                Registramos entrada na conta e publicação de perfil (data, hora e IP) por 180 dias,
                como exige o art. 15 do Marco Civil da Internet.
              </li>
              <li>
                Ficou explícito que o conteúdo do perfil é de responsabilidade de quem o publica, e
                que não conferimos inscrições na OAB.
              </li>
            </ul>
            <p className="mt-2.5">
              <Link
                to="/legal/termos"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-burgundy underline underline-offset-2"
              >
                Ler os documentos completos
                <ArrowRight width={13} height={13} />
              </Link>
            </p>
          </div>
        )}

        {erro && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-burgundy-deep">
            {erro}
          </p>
        )}
      </div>
    </div>
  )
}
