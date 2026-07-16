// Documentação jurídica DA PLATAFORMA advoc.me (não confundir com legalDocs.ts, que
// gera documentos para o perfil de cada advogado). Fonte única de conteúdo, consumida
// pelas rotas /legal/:slug (LegalPage) e pelos links do rodapé (Landing).
//
// Conteúdo específico do produto — cita o Provimento 205/2021, a LGPD (Lei 13.709/2018),
// o motor de conformidade, a trilha de auditoria e o fluxo de moderação reais.
// NÃO é aconselhamento jurídico; é a política de uso da plataforma.

export interface LegalSection {
  heading?: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface LegalDocContent {
  slug: string
  /** rótulo curto usado no rodapé */
  navLabel: string
  /** título da página */
  title: string
  /** resumo de uma linha */
  summary: string
  /** data da última atualização (exibida no topo) */
  updated: string
  sections: LegalSection[]
}

const UPDATED = '10 de julho de 2026'
const CONTACT = 'contato@advoc.me'

export const LEGAL_DOCS: LegalDocContent[] = [
  {
    slug: 'privacidade',
    navLabel: 'Privacidade',
    title: 'Política de Privacidade',
    summary: 'Como o advoc.me trata os dados pessoais de quem usa a plataforma.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'Esta Política explica como a plataforma advoc.me ("advoc.me", "nós") trata dados pessoais de advogados que criam perfis e de visitantes que os acessam. O tratamento observa a Lei nº 13.709/2018 (LGPD).',
          'Importante: cada advogado é controlador dos dados de seus próprios clientes/contatos recebidos por seus canais (WhatsApp, e-mail, agendamento). Para esse tratamento, vale a política do próprio advogado — o advoc.me atua apenas como meio de contato.',
        ],
      },
      {
        heading: '1. Dados que coletamos',
        bullets: [
          'Cadastro do advogado: e-mail e senha (armazenada apenas como hash), e os dados que você publica no perfil (nome, número de OAB, cidade/UF, áreas, bio, links de contato).',
          'Uso: métricas agregadas de visitas e cliques do seu perfil (analytics), sem identificar o visitante.',
          'Conferência de OAB: número de inscrição e o histórico da conferência (data, método, responsável, decisão).',
          'Denúncias: motivo, descrição e, se o denunciante quiser, um e-mail para retorno (opcional).',
        ],
      },
      {
        heading: '2. Para que usamos',
        paragraphs: [
          'Para operar a plataforma: publicar seu perfil, conferir a OAB, aplicar a checagem de conformidade, gerar a trilha de auditoria, moderar denúncias e melhorar o serviço. Não vendemos dados pessoais.',
        ],
      },
      {
        heading: '3. Bases legais',
        paragraphs: [
          'Execução de contrato (prestação do serviço), cumprimento de obrigação legal/regulatória, exercício regular de direitos e legítimo interesse (segurança e prevenção a abusos), conforme o caso.',
        ],
      },
      {
        heading: '4. Compartilhamento',
        paragraphs: [
          'Seu perfil publicado é público por natureza. Podemos usar provedores de infraestrutura (hospedagem) e de geração de texto por IA, que atuam como operadores sob nossas instruções. Compartilhamos dados com autoridades quando exigido por lei.',
        ],
      },
      {
        heading: '5. Retenção',
        paragraphs: [
          'Mantemos os dados enquanto sua conta existir e pelos prazos legais aplicáveis. Registros de auditoria e conferência são mantidos como comprovante de conformidade e depois eliminados ou anonimizados. Denúncias resolvidas são mantidas pelo tempo necessário à moderação.',
        ],
      },
      {
        heading: '6. Seus direitos (LGPD)',
        paragraphs: [
          `Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão de dados e revogar consentimentos, pelo e-mail ${CONTACT}. Alguns dados podem ser mantidos quando houver obrigação legal ou exercício regular de direitos.`,
        ],
      },
      {
        heading: '7. Contato do encarregado',
        paragraphs: [`Solicitações sobre dados pessoais: ${CONTACT}.`],
      },
    ],
  },
  {
    slug: 'termos',
    navLabel: 'Termos de Uso',
    title: 'Termos de Uso',
    summary: 'As regras para usar a plataforma advoc.me.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'Estes Termos regem o uso da plataforma advoc.me. Ao criar uma conta ou publicar um perfil, você concorda com eles.',
        ],
      },
      {
        heading: '1. O que o advoc.me é',
        paragraphs: [
          'Uma ferramenta para advogados montarem uma página de perfil profissional em conformidade com o Provimento 205/2021 do CFOAB. O advoc.me não é filiado à OAB e não presta serviços jurídicos.',
        ],
      },
      {
        heading: '2. Elegibilidade e veracidade',
        paragraphs: [
          'O serviço destina-se a advogados regularmente inscritos na OAB. Você declara que as informações do perfil (inclusive nome e número de inscrição) são verdadeiras e de sua titularidade. É vedado usar dados de terceiros ou se passar por outro profissional.',
        ],
      },
      {
        heading: '3. Conformidade e responsabilidade pelo conteúdo',
        paragraphs: [
          'A plataforma oferece uma checagem automática de conformidade que sinaliza e pode bloquear conteúdo irregular. Essa checagem é um apoio, não uma garantia: a responsabilidade final pelo conteúdo publicado e por sua adequação às normas da advocacia é integralmente sua.',
        ],
      },
      {
        heading: '4. Uso aceitável',
        bullets: [
          'Não publicar conteúdo que viole o Provimento 205/2021, o Código de Ética ou a legislação.',
          'Não tentar burlar a checagem de conformidade nem os limites do plano.',
          'Não usar a plataforma para captação vedada, spam ou fins ilícitos.',
        ],
      },
      {
        heading: '5. Marca “OAB conferida”',
        paragraphs: [
          'Quando exibida, indica que a plataforma conferiu seu número de inscrição. Não é selo, chancela ou endosso oficial da OAB, cujo uso é vedado pelo Provimento 205/2021.',
        ],
      },
      {
        heading: '6. Planos e pagamentos',
        paragraphs: [
          'Há um plano gratuito e planos pagos com recursos adicionais. Condições específicas de cobrança, quando aplicáveis, são informadas na contratação.',
        ],
      },
      {
        heading: '7. Moderação e suspensão',
        paragraphs: [
          'Podemos avisar, ocultar seções ou retirar do ar perfis que violem estes Termos ou as normas da advocacia, conforme a Política de Moderação.',
        ],
      },
      {
        heading: '8. Limitação de responsabilidade',
        paragraphs: [
          'O serviço é fornecido “no estado em que se encontra”. Não respondemos por sanções disciplinares decorrentes de conteúdo que você optou por publicar, nem por indisponibilidades temporárias.',
        ],
      },
      {
        heading: '9. Alterações e contato',
        paragraphs: [`Podemos atualizar estes Termos, avisando quando houver mudança relevante. Dúvidas: ${CONTACT}.`],
      },
    ],
  },
  {
    slug: 'lgpd',
    navLabel: 'LGPD',
    title: 'Política de Proteção de Dados (LGPD)',
    summary: 'Compromissos do advoc.me com a Lei Geral de Proteção de Dados.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'Esta Política detalha como o advoc.me aplica a Lei nº 13.709/2018 (LGPD). Complementa a Política de Privacidade.',
        ],
      },
      {
        heading: '1. Papéis',
        paragraphs: [
          'O advoc.me é controlador dos dados necessários para operar a plataforma (conta, perfil, conferência, moderação). Quanto aos contatos que cada advogado recebe pelos seus canais, o advogado é o controlador, e o advoc.me atua como simples meio.',
        ],
      },
      {
        heading: '2. Minimização',
        paragraphs: [
          'Coletamos o mínimo necessário. A trilha de auditoria guarda apenas o conteúdo público (ex.: snapshot da bio), o status de conformidade e a versão da política — não dados sensíveis.',
        ],
      },
      {
        heading: '3. Segurança',
        paragraphs: [
          'Senhas são armazenadas apenas como hash. O acesso administrativo é autenticado e a transmissão ocorre por canais seguros. Adotamos medidas técnicas e organizacionais proporcionais ao risco.',
        ],
      },
      {
        heading: '4. Direitos do titular',
        paragraphs: [
          `Confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informação sobre compartilhamentos. Exercite-os por ${CONTACT}.`,
        ],
      },
      {
        heading: '5. Incidentes',
        paragraphs: [
          'Em caso de incidente de segurança relevante, adotaremos as medidas cabíveis e faremos as comunicações exigidas à ANPD e aos titulares afetados.',
        ],
      },
      {
        heading: '6. Encarregado (DPO)',
        paragraphs: [`Contato do encarregado pelo tratamento de dados: ${CONTACT}.`],
      },
    ],
  },
  {
    slug: 'cookies',
    navLabel: 'Cookies',
    title: 'Política de Cookies',
    summary: 'Quais armazenamentos locais o advoc.me usa e por quê.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'O advoc.me usa apenas armazenamentos locais estritamente necessários ao funcionamento. Não usamos cookies de publicidade nem rastreadores de terceiros para fins de marketing.',
        ],
      },
      {
        heading: '1. O que usamos',
        bullets: [
          'Sessão do editor: guardamos o rascunho do seu perfil no armazenamento local do navegador para não perder o que você digita.',
          'Autenticação: um token de sessão é mantido para manter você conectado (inclusive no painel administrativo).',
          'Preferências de interface: pequenos indicadores, como a dispensa de avisos já vistos.',
        ],
      },
      {
        heading: '2. O que NÃO usamos',
        paragraphs: [
          'Não empregamos cookies de rastreamento publicitário, perfis de comportamento para anúncios, nem venda de dados. As métricas de perfil são agregadas e não identificam o visitante.',
        ],
      },
      {
        heading: '3. Como controlar',
        paragraphs: [
          'Você pode limpar o armazenamento local pelo seu navegador. Como esses itens são necessários ao funcionamento, removê-los pode encerrar sua sessão ou apagar rascunhos não salvos.',
        ],
      },
    ],
  },
  {
    slug: 'moderacao',
    navLabel: 'Moderação',
    title: 'Política de Moderação',
    summary: 'Como avaliamos e agimos sobre conteúdo que viola as normas.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'Esta Política descreve como o advoc.me modera conteúdo de perfis, para manter a plataforma em conformidade com o Provimento 205/2021 e o Código de Ética.',
        ],
      },
      {
        heading: '1. Prevenção automática',
        paragraphs: [
          'Antes de publicar, todo conteúdo passa pela checagem de conformidade. Termos que configuram violação clara (ex.: promessa de resultado, preços, captação) bloqueiam a publicação até serem ajustados.',
        ],
      },
      {
        heading: '2. Avaliação de denúncias',
        paragraphs: [
          'Denúncias recebidas entram em uma fila e são avaliadas por nossa equipe à luz das normas. Analisamos o contexto antes de qualquer medida.',
        ],
      },
      {
        heading: '3. Medidas possíveis',
        bullets: [
          'Aviso: o responsável é notificado e o perfil segue no ar.',
          'Ocultação parcial: seções específicas (ex.: bio, uma área, redes) são retiradas do público.',
          'Restrição: o perfil inteiro é retirado do ar até a regularização.',
          'Arquivamento: quando a denúncia é improcedente, nenhuma medida é aplicada.',
        ],
      },
      {
        heading: '4. Transparência e trilha',
        paragraphs: [
          'O responsável pelo perfil é informado do motivo da medida. Decisões de moderação são registradas para fins de auditoria.',
        ],
      },
      {
        heading: '5. Revisão',
        paragraphs: [
          `Se você discorda de uma medida, pode solicitar revisão por ${CONTACT}, corrigindo o ponto apontado.`,
        ],
      },
    ],
  },
  {
    slug: 'denuncias',
    navLabel: 'Denúncias',
    title: 'Política de Denúncias',
    summary: 'Como qualquer pessoa pode sinalizar conteúdo irregular.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'Qualquer visitante pode denunciar um perfil que aparente violar as normas da publicidade advocatícia. A denúncia é uma ferramenta de cooperação com a fiscalização, não uma decisão.',
        ],
      },
      {
        heading: '1. Motivos previstos',
        bullets: [
          'Número de OAB inválido ou uso indevido da identidade de outro profissional.',
          'Promessa de resultado.',
          'Menção a preços, honorários ou descontos.',
          'Autoengrandecimento, superlativos ou comparação.',
          'Captação de clientela / chamada indevida à contratação.',
          'Exposição de casos ou clientes (quebra de sigilo).',
          'Conteúdo ofensivo — ou outro motivo, descrito livremente.',
        ],
      },
      {
        heading: '2. Como funciona',
        paragraphs: [
          'A denúncia é anônima por padrão; você pode informar um e-mail apenas se quiser retorno. Descreva o que e onde viola, para agilizar a análise.',
        ],
      },
      {
        heading: '3. O que acontece depois',
        paragraphs: [
          'A denúncia entra na fila de moderação e é avaliada conforme a Política de Moderação. Medidas vão de aviso a restrição do perfil, conforme a gravidade.',
        ],
      },
      {
        heading: '4. Uso responsável',
        paragraphs: [
          'Denúncias evidentemente falsas ou abusivas podem ser desconsideradas. Denúncias sobre situações disciplinares também podem ser levadas diretamente à OAB pelo denunciante.',
        ],
      },
    ],
  },
  {
    slug: 'ia',
    navLabel: 'IA',
    title: 'Política de Inteligência Artificial',
    summary: 'O papel da IA no advoc.me e os limites da sua responsabilidade.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'O advoc.me oferece recursos de IA para ajudar a redigir textos de perfil (bio e descrições de áreas). Esta Política esclarece o papel — e os limites — dessa assistência.',
        ],
      },
      {
        heading: '1. A IA apenas auxilia',
        paragraphs: [
          'A IA é uma ferramenta de apoio à redação. Ela sugere um texto sóbrio a partir das suas palavras-chave, orientada pelas normas da OAB — mas não substitui o seu julgamento profissional nem constitui aconselhamento jurídico.',
        ],
      },
      {
        heading: '2. Toda publicação depende de você',
        paragraphs: [
          'Nenhum texto gerado por IA é publicado automaticamente. Você revisa, edita e aprova antes de tudo. Além disso, o texto passa pela mesma checagem de conformidade aplicada a qualquer conteúdo.',
        ],
      },
      {
        heading: '3. A responsabilidade pelo conteúdo é sua',
        paragraphs: [
          'Ao publicar, você assume a responsabilidade pelo conteúdo, inclusive o que foi gerado com apoio da IA. A checagem reduz erros óbvios, mas não garante conformidade absoluta.',
        ],
      },
      {
        heading: '4. Como a IA é usada',
        bullets: [
          'Enviamos ao provedor de IA apenas as palavras-chave e o contexto necessários à geração do texto.',
          'Se a IA produzir algo que viole as regras, o sistema regenera ou recorre a um modelo seguro pré-aprovado.',
          'Não usamos os seus dados para treinar modelos de terceiros.',
        ],
      },
      {
        heading: '5. Limitações',
        paragraphs: [
          'Modelos de IA podem cometer erros ou gerar texto impreciso. Sempre confira nomes, números, formação e qualificações antes de publicar.',
        ],
      },
    ],
  },
]

export function getLegalDoc(slug: string): LegalDocContent | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug)
}
