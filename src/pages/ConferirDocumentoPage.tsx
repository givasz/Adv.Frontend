import { useState } from 'react'
import { MODELOS, ehModelo } from '@/lib/contratos/modelos'
import { impressoesParaConferir, lerArquivo } from '@/lib/contratos/impressao'
import { conferirImpressoes, type RegistroDoServidor } from '@/lib/contratos/registros'
import { dataEHora, tamanhoLegivel } from '@/lib/contratos/entrega'
import { hashEmBlocos } from '@/lib/contratos/codigo'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { SeletorDeArquivo } from '@/components/contratos/SeletorDeArquivo'
import { CARTAO } from '@/components/contratos/estilos'
import { CheckIcon, ExternalLinkIcon, FingerprintIcon, InfoIcon } from '@/components/ui/icons'

// /contratos/conferir — PÚBLICA. Quem usa é o cliente, a outra parte, um juiz.
//
// O que a página responde, e SÓ isso: "este arquivo é o mesmo que foi
// registrado?". Ela não diz que o documento é válido, que as assinaturas são
// boas nem que o advogado é quem diz ser — a plataforma nunca atesta documento
// de ninguém, e a ressalva está visível na tela, não num tooltip (REGRAS.md,
// nota de 04/09/2026). Por isso nada aqui tem forma de selo: o resultado
// positivo é uma frase de fato ("idêntico"), com um traço de check simples.
//
// O arquivo nunca sai do aparelho: o navegador calcula a impressão digital e só
// ela vai ao servidor.

const MAX_ARQUIVO = 50 * 1024 * 1024

type Estado =
  | { tipo: 'vazio' }
  | { tipo: 'lendo'; nome: string }
  | { tipo: 'erro'; mensagem: string }
  | {
      tipo: 'pronto'
      nome: string
      tamanho: number
      hash: string
      identicos: RegistroDoServidor[]
      contidos: RegistroDoServidor[]
    }

const ETAPA: Record<string, string> = {
  revisado: 'Documento revisado e registrado pelo advogado',
  assinado: 'Versão assinada registrada pelo advogado',
}

function nomeDoModelo(m: string): string {
  if (m === 'proprio') return 'Modelo próprio do advogado'
  return ehModelo(m) ? MODELOS[m].nome : 'Documento'
}

export default function ConferirDocumentoPage() {
  const voltar = useVoltar('/')
  const [estado, setEstado] = useState<Estado>({ tipo: 'vazio' })

  const conferir = async (f: File) => {
    if (f.size > MAX_ARQUIVO) {
      setEstado({ tipo: 'erro', mensagem: 'Este arquivo passa de 50 MB. Confira se escolheu o PDF certo.' })
      return
    }
    setEstado({ tipo: 'lendo', nome: f.name })
    try {
      const bytes = await lerArquivo(f)
      const { inteiro, trechos } = await impressoesParaConferir(bytes)
      const achados = await conferirImpressoes([inteiro.hash, ...trechos.map((t) => t.hash)])
      setEstado({
        tipo: 'pronto',
        nome: f.name,
        tamanho: bytes.length,
        hash: inteiro.hash,
        identicos: achados.filter((r) => r.hash === inteiro.hash),
        // Registro cujo arquivo é o COMEÇO deste — e com o tamanho batendo com
        // o ponto de corte, para não confundir coincidência de hash com nada.
        contidos: achados.filter(
          (r) => r.hash !== inteiro.hash && trechos.some((t) => t.hash === r.hash && (!r.tamanho || r.tamanho === t.tamanho)),
        ),
      })
    } catch (e) {
      setEstado({
        tipo: 'erro',
        mensagem: e instanceof Error && e.message ? e.message : 'Não foi possível conferir agora. Tente de novo.',
      })
    }
  }

  return (
    <SubPage
      title="Conferir um documento"
      subtitle="Veja se um PDF é idêntico a um documento registrado no advoc.me. O arquivo não sai do seu aparelho."
      icon={<FingerprintIcon width={20} height={20} aria-hidden />}
      backTo={voltar}
      documentTitle="Conferir um documento"
    >
      <SeletorDeArquivo
        onArquivo={conferir}
        rotulo={estado.tipo === 'lendo' ? 'Conferindo…' : estado.tipo === 'pronto' ? 'Conferir outro PDF' : 'Escolher o PDF'}
        dica="Toque para escolher o arquivo, ou arraste até aqui. Só a impressão digital dele é consultada."
        ocupado={estado.tipo === 'lendo'}
        nomeAtual={estado.tipo === 'lendo' || estado.tipo === 'pronto' ? estado.nome : undefined}
        tamanhoAtual={estado.tipo === 'pronto' ? estado.tamanho : undefined}
      />

      <div aria-live="polite" className="space-y-4">
        {estado.tipo === 'erro' && (
          <p role="alert" className="rounded-xl2 border border-burgundy/30 bg-burgundy/[0.05] px-4 py-3 text-[13.5px] text-burgundy">
            {estado.mensagem}
          </p>
        )}

        {estado.tipo === 'pronto' && (
          <>
            {estado.identicos.length > 0 && (
              <section className="overflow-hidden rounded-xl2 border border-brass/40 bg-paper shadow-card">
                <div className="flex items-start gap-3 border-b border-brass/20 bg-brass/[0.08] px-4 py-4 sm:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-brass-deep" aria-hidden>
                    <CheckIcon width={18} height={18} />
                  </span>
                  <div>
                    <h2 className="text-balance font-display text-[18px] font-semibold leading-snug text-ink">
                      Idêntico ao documento registrado
                    </h2>
                    <p className="mt-0.5 text-[13px] text-ink-soft">Nenhum byte deste arquivo mudou desde o registro.</p>
                  </div>
                </div>
                <Registros lista={estado.identicos} />
              </section>
            )}

            {estado.identicos.length === 0 && estado.contidos.length > 0 && (
              <section className="overflow-hidden rounded-xl2 border border-brass/40 bg-paper shadow-card">
                <div className="border-b border-brass/20 bg-brass/[0.06] px-4 py-4 sm:px-5">
                  <h2 className="text-balance font-display text-[18px] font-semibold leading-snug text-ink">
                    O documento registrado está intacto no começo deste arquivo
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                    Depois dele há acréscimos — normalmente, assinaturas digitais. Acréscimos também podem mudar o que
                    aparece na tela. Para ver quem assinou e se algo mudou depois da assinatura, use o{' '}
                    <a
                      href="https://validar.iti.gov.br/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-burgundy underline underline-offset-2"
                    >
                      validador oficial do ITI
                      <ExternalLinkIcon width={12} height={12} aria-hidden />
                    </a>
                    .
                  </p>
                </div>
                <Registros lista={estado.contidos} />
              </section>
            )}

            {estado.identicos.length === 0 && estado.contidos.length === 0 && (
              <section className={CARTAO}>
                <h2 className="font-display text-[18px] font-semibold text-ink">Nenhum registro para este arquivo</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-ink-soft marker:text-ink-faint">
                  <li>Qualquer mudança no arquivo, até salvá-lo de novo em outro programa, muda a impressão digital.</li>
                  <li>Plataformas de assinatura costumam gerar um PDF novo, que só é encontrado se o advogado o registrou.</li>
                  <li>O documento pode nunca ter sido registrado aqui. Na dúvida, fale com quem enviou.</li>
                </ul>
              </section>
            )}

            <section className="rounded-xl2 border border-ink/10 bg-paper/60 px-4 py-3">
              <p className="text-[12px] font-semibold text-ink">Impressão digital deste arquivo (SHA-256)</p>
              <p className="mt-1 grid grid-cols-2 gap-x-3 font-mono text-[11.5px] leading-relaxed text-ink-soft min-[420px]:grid-cols-4" translate="no">
                {hashEmBlocos(estado.hash).map((b, i) => (
                  <span key={i} className="break-all">
                    {b}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-[12px] text-ink-faint">{tamanhoLegivel(estado.tamanho)}</p>
            </section>
          </>
        )}
      </div>

      {/* A ressalva — visível, sempre, antes e depois de conferir. */}
      <p className="flex gap-2.5 rounded-xl2 bg-ink/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-ink-faint">
        <InfoIcon width={16} height={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          O advoc.me confere só se o arquivo é o mesmo que foi registrado. Não confere o conteúdo, as assinaturas nem a
          validade jurídica do documento, e não verifica a identidade de quem registrou: nome e inscrição aparecem como o
          próprio advogado informou.
        </span>
      </p>
    </SubPage>
  )
}

function Registros({ lista }: { lista: RegistroDoServidor[] }) {
  return (
    <ul className="divide-y divide-ink/[0.07]">
      {lista.map((r) => (
        <li key={`${r.codigo}-${r.hash}`} className="px-4 py-3.5 sm:px-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-ink-faint">Registro</dt>
            <dd className="font-mono font-semibold tracking-wide text-ink" translate="no">
              {r.codigo}
            </dd>
            <dt className="text-ink-faint">O quê</dt>
            <dd className="text-ink">
              {nomeDoModelo(r.modelo)}
              <span className="block text-[12px] text-ink-faint">{ETAPA[r.etapa] ?? ''}</span>
            </dd>
            <dt className="text-ink-faint">Quando</dt>
            <dd className="text-ink">{dataEHora(r.registradoEm)}</dd>
            <dt className="text-ink-faint">Por</dt>
            <dd className="min-w-0 break-words text-ink">
              {r.advogado.nome}
              {r.advogado.oab ? <span className="text-ink-soft"> · {r.advogado.oab}</span> : null}
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  )
}
