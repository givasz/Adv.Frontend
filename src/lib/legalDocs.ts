// Gerador de documentos legais (LGPD) para o perfil.
//
// Produz uma Política de Privacidade e um Aviso de Termos de Uso a partir dos dados
// do perfil — úteis para quem coleta contato (WhatsApp, e-mail, agendamento) pelo
// link. É um ponto de partida informativo, NÃO aconselhamento jurídico, e não contém
// linguagem de captação (compatível com o Prov. 205/2021).

import type { Profile } from './types'

export interface LegalDoc {
  id: 'privacy' | 'terms'
  title: string
  filename: string
  body: string
}

function controllerLine(p: Profile): string {
  const contact = p.contact.email ? ` (contato: ${p.contact.email})` : ''
  return `${p.name}, advogado(a) inscrito(a) na ${p.oabNumber}${contact}`
}

function channels(p: Profile): string {
  const list: string[] = []
  if (p.contact.whatsapp) list.push('WhatsApp')
  if (p.contact.email) list.push('e-mail')
  if (p.contact.scheduling) list.push('agendamento online')
  if (!list.length) return 'os canais de contato informados no perfil'
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`
}

export function generatePrivacyPolicy(p: Profile): LegalDoc {
  const local = [p.city, p.state].filter(Boolean).join('/')
  const body = `POLÍTICA DE PRIVACIDADE

Controlador dos dados: ${controllerLine(p)}.
${local ? `Localidade: ${local}.\n` : ''}
1. Dados coletados
Ao entrar em contato por ${channels(p)}, você pode fornecer dados pessoais como nome, telefone, e-mail e informações necessárias ao atendimento jurídico.

2. Finalidade
Os dados são utilizados exclusivamente para responder ao contato, prestar orientação jurídica e cumprir obrigações legais e regulatórias da advocacia.

3. Base legal
O tratamento observa a Lei nº 13.709/2018 (LGPD), fundamentando-se no consentimento do titular, na execução de contrato e no cumprimento de obrigação legal, conforme o caso.

4. Sigilo profissional
As informações compartilhadas são protegidas pelo sigilo profissional do advogado (Estatuto da OAB e Código de Ética), além das medidas de segurança previstas na LGPD.

5. Compartilhamento
Os dados não são comercializados. Podem ser compartilhados apenas quando necessário ao próprio atendimento ou por exigência legal/judicial.

6. Retenção
Os dados são mantidos pelo tempo necessário às finalidades acima e aos prazos legais aplicáveis, sendo depois eliminados ou anonimizados.

7. Direitos do titular
Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, bem como revogar o consentimento, pelos canais de contato informados.

8. Contato do encarregado
Solicitações relativas a dados pessoais podem ser feitas${p.contact.email ? ` por ${p.contact.email}` : ' pelos canais de contato do perfil'}.

Este documento é um modelo informativo e pode ser adequado à realidade de cada atuação. Não constitui aconselhamento jurídico.`

  return { id: 'privacy', title: 'Política de Privacidade', filename: 'politica-de-privacidade.txt', body }
}

export function generateTermsOfUse(p: Profile): LegalDoc {
  const body = `AVISO DE TERMOS DE USO

1. Objeto
Este perfil tem caráter meramente informativo, apresentando dados profissionais de ${controllerLine(p)}, em conformidade com o Provimento nº 205/2021 do CFOAB.

2. Natureza das informações
O conteúdo aqui publicado não constitui consulta, parecer ou aconselhamento jurídico, nem estabelece relação advogado-cliente. A prestação de serviços depende de contratação específica.

3. Contato
Os canais de contato (${channels(p)}) destinam-se ao esclarecimento de dúvidas iniciais e ao agendamento de atendimento, sem qualquer garantia de resultado.

4. Propriedade do conteúdo
Textos e materiais educativos publicados são de autoria do(a) profissional e destinam-se à difusão responsável de informação jurídica.

5. Proteção de dados
O tratamento de dados pessoais segue a Política de Privacidade e a Lei nº 13.709/2018 (LGPD).

Este documento é um modelo informativo e pode ser adequado à realidade de cada atuação. Não constitui aconselhamento jurídico.`

  return { id: 'terms', title: 'Termos de Uso', filename: 'termos-de-uso.txt', body }
}

export function generateLegalDocs(p: Profile): LegalDoc[] {
  return [generatePrivacyPolicy(p), generateTermsOfUse(p)]
}
