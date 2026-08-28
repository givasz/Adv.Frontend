import type { Plan, Profile } from './types'
import { AREA_LIMIT, CHAR_LIMITS, FAQ_LIMIT, canUseFaq, canUseScheduling } from './plans'
import { canUsePrintCard, canUseVideo, canUseDigitalCard } from './plans'
import { getTheme, isThemeUnlocked } from './themes'
import { PLAN_LABEL } from './upsell'

// O QUE MUDA AO DESCER DE PLANO — dito antes, não depois.
//
// Descer de plano era um clique só, sem confirmação e sem uma palavra sobre o que
// aconteceria. Quem clicasse "Voltar ao Free" descobria o efeito abrindo a própria
// página, na melhor das hipóteses.
//
// A lista é montada a partir do PERFIL REAL, não de um texto genérico de marketing
// ao contrário. Um advogado que nunca gravou vídeo não precisa ler que vai perder o
// vídeo; um que tem cinco perguntas frequentes precisa ler que só duas continuam
// aparecendo. Aviso que fala do que não se tem é aviso que ninguém lê.
//
// E cada frase diz o DESTINO da coisa, não só que ela sai do ar. "Fica guardado" e
// "é apagado" são promessas diferentes, e é justo que a pessoa saiba qual das duas
// está aceitando antes de clicar. Hoje, nesta plataforma, a resposta é sempre a
// primeira — nada é apagado (ver backend/src/profiles/profiles.service.ts).

export interface MudancaDePlano {
  /** o que sai da página pública */
  perde: string[]
  /** o que continua igual — a parte que tranquiliza, e é verdade */
  mantem: string[]
}

const contar = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`

export function mudancasAoDescer(p: Profile, alvo: Plan): MudancaDePlano {
  const atual = p.plan
  const perde: string[] = []
  const mantem: string[] = []

  // --- Endereço público: a garantia mais importante, e a primeira da lista ----
  // É o que está impresso no cartão de visita, colado no QR e indexado no Google.
  mantem.push(`Seu endereço advoc.me/${p.slug} continua o mesmo`)

  // --- Áreas de atuação ------------------------------------------------------
  const areas = (p.areas ?? []).filter((a) => a.label.trim()).length
  if (areas > AREA_LIMIT[alvo]) {
    perde.push(
      `Das suas ${contar(areas, 'área', 'áreas')} de atuação, ` +
        `${AREA_LIMIT[alvo]} continuam aparecendo — as outras ficam guardadas`,
    )
  }

  // --- Perguntas frequentes --------------------------------------------------
  const faqs = (p.faqs ?? []).filter((f) => f.question.trim() && f.answer.trim()).length
  if (faqs > FAQ_LIMIT[alvo]) {
    perde.push(
      FAQ_LIMIT[alvo] === 0
        ? `Suas ${contar(faqs, 'pergunta frequente', 'perguntas frequentes')} saem do perfil — o texto fica guardado`
        : `Das suas ${contar(faqs, 'pergunta', 'perguntas')} frequentes, ${FAQ_LIMIT[alvo]} continuam aparecendo`,
    )
  }

  // --- Agendamento -----------------------------------------------------------
  if (canUseScheduling(atual) && !canUseScheduling(alvo) && p.schedulingMode !== 'off') {
    perde.push(
      p.schedulingMode === 'assistant'
        ? 'O assistente virtual sai do perfil — sua grade de horários fica guardada'
        : 'O botão “Agendar” sai do perfil',
    )
  }

  // --- Vídeo -----------------------------------------------------------------
  if (canUseVideo(atual) && !canUseVideo(alvo) && p.videoUrl) {
    perde.push('O vídeo de apresentação sai do perfil — o link fica guardado')
  }

  // --- Marca própria ---------------------------------------------------------
  if (atual === 'premium' && alvo !== 'premium' && p.branding) {
    perde.push('Sua marca volta a ser a do advoc.me — as suas cores e o seu nome ficam guardados')
  }

  // --- Cartão impresso -------------------------------------------------------
  if (canUsePrintCard(atual) && !canUsePrintCard(alvo) && p.card) {
    perde.push('O cartão de visita para imprimir deixa de ser gerado — o modelo fica guardado')
  }

  // --- Cartão digital (QR + vCard) -------------------------------------------
  if (canUseDigitalCard(atual) && !canUseDigitalCard(alvo)) {
    perde.push('O cartão digital com QR em alta resolução deixa de ser gerado')
  }

  // --- Tema ------------------------------------------------------------------
  if (!isThemeUnlocked(getTheme(p.theme), alvo)) {
    perde.push(`O tema ${getTheme(p.theme).name} volta ao tema neutro`)
  }

  // --- Textos longos ---------------------------------------------------------
  // Não é perda: o texto CONTINUA no ar. O que muda é o teto de edição — e dizer
  // isso errado ("sua bio será cortada") assustaria à toa.
  const bio = (p.bio ?? '').length
  if (bio > CHAR_LIMITS[alvo].bio) {
    mantem.push(
      `Sua bio de ${bio} caracteres continua no ar; para aumentá-la, o limite do ${PLAN_LABEL[alvo]} é ${CHAR_LIMITS[alvo].bio}`,
    )
  }

  mantem.push('Sua página segue publicada, com foto, contato, redes e áreas')
  if (canUseFaq(alvo) === false && faqs > 0) {
    // Já dito acima na lista do que sai; aqui reforça o destino do conteúdo.
    mantem.push('Nada é apagado: tudo volta como estava se você assinar de novo')
  } else {
    mantem.push('Nada é apagado — o que sai da página fica guardado na sua conta')
  }

  return { perde, mantem }
}
