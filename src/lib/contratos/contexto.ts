// De onde os modelos tiram os dados do advogado: o perfil — sempre o do servidor
// (ver lib/api.getDraft). Nada disso é pedido de novo no formulário.

import type { Profile } from '../types'
import { enderecoEmLinha } from '../endereco'
import type { Contexto } from './modelos'
import type { Rascunho } from './rascunhos'

export function contextoDoPerfil(p: Profile, hoje = new Date()): Contexto {
  return {
    advogado: {
      nome: p.name ?? '',
      oab: p.oabNumber ?? '',
      cidade: p.city ?? '',
      uf: p.state ?? '',
      endereco: p.address ? enderecoEmLinha(p.address, p.city, p.state) : '',
      email: p.contact?.email ?? '',
    },
    hoje,
  }
}

/** O nome que identifica o documento na lista: o cliente, ou quem recebe os poderes. */
export function nomeDaParte(r: Rascunho): string {
  const d = r.dados
  return (d['cliente.nome'] || d['cliente.razao'] || d.outorgante || d['sub.nome'] || '').trim()
}
