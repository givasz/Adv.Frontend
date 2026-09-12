import { useEffect, useState } from 'react'
import { carregarMetricas, type Metricas } from '@/lib/metricas'
import { editorPath } from '@/lib/editorSections'
import { SECTION_ICON } from '@/components/editor/sectionIcons'
import { Tile } from './SecaoTile'

// "Quem visita você" com o NÚMERO já no painel.
//
// Olhar quantas pessoas abriram o perfil é a curiosidade mais frequente de quem
// tem um — e ficava atrás de um clique, numa tela que só dizia "veja quantas
// pessoas abriram seu perfil". Componente próprio com hooks próprios de
// propósito: o painel tem uma saída antecipada enquanto o perfil carrega, e
// hook depois de saída antecipada já deixou aquela tela em branco (React #310).
export function VisitasTile() {
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

  let texto = 'Contando as visitas…'
  if (erro) texto = 'Não deu para carregar as visitas agora.'
  else if (dados) {
    const v = dados.visitas.janela
    const c = dados.contatos
    texto =
      v === 0
        ? `Nenhuma visita nos últimos ${dados.janelaDias} dias.`
        : `${v} ${v === 1 ? 'visita' : 'visitas'}${
            c > 0 ? ` e ${c} ${c === 1 ? 'contato' : 'contatos'}` : ''
          } nos últimos ${dados.janelaDias} dias.`
  }

  return <Tile to={editorPath('analytics')} title="Visitas" texto={texto} icon={SECTION_ICON.analytics} />
}
