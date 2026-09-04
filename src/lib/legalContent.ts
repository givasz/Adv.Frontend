// Documentação jurídica DA PLATAFORMA advoc.me (não confundir com legalDocs.ts, que
// gera documentos para o perfil de cada advogado). Fonte única de conteúdo, consumida
// pelas rotas /legal/:slug (LegalPage) e pelos links do rodapé (Landing).
//
// Conteúdo específico do produto — cita o Provimento 205/2021, a LGPD (Lei 13.709/2018),
// o motor de conformidade, a trilha de auditoria e o fluxo de moderação reais.
// NÃO é aconselhamento jurídico; é a política de uso da plataforma.
//
// A REGRA DESTE ARQUIVO: cada frase descreve o que o código faz HOJE. Quando o
// produto mudar (um provedor novo, um prazo de retenção, um cookie a mais), o
// documento muda junto, na mesma entrega — um documento que promete o que o
// sistema não faz é pior do que nenhum, porque é o que uma fiscalização cita.
//
// Referências do que está escrito abaixo:
//   • dados guardados        → backend/prisma/schema.prisma
//   • prazos de retenção     → backend/src/retencao/retencao.service.ts e analytics/eventos.ts
//   • exportar e excluir     → backend/src/account/account.service.ts, pages/DadosPage.tsx
//   • sessão e cookies       → backend/src/auth/*, lib/auth.ts, lib/http.ts
//   • cobrança               → docs/cobranca.md, lib/planOffer.ts (REGRAS_DE_COBRANCA)
//   • moderação e sanções    → docs/politica-de-sancoes.md
//   • provedores de IA       → backend/src/ai/provedores.ts
//   • backups                → backend/docs/recuperacao-de-desastre.md

import {
  operadorEndereco,
  operadorIdentificacao,
  OPERADOR,
  TERMS_UPDATED,
  TERMS_VERSION,
} from './legalIdentity'

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

// A data e a identificação vêm de legalIdentity.ts, que é a MESMA fonte do
// aceite gravado em cada conta e da trava de paridade com o backend. Um
// documento que muda sem a versão mudar é um documento que ninguém aceitou.
const UPDATED = TERMS_UPDATED
// Os canais que EXISTEM. Ver a nota em legalIdentity.ts sobre o e-mail que saiu.
const CANAL_CONTA = 'um chamado em "Suporte", dentro da plataforma'
const CANAL_SEDE = `correspondência à sede de ${OPERADOR.razaoSocial} (CNPJ ${OPERADOR.cnpj}), em ${operadorEndereco()}`
const IDENTIFICACAO = operadorIdentificacao()
const PRAZO_ACESSO = '180 dias'

// Prazos que aparecem em mais de um documento. Se um deles mudar no código, muda
// aqui uma vez só — e os três documentos que o citam continuam concordando.
const PRAZO_EVENTOS = '400 dias'
const PRAZO_AUDITORIA = '12 meses'
const PRAZO_COBRANCA = '12 meses'
const PRAZO_CONTEUDO_REMOVIDO = '6 meses'
const PRAZO_REGISTRO_MODERACAO = '5 anos'
const PRAZO_BACKUP = '30 dias, mais uma cópia mensal por 12 meses'
const PRAZO_RESPOSTA_TITULAR = '15 dias'

export const LEGAL_DOCS: LegalDocContent[] = [
  {
    slug: 'privacidade',
    navLabel: 'Privacidade',
    title: 'Política de Privacidade',
    summary: 'O que o advoc.me guarda, de quem, por quanto tempo e o que você pode fazer com isso.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          `${IDENTIFICACAO} É ela a controladora dos dados tratados na plataforma, e é a ela que se dirigem os pedidos desta Política.`,
          'Esta Política explica como a plataforma advoc.me ("advoc.me", "nós") trata dados pessoais. Ela vale para quatro pessoas diferentes: o advogado que cria uma conta, as pessoas que ele cita no próprio perfil ou convida para um escritório, quem visita um perfil e quem denuncia um perfil. O tratamento observa a Lei nº 13.709/2018 (LGPD).',
          'Se você é VISITANTE de um perfil, a parte mais importante cabe numa frase: o advoc.me não recebe nem guarda o que você escreve para falar com o advogado. O assistente de agendamento e o formulário de contato apenas montam a mensagem, que sai do seu próprio aparelho direto para o WhatsApp dele. A partir daí, quem trata os seus dados é o advogado, como controlador, sob a política dele — e o item 8 desta Política é seu.',
        ],
      },
      {
        heading: '1. O que guardamos, e de quem',
        bullets: [
          'Sua conta: e-mail, data de criação e a senha — guardada apenas como hash (scrypt, com sal aleatório), do qual ela não pode ser recuperada. Guardamos também as sessões abertas (quando começaram e até quando valem), sem endereço IP na própria sessão.',
          'O seu aceite dos Termos: a data, a versão do documento aceita e o endereço IP de onde partiu. É o registro de que o contrato entre nós existe — e é a prova que serve tanto a você quanto a nós.',
          `Registro de acesso: cada entrada na sua conta e cada publicação de perfil ficam registradas com data, hora, endereço IP e identificação do navegador, por ${PRAZO_ACESSO}. É o que o art. 15 do Marco Civil da Internet exige de quem opera uma aplicação como esta, e é também o que permite dizer quem publicou um conteúdo quando alguém questiona. Fica sob sigilo, sem tela pública, e só é entregue mediante ordem de autoridade competente.`,
          'Seu perfil: tudo o que você escreve e publica nele — nome, número de inscrição na OAB, foto, cidade/UF, endereço do escritório (se optar por mostrá-lo), áreas de atuação e suas descrições, apresentação, frase de apresentação, perguntas frequentes, links de contato e redes, vídeo, grade de horários do assistente, cor e nome de marca. Perfil publicado é público por natureza.',
          'Uso do seu perfil: contamos acontecimentos, nunca pessoas — quantas vezes o perfil foi aberto, qual botão foi tocado e em que dia e hora. Não guardamos endereço IP, identificação do aparelho nem cookie de quem visita; por isso não existe "visitantes únicos".',
          'Sua assinatura: o plano contratado, a situação da cobrança, as datas do período pago e da carência, os identificadores da assinatura no provedor de pagamento e o registro de cada evento de cobrança. Nunca o número do cartão — ele fica com o provedor de pagamento.',
          'Seus chamados de suporte: assunto, mensagem, a página em que você estava e a identificação do navegador (para conseguirmos reproduzir o problema), e a resposta que você recebeu.',
          'Moderação: as denúncias recebidas sobre o seu perfil (motivo, descrição e, se quem denunciou quis, um e-mail para retorno), as medidas aplicadas com o motivo escrito, as contestações que você enviar e o registro de quem decidiu, quando e por quê.',
          'Escritório: nome, registro da sociedade, endereço e contatos que o responsável cadastra; os e-mails que ele convida; e o nome, a inscrição na OAB e a área dos advogados que ele lista na equipe. Quem cadastra esses dados responde pela veracidade e pela autorização de quem foi citado.',
          'Retratos estatísticos: uma vez por dia guardamos, por perfil, o plano, a situação da cobrança, se está publicado, a UF e o estado de moderação; e, por mês, o total de cada tipo de acontecimento. Servem para acompanhar a plataforma como um todo, sem identificar visitante algum.',
        ],
      },
      {
        heading: '2. Para que usamos, e com que base legal',
        bullets: [
          'Para prestar o serviço que você contratou (execução de contrato): publicar o perfil, aplicar a checagem de conformidade, gerar a trilha de auditoria, operar a assinatura, responder ao suporte.',
          'Para cumprir obrigações legais e regulatórias e atender a ordens de autoridades, inclusive a guarda dos registros que a lei exige.',
          `Para cumprir o art. 15 do Marco Civil da Internet: o registro de acesso descrito no item 1, guardado por ${PRAZO_ACESSO}. A base é o cumprimento de obrigação legal, e por isso esse registro não é apagado a pedido antes do prazo — nem quando a conta é excluída.`,
          'Por legítimo interesse, sempre de forma proporcional: segurança da plataforma (limitar tentativas de acesso, detectar abuso), moderação de conteúdo e melhoria do serviço a partir de números agregados. Fora do registro de acesso acima, o endereço IP é usado na hora, para limitar tentativas, e não é gravado.',
          'Com o seu consentimento, onde ele é a base: o e-mail opcional que quem denuncia informa para receber retorno, e a opção "continuar conectado neste aparelho".',
          'Não vendemos dados pessoais, não montamos perfil de comportamento e não usamos os seus dados para publicidade.',
        ],
      },
      {
        heading: '3. Com quem compartilhamos',
        paragraphs: [
          'Só com quem precisa tocar nos dados para o serviço existir — operadores que agem sob nossas instruções —, com autoridades quando a lei exige, e com o público, no caso do perfil que você mesmo publicou.',
        ],
        bullets: [
          'Hospedagem: o site e a rede de entrega de conteúdo que o servem, e o servidor onde a API e o banco de dados ficam. Esses serviços podem estar fora do Brasil, o que configura transferência internacional nos termos do art. 33 da LGPD; escolhemos provedores com compromissos contratuais de proteção compatíveis com a lei.',
          'Geração de texto por IA: quando você pede à IA que escreva ou revise um texto, as palavras-chave e o texto em questão — e, conforme o plano, seu nome, cidade e áreas — são enviados ao provedor de modelo de linguagem. Hoje usamos GroqCloud, xAI e Google, em cadeia de reserva, e a lista pode variar; nenhum deles recebe a sua conta, o seu e-mail ou dados de visitantes. Detalhes na Política de Inteligência Artificial.',
          'Consulta de CEP: ao preencher o endereço no editor, o CEP digitado é consultado em serviços públicos de endereçamento (ViaCEP e BrasilAPI). Só o CEP é enviado.',
          'Fontes tipográficas: as famílias dos temas são servidas pelo Google Fonts; o navegador as busca diretamente daquele serviço, que recebe, como em qualquer acesso, o endereço IP e a identificação do navegador. Ver a Política de Cookies.',
          'Pagamento: quando o pagamento on-line estiver disponível, o provedor de pagamento receberá os dados necessários à cobrança e guardará os dados do cartão. Nós guardamos só os identificadores e o histórico dos eventos.',
          'Autoridades: compartilhamos dados quando exigido por lei ou por ordem de autoridade competente, e avisamos você quando a própria ordem não impedir.',
        ],
      },
      {
        heading: '4. Por quanto tempo',
        bullets: [
          'Conta, perfil, escritório e chamados de suporte: enquanto a conta existir. Quando você a exclui, tudo isso é apagado junto (ver item 6).',
          `Acontecimentos do perfil (visitas e cliques): ${PRAZO_EVENTOS}, apagados automaticamente depois disso.`,
          `Trilha de auditoria (retrato da apresentação, resultado da checagem e versão da política a cada publicação): ${PRAZO_AUDITORIA}.`,
          `Eventos de cobrança: ${PRAZO_COBRANCA} — é a prova de quem pagou o quê e quando, pelo tempo de contestação de qualquer cobrança.`,
          `Moderação: o conteúdo retirado do ar fica guardado por ${PRAZO_CONTEUDO_REMOVIDO}, como prova em eventual contestação; o registro da decisão (quem, quando, por quê) fica por ${PRAZO_REGISTRO_MODERACAO}.`,
          `Registro de acesso (entrada na conta e publicação de perfil): ${PRAZO_ACESSO}, apagados automaticamente depois disso. O prazo é teto, não piso: passados os seis meses que a lei exige, guardar mais seria tratar dado sem finalidade.`,
          'Aceite dos Termos: enquanto a conta existir, e depois pelo tempo em que possa ser necessário à defesa de direitos — é a prova de que o contrato foi celebrado.',
          'Sessões: até você sair, trocar a senha ou o prazo vencer — o prazo depende da opção "continuar conectado" e tem um limite máximo absoluto.',
          `Cópias de segurança: o banco é copiado diariamente, de forma cifrada, para um servidor separado. As cópias são mantidas por ${PRAZO_BACKUP} e depois substituídas; um dado apagado do banco some das cópias ao fim desse ciclo.`,
        ],
      },
      {
        heading: '5. Como protegemos',
        bullets: [
          'Senhas só como hash (scrypt); a sessão vive num cookie que a página não consegue ler (HttpOnly), com proteção contra requisições forjadas em toda escrita.',
          'O painel administrativo exige senha e segundo fator (TOTP), e cada ação de moderação fica registrada com quem fez, quando e por quê.',
          'Limites de tentativas por endereço e por conta, para conter força bruta e abuso. Fora do registro de acesso legal, o endereço IP é usado na hora e não é gravado.',
          'O registro de acesso fica em base separada do conteúdo, sem tela de consulta na plataforma, e só é acessado para responder a ordem de autoridade competente.',
          'Cópias de segurança cifradas com chave pública; a chave privada que as abre fica fora de qualquer servidor. A restauração é testada.',
          'Auditorias de segurança periódicas sobre o código, com as correções registradas.',
        ],
      },
      {
        heading: '6. Seus direitos, e como exercê-los sem pedir por favor',
        paragraphs: [
          'A LGPD (art. 18) garante confirmação do tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamentos e revogação de consentimento. Na sua conta, em "Seus dados", você mesmo:',
        ],
        bullets: [
          'baixa uma cópia de tudo o que guardamos sobre você, em formato aberto (JSON) — a portabilidade;',
          'troca a senha e encerra a sessão em todos os aparelhos;',
          `exclui a conta: apaga a conta, o perfil, as perguntas frequentes, a trilha de auditoria, os acontecimentos, os chamados e as sessões. O endereço público deixa de existir. Não há como desfazer, e por isso pedimos a senha. Duas coisas sobrevivem, e dizemos quais: o registro de acesso, até completar ${PRAZO_ACESSO} (obrigação legal — LGPD, art. 16, I), e o registro de eventuais decisões de moderação.`,
          `O que não couber ali — corrigir um dado que o editor não deixa mudar, contestar um tratamento, pedir informação sobre um compartilhamento — vai por ${CANAL_CONTA}. Respondemos em até ${PRAZO_RESPOSTA_TITULAR}. Alguns dados podem ser mantidos quando houver obrigação legal ou exercício regular de direitos (por exemplo, o registro de uma decisão de moderação), e diremos quais.`,
          `Se você não tem conta aqui e quer exercer um direito sobre dados seus, o caminho é ${CANAL_SEDE}. Não publicamos endereço de e-mail porque ainda não temos uma caixa que alguém leia todos os dias, e um canal que não é lido é pior do que canal nenhum.`,
          'Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).',
        ],
      },
      {
        heading: '7. Quem denuncia um perfil',
        paragraphs: [
          'A denúncia é anônima por padrão. Se você informar um e-mail, ele serve só para retorno e nunca é mostrado ao advogado denunciado — no relatório de dados dele, a denúncia aparece apenas pelo motivo e pela data.',
        ],
      },
      {
        heading: '8. Quem visita um perfil',
        bullets: [
          'Não pedimos nem guardamos seu nome, telefone, e-mail ou o assunto que você quer tratar. A mensagem que o assistente ou o formulário monta sai do seu aparelho direto para o WhatsApp do advogado.',
          'Registramos apenas que o perfil foi aberto e que um botão foi tocado — sem endereço IP, sem cookie, sem identificação do aparelho.',
          'A partir do momento em que você escreve ao advogado, quem trata os seus dados é ele, como controlador, sob as regras da advocacia (inclusive o sigilo profissional) e a política dele.',
        ],
      },
      {
        heading: '9. Crianças e adolescentes',
        paragraphs: [
          'A plataforma destina-se a advogados regularmente inscritos e não é dirigida a menores de 18 anos.',
        ],
      },
      {
        heading: '10. Mudanças e encarregado',
        paragraphs: [
          `Podemos atualizar esta Política; a data no topo diz quando foi a última vez. Mudanças relevantes não ficam esperando que você repare: quem tem conta recebe um aviso ao entrar, com o resumo do que mudou, e o aceite da versão nova fica registrado.`,
          `O encarregado pelo tratamento de dados pessoais atende por ${CANAL_CONTA} — a fila tem prazo e o pedido fica registrado dos dois lados. Quem não tem conta usa ${CANAL_SEDE}.`,
        ],
      },
    ],
  },
  {
    slug: 'termos',
    navLabel: 'Termos de Uso',
    title: 'Termos de Uso',
    summary: 'As regras para usar a plataforma advoc.me — inclusive as de cobrança e cancelamento.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          `${IDENTIFICACAO}`,
          `Estes Termos regem o uso da plataforma advoc.me. Ao criar a conta você marca uma caixa aceitando esta versão (${TERMS_VERSION}), e esse aceite fica registrado com data e endereço. Quando o texto muda, pedimos um aceite novo antes de você publicar — não presumimos concordância com o que você não teve como ler.`,
          'A Política de Privacidade, a Política de Moderação e a Política de Inteligência Artificial fazem parte deste documento.',
        ],
      },
      {
        heading: '1. O que o advoc.me é',
        paragraphs: [
          'Uma ferramenta para advogados montarem uma página de perfil profissional segundo o Provimento 205/2021 do CFOAB. O advoc.me não é filiado à OAB, não presta serviços jurídicos e não intermedeia a contratação de advogados: os contatos vão do visitante diretamente ao profissional.',
          'Juridicamente, o advoc.me é provedor de aplicação de internet (Marco Civil da Internet, Lei nº 12.965/2014, art. 5º, VII). O conteúdo dos perfis é gerado por terceiros — os próprios advogados —, e é essa a natureza da nossa responsabilidade: hospedamos e damos ferramentas, não escrevemos, não conferimos e não endossamos. Nos termos do art. 19 da mesma lei, respondemos por conteúdo de terceiro apenas se, após ordem judicial específica, deixarmos de torná-lo indisponível.',
        ],
      },
      {
        heading: '2. Sua conta',
        bullets: [
          'A conta é pessoal e exige e-mail e senha. Você é responsável por manter a senha em sigilo e por tudo o que for feito com ela; se desconfiar de acesso indevido, troque a senha em "Seus dados" — isso encerra as sessões nos outros aparelhos.',
          'É preciso ter 18 anos ou mais e ser advogado regularmente inscrito na OAB.',
          'O aceite destes Termos é condição da conta, e fica registrado: guardamos a data, a versão aceita e o endereço IP de onde partiu. Você vê esse registro na cópia dos seus dados, em "Seus dados".',
          'Você pode excluir a conta a qualquer momento, em "Seus dados". A exclusão apaga o perfil e libera o endereço público para outra pessoa, e não pode ser desfeita.',
        ],
      },
      {
        heading: '3. Elegibilidade e veracidade',
        paragraphs: [
          'O serviço destina-se a advogados regularmente inscritos na OAB. Você declara que as informações do perfil (inclusive nome e número de inscrição) são verdadeiras e de sua titularidade. É vedado usar dados de terceiros ou se passar por outro profissional.',
          'A prestação de dados falsos, a declaração inverídica de inscrição na OAB e a apresentação de documento falso ou adulterado à plataforma são de sua exclusiva responsabilidade e podem configurar ilícito civil e crime — entre outros, os previstos no art. 297 (falsificação de documento público) e no art. 304 (uso de documento falso), bem como no art. 299 (falsidade ideológica), do Código Penal. O advoc.me não atesta a autenticidade de documentos nem responde por informações inverídicas que você fornecer.',
          'Ao publicar o perfil pela primeira vez, você marca uma declaração específica de que é o titular da inscrição informada e de que as informações são verdadeiras. Essa declaração é registrada com data e endereço, junto do registro de acesso descrito na Política de Privacidade. Se um terceiro se disser prejudicado por informação falsa publicada aqui, é esse registro que identifica quem a publicou.',
        ],
      },
      {
        heading: '4. Conformidade e responsabilidade pelo conteúdo',
        paragraphs: [
          'A plataforma oferece uma checagem automática de conformidade que sinaliza e pode bloquear conteúdo irregular. Essa checagem é um apoio, não uma garantia: a responsabilidade final pelo conteúdo publicado e por sua adequação às normas da advocacia é integralmente sua (Provimento 205/2021, art. 1º, § 1º).',
        ],
      },
      {
        heading: '5. Uso aceitável',
        bullets: [
          'Não publicar conteúdo que viole o Provimento 205/2021, o Código de Ética e Disciplina ou a legislação.',
          'Não tentar burlar a checagem de conformidade nem os limites do plano.',
          'Não usar a plataforma para captação vedada, spam, coleta indevida de dados de terceiros ou fins ilícitos.',
          'Não cadastrar, no escritório ou no perfil, dados de pessoas que não autorizaram.',
        ],
      },
      {
        heading: '6. Nós não verificamos inscrições na OAB',
        paragraphs: [
          'O advoc.me não confere, não valida e não endossa números de inscrição, e não exibe selo, marca de verificação ou qualquer sinal que sugira aval da OAB — o uso de símbolos e chancelas oficiais é vedado pelo Provimento 205/2021 (art. 5º, § 2º).',
          'Cada perfil exibe, ao lado do número informado pelo próprio advogado, um link para a consulta pública do Cadastro Nacional dos Advogados (CNA), base oficial da OAB, onde qualquer pessoa confere a inscrição diretamente na fonte. Esse link é idêntico em todos os perfis e não depende de plano contratado.',
          'A veracidade do número informado é de exclusiva responsabilidade de quem o publica (ver item 3). Perfis com registro falso podem ser denunciados pelo próprio perfil e ficam sujeitos à Política de Moderação.',
        ],
      },
      {
        heading: '7. Planos, preços e cobrança',
        paragraphs: [
          'Há um plano gratuito (Free), dois planos individuais pagos (Pro e Max) e o plano Escritório. O que cada um inclui — e o que não inclui — está na página de planos e é o mesmo que o editor aplica; os preços são em reais, por mês.',
        ],
        bullets: [
          'Cobrança mensal e renovação automática, sem fidelidade. Você cancela quando quiser, na própria conta; o mês já pago vale até o fim e nenhuma cobrança nova é feita depois.',
          'Direito de arrependimento: em até 7 dias da primeira contratação de um plano pago, você pode desistir e receber o valor integral de volta (Código de Defesa do Consumidor, art. 49).',
          'Descer de plano ou voltar ao Free não apaga nada: o que exceder o novo plano deixa de aparecer na página e fica guardado; volta se você voltar. Com mês pago em aberto, a mudança é agendada para o fim dele.',
          'Endereço do perfil: o endereço sem número é um recurso dos planos pagos. Ao voltar ao Free, ele passa a ter um número no fim, como o de qualquer perfil gratuito — mas só 7 dias depois, com a data avisada no painel desde o primeiro dia, para você ter tempo de atualizar cartões e links. Passado o prazo, o endereço anterior deixa de abrir e fica disponível para outra pessoa. Trocar entre planos pagos não altera o endereço.',
          'Se uma cobrança falhar, você é avisado no painel, com a data. O plano segue inteiro por 7 dias de carência (ou até o fim do mês já pago, o que for maior); depois disso os recursos do plano ficam desligados — não apagados — e voltam quando o pagamento entrar.',
          'Mudanças de preço são avisadas com pelo menos 30 dias de antecedência e nunca alcançam o mês já pago. Se não concordar, basta cancelar antes da renovação.',
          'Escritório: o plano é contratado pelo responsável pela sociedade, inclui um número de advogados e cobra por advogado adicional. Cada membro recebe o Pro enquanto estiver na equipe; ao sair, ou se o escritório for encerrado, volta ao plano individual que tinha antes.',
          'Enquanto o pagamento on-line não estiver disponível, a assinatura é ativada sem cobrança e você é avisado no painel, com antecedência, antes da primeira. Os dados do cartão nunca ficam conosco: ficam com o provedor de pagamento.',
          'Quando uma medida de moderação retira o seu perfil do ar, a cobrança é suspensa enquanto ela durar — não cobramos por um serviço que nós mesmos suspendemos.',
        ],
      },
      {
        heading: '8. Seu conteúdo e a nossa marca',
        bullets: [
          'O que você escreve e envia continua seu. Você nos concede a licença necessária, e só ela, para hospedar, exibir, conferir e reproduzir esse conteúdo na prestação do serviço — inclusive na página pública, no cartão digital e nos comprovantes que você mesmo gera.',
          'Não editamos o seu texto. Podemos ocultá-lo ou retirá-lo do ar conforme a Política de Moderação; reescrevê-lo, nunca.',
          'A marca advoc.me, o software, os temas e os textos da plataforma são nossos. O rodapé "criado com advoc.me" aparece no perfil e pode ser removido no plano Max.',
        ],
      },
      {
        heading: '9. Inteligência artificial',
        paragraphs: [
          'A IA sugere textos; você revisa, edita e aprova antes de publicar, e a responsabilidade pelo conteúdo é sua. Detalhes, provedores e limites estão na Política de Inteligência Artificial.',
        ],
      },
      {
        heading: '10. Moderação, suspensão e encerramento',
        paragraphs: [
          'Podemos avisar, ocultar seções, retirar um perfil do ar, suspender a conta e, em último caso, encerrá-la — nesta ordem, conforme a Política de Moderação, que faz parte destes Termos.',
          'O que garantimos em troca, e que vale como cláusula: toda medida tem motivo escrito, que é o texto que você lê; toda medida tem prazo e cai sozinha ao vencer, salvo o encerramento; a partir da retirada do perfil do ar, a cobrança do plano é suspensa enquanto durar a medida; e você tem 15 dias para contestar (30 no encerramento), com 10 dias para a nossa resposta — silêncio nosso nesse prazo derruba a medida.',
          'O encerramento só ocorre depois de suspensão, ou por ordem judicial, e nele a parte não usada do plano é devolvida. A conta encerrada libera o endereço público para outra pessoa; o registro da decisão permanece, e os seus direitos de titular de dados continuam valendo (ver Política de Privacidade).',
        ],
      },
      {
        heading: '11. Situações que levam direto à suspensão',
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
        heading: '12. Limitação de responsabilidade',
        paragraphs: [
          'O serviço é fornecido “no estado em que se encontra”. A checagem de conformidade é um apoio automatizado que sinaliza e pode bloquear violações — não é garantia de adequação integral do conteúdo às normas. Na máxima extensão permitida pela lei, o advoc.me não se responsabiliza:',
        ],
        bullets: [
          'por conteúdo, dados ou documentos falsos, inverídicos, adulterados ou de titularidade de terceiros que você inserir, declarar ou enviar;',
          'por conteúdo que você optou por publicar em desacordo com o Provimento 205/2021, o Código de Ética ou a legislação — inclusive quando itens do perfil venham a sair da conformidade após a publicação;',
          'por sanções disciplinares, administrativas, cíveis ou penais decorrentes do uso que você faz da plataforma ou do conteúdo que publica;',
          'pelo que acontece nos canais externos para os quais o perfil leva (WhatsApp, redes sociais, vídeo hospedado em terceiros);',
          'por indisponibilidades temporárias do serviço. Trabalhamos para mantê-lo no ar e com cópias de segurança diárias, mas não garantimos disponibilidade ininterrupta.',
          'pela relação entre você e quem o procura pelo perfil — a plataforma não é parte na contratação, não recebe honorários, não avalia causas e não guarda o que o visitante escreve para você.',
        ],
      },
      {
        heading: '13. Alterações',
        paragraphs: [
          'Podemos atualizar estes Termos. A data no topo diz quando foi a última vez; mudanças relevantes — em especial de preço ou de cobrança — são avisadas com antecedência na plataforma. Continuar usando o serviço depois do aviso significa concordar com a versão nova; se não concordar, você pode cancelar o plano e excluir a conta a qualquer momento.',
        ],
      },
      {
        heading: '14. Lei aplicável, foro e contato',
        paragraphs: [
          `Estes Termos seguem a lei brasileira. Para qualquer disputa, fica eleito o foro do seu domicílio, como prevê o Código de Defesa do Consumidor.`,
          `Contratante: ${OPERADOR.razaoSocial}, CNPJ ${OPERADOR.cnpj}, com sede em ${operadorEndereco()}. Dúvidas sobre estes Termos: ${CANAL_CONTA}, que entra numa fila com prazo e registro.`,
          `Notificações extrajudiciais e ordens judiciais devem ser dirigidas à sede acima, identificando a página (endereço completo) e o conteúdo em questão. Quem quer reclamar do conteúdo de um perfil não precisa de nada disso nem de conta: o link "Denunciar este perfil" está no rodapé de toda página pública.`,
        ],
      },
    ],
  },
  {
    slug: 'lgpd',
    navLabel: 'LGPD',
    title: 'Política de Proteção de Dados (LGPD)',
    summary: 'Como o advoc.me aplica a Lei Geral de Proteção de Dados, ponto a ponto.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'Esta Política detalha como o advoc.me aplica a Lei nº 13.709/2018 (LGPD). Complementa a Política de Privacidade, que diz o que guardamos e por quanto tempo; aqui está o como.',
        ],
      },
      {
        heading: '1. Papéis',
        paragraphs: [
          `Controlador: ${OPERADOR.razaoSocial}, CNPJ ${OPERADOR.cnpj}, que opera o advoc.me.`,
          'O advoc.me é controlador dos dados necessários para operar a plataforma: conta, perfil, assinatura, suporte e moderação. Os provedores de hospedagem, de geração de texto por IA e, quando ativo, de pagamento são operadores, que tratam dados só sob nossas instruções.',
          'Os contatos que cada advogado recebe pelos canais dele não passam por nós: a mensagem vai do aparelho do visitante para o WhatsApp do advogado, que é o único controlador desses dados. O advogado que cadastra dados de colegas num escritório responde pela autorização deles.',
        ],
      },
      {
        heading: '2. Princípios que viraram decisões de produto',
        bullets: [
          'Necessidade e minimização: a agenda que guardava nome, WhatsApp e assunto de quem procurava um advogado foi retirada do produto em agosto de 2026 justamente por concentrar dado de terceiro sem necessidade. A trilha de auditoria guarda o retrato da apresentação, o resultado da checagem e a versão da política — nada além.',
          'Finalidade: contamos acontecimentos no perfil, não pessoas. Não há endereço IP, cookie ou identificação de aparelho nesses registros, e não há "de onde veio o visitante", porque saber isso exigiria guardar de onde ele veio.',
          'Transparência: o que guardamos está listado em português na tela "Seus dados" da sua conta, antes de qualquer botão, e nesta documentação.',
          'Livre acesso e portabilidade: a cópia dos seus dados sai em JSON, formato aberto, sem pedir a ninguém.',
          'Segurança e prevenção: descritas no item 4.',
          'Não discriminação: nenhum dado é usado para ordenar, destacar ou rebaixar advogados entre si. Não existe ranking nem posição paga.',
        ],
      },
      {
        heading: '3. Prazos de guarda',
        bullets: [
          'Conta, perfil, escritório e chamados: enquanto a conta existir.',
          `Acontecimentos do perfil: ${PRAZO_EVENTOS}. Trilha de auditoria: ${PRAZO_AUDITORIA}. Eventos de cobrança: ${PRAZO_COBRANCA}. O expurgo roda automaticamente todos os dias.`,
          `Conteúdo removido pela moderação: ${PRAZO_CONTEUDO_REMOVIDO}. Registro da decisão: ${PRAZO_REGISTRO_MODERACAO}.`,
          `Registro de acesso (Marco Civil, art. 15): ${PRAZO_ACESSO}. É o único prazo aqui que não é escolha nossa — é o que a lei manda guardar, e por isso não é reduzido a pedido do titular. Também não é ampliado: passado o prazo, é apagado.`,
          `Cópias de segurança cifradas: ${PRAZO_BACKUP}.`,
        ],
      },
      {
        heading: '4. Segurança',
        bullets: [
          'Senhas apenas como hash (scrypt, com sal aleatório e parâmetros guardados junto, para poderem ser reforçados sem invalidar as existentes).',
          'A sessão é um cookie HttpOnly — a página não consegue lê-lo, e por isso um script injetado não consegue levá-lo embora. Toda escrita exige um segundo valor que só a página legítima tem (proteção CSRF). Sair de verdade revoga a sessão no servidor.',
          'Painel administrativo com contas individuais, papéis, senha e segundo fator (TOTP); cada ação fica registrada com autor, alvo, motivo, antes e depois.',
          'Limites de tentativas por endereço e por conta. Fora do registro de acesso exigido pelo art. 15 do Marco Civil, o endereço IP é usado apenas no momento e não é gravado.',
          'Fronteira de segurança única no servidor para tudo o que entra (tamanho, formato, endereços, HTML), com auditorias periódicas registradas.',
          'Cópias de segurança diárias, cifradas com chave pública antes de sair do servidor; a chave privada fica fora de qualquer servidor e a restauração é testada.',
        ],
      },
      {
        heading: '5. Transferência internacional',
        paragraphs: [
          'Os provedores de hospedagem e de geração de texto por IA podem tratar dados fora do Brasil. Nesses casos a transferência se apoia no art. 33 da LGPD — em especial em cláusulas contratuais e garantias de proteção compatíveis com a lei — e enviamos a cada um só o necessário: ao provedor de IA, as palavras-chave e o texto pedido, nunca a conta, o e-mail ou dados de visitantes.',
        ],
      },
      {
        heading: '6. Direitos do titular',
        paragraphs: [
          `Confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamentos e revogação de consentimento. Acesso, portabilidade, encerramento de sessões e eliminação estão na tela "Seus dados" da sua conta; o resto, e qualquer dúvida, por ${CANAL_CONTA}, com resposta em até ${PRAZO_RESPOSTA_TITULAR} — ou, sem conta, por ${CANAL_SEDE}. Você também pode recorrer à ANPD.`,
          `Limite honesto do direito de eliminação: o registro de acesso do art. 15 do Marco Civil e o registro de decisões de moderação não são apagados a pedido, porque a LGPD (art. 16, I e II) ressalva a guarda necessária ao cumprimento de obrigação legal e ao exercício regular de direitos. Tudo o mais é. E o registro de acesso, mesmo não sendo apagável, é VISÍVEL para você: sai na cópia dos seus dados.`,
        ],
      },
      {
        heading: '7. Incidentes',
        paragraphs: [
          'Em caso de incidente de segurança que possa causar risco ou dano relevante aos titulares, adotaremos as medidas de contenção cabíveis e faremos as comunicações exigidas à ANPD e aos titulares afetados, dizendo o que aconteceu, quais dados foram atingidos e o que fizemos.',
        ],
      },
      {
        heading: '8. Encarregado (DPO)',
        paragraphs: [
          `Encarregado pelo tratamento de dados pessoais, mantido por ${OPERADOR.razaoSocial} (CNPJ ${OPERADOR.cnpj}), com sede em ${operadorEndereco()}.`,
          `Atende por ${CANAL_CONTA}, que registra o pedido, a data e a resposta dos dois lados — e não depende de um e-mail chegar. Sem conta, por ${CANAL_SEDE}.`,
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    navLabel: 'Cookies',
    title: 'Política de Cookies',
    summary: 'Quais cookies e armazenamentos locais o advoc.me usa — e os que não usa.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'O advoc.me usa apenas cookies e armazenamentos locais estritamente necessários ao funcionamento. Não usamos cookies de publicidade, de análise de audiência nem rastreadores de terceiros. Por isso não há banner de cookies: não há nada a consentir além do próprio serviço.',
        ],
      },
      {
        heading: '1. Cookies',
        bullets: [
          'Sessão da conta: um cookie HttpOnly (a página não consegue lê-lo) que identifica a sua sessão. Se você marcar "continuar conectado neste aparelho", ele tem prazo próprio e sobrevive ao fechamento do navegador; se não marcar, morre com a janela. Em qualquer caso há um limite máximo absoluto de duração.',
          'Proteção contra requisições forjadas: um segundo cookie, legível pela página, cujo valor precisa acompanhar toda escrita. Ele não identifica você; só prova que o pedido veio da página legítima.',
          'Painel administrativo: quem administra a plataforma tem cookies próprios de sessão, com as mesmas características.',
          'Nenhum cookie é gravado no aparelho de quem apenas visita um perfil.',
        ],
      },
      {
        heading: '2. Armazenamento local do navegador',
        bullets: [
          'Um retrato mínimo da conta (e-mail e nome), para a tela não piscar entre "deslogado" e "logado" enquanto o servidor confirma a sessão. Ele não autentica nada sozinho.',
          'Pequenas preferências de interface — por exemplo, o último valor do seu índice de confiança, para mostrar quanto ele subiu desde a última visita.',
          'O rascunho do seu perfil é salvo no servidor, não no navegador.',
        ],
      },
      {
        heading: '3. Serviços de terceiros que o navegador acessa',
        bullets: [
          // Declarado porque é verdade e o documento tem de bater com o que o
          // HTML faz (auditoria de 03/09): as famílias tipográficas dos temas
          // vêm do Google Fonts, e o pedido delas — como qualquer pedido HTTP —
          // entrega endereço IP e identificação do navegador àquele serviço.
          // Nenhum cookie é gravado por ele, e nada além da fonte volta.
          'Fontes: as famílias tipográficas dos temas são servidas pelo Google Fonts. Ao carregar uma página, o navegador as busca diretamente daquele serviço, que recebe, como em qualquer acesso, o endereço IP e a identificação do navegador — sem cookies e sem qualquer outro dado da página. Trabalhamos para hospedá-las em nossos próprios servidores.',
          'Vídeo de apresentação: quando um perfil tem vídeo, ele é exibido a partir do YouTube, que aplica a própria política ao ser carregado.',
        ],
      },
      {
        heading: '4. O que NÃO usamos',
        paragraphs: [
          'Não empregamos cookies de rastreamento publicitário, ferramentas de análise de audiência de terceiros, perfis de comportamento nem venda de dados. As métricas de perfil são contagens de acontecimentos, sem identificar o visitante.',
        ],
      },
      {
        heading: '5. Como controlar',
        paragraphs: [
          'Você pode apagar cookies e o armazenamento local pelo seu navegador. Como esses itens são necessários ao funcionamento, removê-los encerra a sua sessão — basta entrar de novo.',
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
          `A contestação é feita na própria plataforma, na página "Contestar" — que funciona mesmo com a conta suspensa, bastando e-mail e senha para provar quem você é. É de propósito que não dependa de nós responder a nada: a medida cai sozinha se ficarmos calados no prazo.`,
        ],
      },
      {
        heading: '7. Ordem judicial e notificação de terceiro',
        paragraphs: [
          'Cumprimos ordens judiciais no prazo delas e registramos o recebimento. Avisamos você de que houve ordem e do que foi cumprido, salvo quando a própria ordem determinar sigilo. Ordem judicial não é contestável conosco — o caminho é o processo.',
          `Ordens judiciais e notificações extrajudiciais devem ser dirigidas a ${CANAL_SEDE}, com o endereço completo da página e a identificação do conteúdo, como exige o art. 19, § 1º, do Marco Civil da Internet. Nas hipóteses do art. 21 da mesma lei — divulgação de cena de nudez ou de ato sexual de caráter privado, sem autorização —, agimos com a simples notificação da pessoa retratada ou de seu representante, sem esperar ordem.`,
          'Fora dessas hipóteses, quem se sentir prejudicado por um perfil pode usar a Denúncia, que analisamos segundo esta Política. A denúncia não substitui a via judicial: não somos o juiz da causa entre você e o advogado, e não temos como decidir sobre fatos que só as partes conhecem.',
        ],
      },
      {
        heading: '8. Registro',
        paragraphs: [
          `Toda decisão fica registrada com quem decidiu, quando e por quê. O registro é a sua defesa tanto quanto a nossa, e é guardado por ${PRAZO_REGISTRO_MODERACAO}. O conteúdo removido é guardado por ${PRAZO_CONTEUDO_REMOVIDO}, como prova em eventual contestação; depois disso fica apenas o registro da decisão.`,
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
    summary: 'Como qualquer pessoa pode sinalizar conteúdo irregular — e o que fazemos com isso.',
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
          'A denúncia é anônima por padrão; você pode informar um e-mail apenas se quiser retorno — ele nunca é mostrado ao advogado denunciado. Descreva o que e onde viola, para agilizar a análise. Há um limite de denúncias por endereço, para conter abuso.',
          'Não é preciso ter conta: o link "Denunciar este perfil" está no rodapé de todo perfil público, e qualquer pessoa pode usá-lo. Foi feito assim de propósito — um canal de reclamação que exige cadastro é um canal que só o próprio setor usa, e quem costuma ser prejudicado por um perfil irregular é justamente quem nunca entrou aqui.',
        ],
      },
      {
        heading: '3. O que acontece depois',
        paragraphs: [
          'A denúncia entra na fila de moderação e é avaliada conforme a Política de Moderação. Medidas vão de aviso a restrição do perfil, conforme a gravidade — sempre com motivo escrito e prazo. O advogado denunciado vê o motivo e a data da denúncia no relatório dos próprios dados, nunca quem denunciou.',
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
    summary: 'O papel da IA no advoc.me, o que é enviado a quem, e os limites da sua responsabilidade.',
    updated: UPDATED,
    sections: [
      {
        paragraphs: [
          'O advoc.me oferece recursos de IA para ajudar a redigir textos de perfil: a apresentação (bio), as descrições de áreas, a frase de apresentação, as respostas das perguntas frequentes e a revisão de um texto que você já escreveu. O assistente de agendamento que o visitante usa NÃO é IA: é um roteiro fechado, com perguntas fixas, e não gera texto. Esta Política esclarece o papel — e os limites — dessa assistência.',
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
          'Nenhum texto gerado por IA é publicado automaticamente. Você revisa, edita e aprova antes de tudo. Além disso, o texto passa pela mesma checagem de conformidade aplicada a qualquer conteúdo — no editor e de novo no servidor, antes de ir ao ar.',
        ],
      },
      {
        heading: '3. A responsabilidade pelo conteúdo é sua',
        paragraphs: [
          'Ao publicar, você assume a responsabilidade pelo conteúdo, inclusive o que foi gerado com apoio da IA. A checagem reduz erros óbvios, mas não garante conformidade absoluta.',
        ],
      },
      {
        heading: '4. O que é enviado, e para quem',
        bullets: [
          'Enviamos ao provedor de IA apenas o necessário ao pedido: as palavras-chave que você digitou, o texto a revisar (quando é revisão) e, conforme o plano, o seu nome, a cidade e as áreas de atuação, para o texto sair mais completo. Nunca a sua conta, o seu e-mail, a sua senha ou qualquer dado de visitante.',
          'Os provedores atuais são GroqCloud, xAI e Google, usados em cadeia: se um recusa ou falha, o pedido segue para o próximo. A lista pode mudar; esta Política é atualizada quando isso acontece. Esses serviços podem ficar fora do Brasil (ver a Política de Proteção de Dados, item 5).',
          'Se nenhum provedor responder, o texto é montado a partir de um modelo fixo e seguro, sem IA — você percebe porque ele é mais genérico.',
          'Se a IA produzir algo que viole as regras, o sistema pede uma versão corrigida ou recorre ao modelo fixo. O que chega a você já passou pela checagem, e passa de novo quando você publica.',
          'Não usamos os seus textos para treinar modelos, nossos ou de terceiros. Não guardamos o histórico dos pedidos feitos à IA; só o texto que você decidir salvar no perfil fica guardado, como qualquer outro campo.',
        ],
      },
      {
        heading: '5. Limitações',
        paragraphs: [
          'Modelos de IA podem cometer erros ou gerar texto impreciso. Sempre confira nomes, números, formação e qualificações antes de publicar — a IA não tem como saber se um dado sobre você é verdadeiro.',
        ],
      },
    ],
  },
]

export function getLegalDoc(slug: string): LegalDocContent | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug)
}
