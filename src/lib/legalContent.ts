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

const UPDATED = '27 de agosto de 2026'
const TERMS_UPDATED = '27 de agosto de 2026' // escada de sanções, prazos e contestação
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
          'Se você é VISITANTE de um perfil: o advoc.me não recebe nem guarda o que você escreve para falar com o advogado. O assistente e o formulário de contato apenas montam a mensagem, que sai do seu próprio aparelho direto para o WhatsApp dele. A partir daí, quem trata seus dados é o advogado, como controlador, sob a política dele.',
        ],
      },
      {
        heading: '1. Dados que coletamos',
        bullets: [
          'Cadastro do advogado: e-mail e senha (armazenada apenas como hash), e os dados que você publica no perfil (nome, número de OAB, cidade/UF, áreas, bio, links de contato).',
          'Uso: métricas agregadas de visitas e cliques do seu perfil (analytics), sem identificar o visitante.',
          'Denúncias: motivo, descrição e, se o denunciante quiser, um e-mail para retorno (opcional).',
          'De quem visita um perfil: fora a denúncia acima (que só existe se você optar por enviá-la) e a contagem agregada de visitas, nada. Pedidos de contato e agendamento não chegam até nós — a mensagem vai do seu aparelho direto ao WhatsApp do advogado, e não registramos quem falou com quem nem sobre o quê.',
        ],
      },
      {
        heading: '2. Para que usamos',
        paragraphs: [
          'Para operar a plataforma: publicar seu perfil, aplicar a checagem de conformidade, gerar a trilha de auditoria, moderar denúncias e melhorar o serviço. Não vendemos dados pessoais.',
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
          'Mantemos os dados enquanto sua conta existir e pelos prazos legais aplicáveis. Registros de auditoria são mantidos como comprovante de conformidade e depois eliminados ou anonimizados. Denúncias resolvidas são mantidas pelo tempo necessário à moderação.',
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
    updated: TERMS_UPDATED,
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
          'A prestação de dados falsos, a declaração inverídica de inscrição na OAB e a apresentação de documento falso ou adulterado à plataforma são de sua exclusiva responsabilidade e podem configurar ilícito civil e crime — entre outros, os previstos no art. 297 (falsificação de documento público) e no art. 304 (uso de documento falso), bem como no art. 299 (falsidade ideológica), do Código Penal. O advoc.me não atesta a autenticidade de documentos nem responde por informações inverídicas que você fornecer.',
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
        heading: '5. Nós não verificamos inscrições na OAB',
        paragraphs: [
          'O advoc.me não confere, não valida e não endossa números de inscrição, e não exibe selo, marca de verificação ou qualquer sinal que sugira aval da OAB — o uso de símbolos e chancelas oficiais é vedado pelo Provimento 205/2021 (Art. 5º, §2º).',
          'Cada perfil exibe, ao lado do número informado pelo próprio advogado, um link para a consulta pública do Cadastro Nacional dos Advogados (CNA), base oficial da OAB, onde qualquer pessoa confere a inscrição diretamente na fonte. Esse link é idêntico em todos os perfis e não depende de plano contratado.',
          'A veracidade do número informado é de exclusiva responsabilidade de quem o publica (ver item 2). Perfis com registro falso podem ser denunciados pelo próprio perfil e ficam sujeitos à Política de Moderação.',
        ],
      },
      {
        heading: '6. Planos e pagamentos',
        paragraphs: [
          'Há um plano gratuito e planos pagos com recursos adicionais. Condições específicas de cobrança, quando aplicáveis, são informadas na contratação.',
        ],
      },
      {
        heading: '7. Moderação, suspensão e encerramento',
        paragraphs: [
          'Podemos avisar, ocultar seções, retirar um perfil do ar, suspender a conta e, em último caso, encerrá-la — nesta ordem, conforme a Política de Moderação, que faz parte destes Termos.',
          'O que garantimos em troca, e que vale como cláusula: toda medida tem motivo escrito, que é o texto que você lê; toda medida tem prazo e cai sozinha ao vencer, salvo o encerramento; a partir da retirada do perfil do ar, a cobrança do plano é suspensa enquanto durar a medida; e você tem 15 dias para contestar (30 no encerramento), com 10 dias para a nossa resposta — silêncio nosso nesse prazo derruba a medida.',
          'O encerramento só ocorre depois de suspensão, ou por ordem judicial, e nele a parte não usada do plano é devolvida. A conta encerrada libera o endereço público para outra pessoa; o registro da decisão permanece, e os seus direitos de titular de dados continuam valendo (ver Política de Privacidade).',
        ],
      },
      {
        heading: '8. Situações que levam direto à suspensão',
        paragraphs: [
          'Sem passar pelos degraus anteriores, porque o dano corre contra terceiros enquanto se espera:',
        ],
        bullets: [
          'usar inscrição na OAB, nome ou imagem de outro profissional;',
          'burlar de forma reiterada a checagem de conformidade;',
          'usar a plataforma para fim ilícito, ou publicar conteúdo de ilicitude grave.',
        ],
      },
      {
        heading: '9. Limitação de responsabilidade',
        paragraphs: [
          'O serviço é fornecido “no estado em que se encontra”. A checagem de conformidade é um apoio automatizado que sinaliza e pode bloquear violações — não é garantia de adequação integral do conteúdo às normas. Na máxima extensão permitida pela lei, o advoc.me não se responsabiliza:',
        ],
        bullets: [
          'por conteúdo, dados ou documentos falsos, inverídicos, adulterados ou de titularidade de terceiros que você inserir, declarar ou enviar;',
          'por conteúdo que você optou por publicar em desacordo com o Provimento 205/2021, o Código de Ética ou a legislação — inclusive quando itens do perfil venham a sair da conformidade após a publicação;',
          'por sanções disciplinares, administrativas, cíveis ou penais decorrentes do uso que você faz da plataforma ou do conteúdo que publica;',
          'por indisponibilidades temporárias do serviço.',
        ],
      },
      {
        heading: '10. Alterações e contato',
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
          'O advoc.me é controlador dos dados necessários para operar a plataforma (conta, perfil, moderação). Os contatos que cada advogado recebe pelos canais dele não passam por nós: a mensagem vai do aparelho do visitante para o WhatsApp do advogado, que é o único controlador desses dados.',
        ],
      },
      {
        heading: '2. Minimização',
        paragraphs: [
          'Coletamos o mínimo necessário. A trilha de auditoria guarda apenas o conteúdo público (ex.: snapshot da bio), o status de conformidade e a versão da política — não dados sensíveis. A agenda que guardava nome, WhatsApp e o assunto de quem procurava um advogado foi retirada do produto justamente por concentrar dado de terceiro sem necessidade.',
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
    summary: 'O que podemos fazer, com que fundamento, por quanto tempo e como você contesta.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'Esta Política diz o que a plataforma pode fazer com um perfil ou uma conta, de onde vem esse direito, por quanto tempo cada medida vale e o que você tem em troca. Ela vale junto com os Termos de Uso.',
          'Duas coisas valem para tudo o que vem abaixo. Primeira: nenhuma medida é aplicada sem um motivo escrito, e esse motivo é exatamente o texto que você lê — se você não consegue ler por que algo aconteceu, não temos como esperar que você concorde. Segunda: não editamos o seu texto. Podemos ocultá-lo ou retirá-lo do ar; reescrevê-lo, não. O conteúdo é de responsabilidade exclusiva de quem o publica (Provimento 205/2021, Art. 1º, § 1º), e essa atribuição precisa continuar sendo verdadeira.',
        ],
      },
      {
        heading: '1. Antes de tudo: a checagem automática',
        paragraphs: [
          'Todo conteúdo passa pela checagem de conformidade antes de ir ao ar. O que configura violação clara — promessa de resultado, honorários, captação — bloqueia a publicação até ser ajustado. É prevenção, não sanção: nada é registrado contra você.',
        ],
      },
      {
        heading: '2. De onde vem o nosso direito de agir',
        paragraphs: [
          'Três fundamentos diferentes, com consequências diferentes:',
        ],
        bullets: [
          'Ilícito grave (atos antidemocráticos, terrorismo, crimes sexuais contra vulnerável, incitação à violência, crimes contra a saúde pública): removemos assim que somos notificados, sem esperar ordem judicial. É dever legal nosso, e avisamos você junto ou logo depois — nunca antes.',
          'Ofensa à honra de alguém: aqui não somos juízes. Só respondemos por não remover depois de ordem judicial. Agimos por conta própria quando o texto também viola os Termos ou as normas da advocacia — o que quase sempre é o caso.',
          'Violação das normas da advocacia ou destes Termos: o fundamento é contratual. Decidimos sobre a presença do conteúdo aqui dentro, e só isso. Não julgamos conduta profissional — isso é da OAB, e é para lá que encaminhamos o que for do âmbito dela.',
        ],
      },
      {
        heading: '3. As medidas, em ordem',
        paragraphs: [
          'A regra é subir um degrau por vez. Pular exige razão escrita no registro, e reincidência é o que mais frequentemente justifica.',
        ],
        bullets: [
          '1. Aviso — o perfil segue no ar e você lê o motivo no editor. Vale 30 dias e vence sozinho.',
          '2. Ocultação parcial — só as seções apontadas saem do ar. 30 dias.',
          '3. Restrição — a página inteira sai do ar. 30 dias. Se o seu plano é pago, a cobrança é suspensa enquanto durar.',
          '4. Suspensão da conta — o login para de funcionar e o perfil sai do ar. Cabe em fraude de identidade, burla reiterada da checagem ou uso da plataforma para fim ilícito. Cobrança suspensa.',
          '5. Encerramento — definitivo. A conta é encerrada e o endereço público é liberado. Só depois de suspensão, ou por ordem judicial. A parte não usada do plano é devolvida.',
        ],
      },
      {
        heading: '4. Prazo — e por que ele existe',
        paragraphs: [
          'Toda medida tem prazo, e vencido o prazo ela cai sozinha. Uma restrição sem prazo não é sanção: é uma página esquecida numa fila. Se a medida precisar continuar depois do prazo, ela é renovada — com um motivo novo, escrito.',
        ],
      },
      {
        heading: '5. Ação imediata, sem aviso antes',
        paragraphs: [
          'Em três situações agimos primeiro e avisamos no mesmo dia: ilícito grave, ordem judicial com prazo, e uso da inscrição ou do nome de outro profissional. Nesta última, quem está sendo prejudicado normalmente nem sabe que existe um perfil com o nome dele — esperar contraditório seria fazer a vítima esperar.',
        ],
      },
      {
        heading: '6. Como você contesta',
        bullets: [
          'Você tem 15 dias para contestar qualquer medida (30 dias no encerramento), contados do aviso.',
          'Temos 10 dias para responder. Se não respondermos no prazo, a medida cai.',
          'Sempre que houver mais de um responsável pela moderação, quem analisa a contestação não é quem decidiu.',
          'A reversão é registrada como qualquer outra decisão, com motivo.',
          `Enquanto o canal de contestação no painel não estiver pronto, o caminho é ${CONTACT} — e os mesmos prazos correm.`,
        ],
      },
      {
        heading: '7. Ordem judicial',
        paragraphs: [
          'Cumprimos ordens judiciais no prazo delas e registramos o recebimento. Avisamos você de que houve ordem e do que foi cumprido, salvo quando a própria ordem determinar sigilo. Ordem judicial não é contestável conosco — o caminho é o processo.',
        ],
      },
      {
        heading: '8. Registro',
        paragraphs: [
          'Toda decisão fica registrada com quem decidiu, quando e por quê. O registro é a sua defesa tanto quanto a nossa, e é guardado por 5 anos. O conteúdo removido é guardado por 6 meses, como prova em eventual contestação; depois disso fica apenas o registro da decisão.',
        ],
      },
      {
        heading: '9. O que não fazemos',
        bullets: [
          'Não editamos o seu texto. Ocultamos, retiramos do ar, avisamos — nunca reescrevemos.',
          'Não julgamos a sua conduta profissional. Isso é da OAB.',
          'Não sancionamos posição jurídica, opinião ou tese impopular.',
          'Não criamos selo, ranking, destaque ou ordenação por plano.',
          'Não retemos pagamento de serviço que nós mesmos suspendemos.',
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
