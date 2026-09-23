import { useEffect, useState } from 'react'
import { carregarMetricas, type Metricas } from '@/lib/metricas'
import { editorPath } from '@/lib/editorSections'
import { SECTION_ICON } from '@/components/editor/sectionIcons'
import { Atalho } from './pecas'

// "Quem visita você" com o NÚMERO já no painel.
//
// Olhar quantas pessoas abriram o perfil é a curiosidade mais frequente de quem
// tem um — e ficava atrás de um clique, numa tela que só dizia "veja quantas
// pessoas abriram seu perfil". Componente próprio com hooks próprios de
// propósito: o painel tem uma saída antecipada enquanto o perfil carrega, e
// hook depois de saída antecipada já deixou aquela tela em branco (React #310).
export function VisitasTile({ coluna }: { coluna?: boolean }) {
  const [dados, setDados] = useState<Metricas | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    carregarMetricas()
      .then((m) => vivo && setDados(m))
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [])

  let destaque = 'Contando…'
  let texto = 'Quantas vezes abriram seu perfil e tocaram para falar com você.'
  if (erro) destaque = 'Não deu para carregar agora.'
  else if (dados) {
    const v = dados.visitas.janela
    const c = dados.contatos
    texto = `Nos últimos ${dados.janelaDias} dias.`
    destaque =
      v === 0
        ? 'Nenhuma visita ainda'
        : `${v} ${v === 1 ? 'visita' : 'visitas'}${c > 0 ? ` · ${c} ${c === 1 ? 'contato' : 'contatos'}` : ''}`
  }

  return (
    <Atalho
      to={editorPath('analytics')}
      titulo="Visitas"
      texto={texto}
      destaque={<span aria-live="polite">{destaque}</span>}
      Icone={SECTION_ICON.analytics}
      coluna={coluna}
    />
  )
}
