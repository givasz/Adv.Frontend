import { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'

// Para onde o botão principal da home deve levar.
//
// A home oferecia "Criar meu perfil" para todo mundo — inclusive para quem já
// estava logado, com o perfil no ar e o nome ali do lado no menu de conta.
// Convidar a criar o que já existe é o tipo de detalhe que faz o produto parecer
// que não sabe quem você é.
//
// Três estados, três destinos honestos:
//   deslogado           → criar
//   logado, publicado   → ver o perfil que está no ar
//   logado, sem publicar→ continuar de onde parou

export interface MyProfileLink {
  to: string
  label: string
  /**
   * O mesmo destino em duas palavras, para a barra do topo no celular.
   *
   * Ali o botão divide a linha com a marca e com o nome da conta, e "Ver meu
   * perfil" não cabia: quebrava em duas linhas e virava um bloco alto no canto
   * da tela. Encurtar o TEXTO resolve sem encolher a área de toque, que é o que
   * não se deve mexer num botão de dedo.
   */
  short: string
  /** true quando o destino é o perfil público (abre em nova aba) */
  external: boolean
}

const CRIAR: MyProfileLink = {
  to: '/comecar',
  label: 'Criar meu perfil',
  short: 'Criar perfil',
  external: false,
}

export function useMyProfileLink(): MyProfileLink {
  const { isAuthed } = useAuth()
  const [link, setLink] = useState<MyProfileLink>(CRIAR)

  useEffect(() => {
    if (!isAuthed) {
      setLink(CRIAR)
      return
    }
    let alive = true
    // Enquanto o rascunho não chega, o rótulo segue neutro: prometer "Ver meu
    // perfil" antes de saber se existe um levaria a uma página inexistente.
    setLink({ to: '/painel', label: 'Meu painel', short: 'Painel', external: false })
    api
      .getDraft()
      .then((p) => {
        if (!alive) return
        if (p.published && p.slug) {
          setLink({ to: `/${p.slug}`, label: 'Ver meu perfil', short: 'Meu perfil', external: true })
        } else {
          setLink({ to: '/comecar', label: 'Continuar meu perfil', short: 'Continuar', external: false })
        }
      })
      .catch(() => {
        /* sem rede: fica em "Meu painel", que resolve o destino sozinho */
      })
    return () => {
      alive = false
    }
  }, [isAuthed])

  return link
}
