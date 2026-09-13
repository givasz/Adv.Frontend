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
//   deslogado            → criar
//   logado, publicado    → o PAINEL (é de lá que se vê, edita e compartilha o
//                          perfil; o perfil público fica no menu da conta)
//   logado, sem publicar → continuar de onde parou
//
// O botão levava ao perfil público até 12/09/2026. Quem já tem perfil abre a
// home para MEXER nele, não para olhá-lo — e do perfil público não se chega a
// nada. O painel é o centro; o perfil vira item do menu do nome.

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
  /** endereço do perfil público quando ele está no ar — para o menu da conta */
  perfil?: string
  /**
   * A foto do perfil, publicado ou não — para o chip da conta na barra do topo.
   * A sessão não a carrega (ver AccountMenu), e a home é a única tela com o
   * menu da conta que não tem o perfil em mãos.
   */
  avatarUrl?: string
}

const CRIAR: MyProfileLink = {
  to: '/comecar',
  label: 'Criar meu perfil',
  short: 'Criar perfil',
  external: false,
}

const PAINEL: MyProfileLink = { to: '/painel', label: 'Meu painel', short: 'Painel', external: false }

export function useMyProfileLink(): MyProfileLink {
  const { isAuthed } = useAuth()
  const [link, setLink] = useState<MyProfileLink>(CRIAR)

  useEffect(() => {
    if (!isAuthed) {
      setLink(CRIAR)
      return
    }
    let alive = true
    // Enquanto o rascunho não chega, o rótulo já é o do painel: ele resolve o
    // destino sozinho (sem perfil publicado, manda para /comecar).
    setLink(PAINEL)
    api
      .getDraft()
      .then((p) => {
        if (!alive) return
        const avatarUrl = p.avatarUrl || undefined
        if (p.published && p.slug) {
          setLink({ ...PAINEL, perfil: `/${p.slug}`, avatarUrl })
        } else {
          setLink({ to: '/comecar', label: 'Continuar meu perfil', short: 'Continuar', external: false, avatarUrl })
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
