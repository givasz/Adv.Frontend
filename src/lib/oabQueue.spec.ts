// Trava do ciclo de conferência da OAB no modo mock — as MESMAS regras do backend
// (src/oab/verification/oab-verification.service.ts):
//   • o advogado só PEDE; quem promove a 'verified' é a plataforma;
//   • pedido entra em 'pending' e fica assim até a decisão do admin;
//   • rejeitar exige motivo, e o motivo volta para o advogado;
//   • trocar o número derruba a conferência (foi AQUELE número que se conferiu).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from './types'

// localStorage de mentira (o ambiente de teste é node, sem DOM).
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

const store = fakeStorage()
vi.stubGlobal('localStorage', store)

const DRAFT_KEY = 'advocme:profile:draft'

async function lib() {
  return import('./api')
}

function seed(patch: Partial<Profile> = {}) {
  const draft = {
    slug: 'ana-lima-1234',
    name: 'Ana Lima',
    oabNumber: 'OAB/MG 123.456',
    oabVerified: false,
    oabStatus: 'none',
    headline: '',
    bio: '',
    city: 'Belo Horizonte',
    state: 'MG',
    serviceMode: { inPerson: true, online: true },
    areas: [],
    socials: [],
    contact: {},
    plan: 'pro',
    theme: 'papel',
    views: 0,
    published: true,
    ...patch,
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  return draft as unknown as Profile
}

function current(): Profile {
  return JSON.parse(localStorage.getItem(DRAFT_KEY)!) as Profile
}

describe('conferência de OAB (mock)', () => {
  beforeEach(() => {
    store.clear()
  })

  it('pedido entra em análise e NÃO concede a marca', async () => {
    seed()
    const { api } = await lib()
    const state = await api.requestOabCheck()
    expect(state.oabStatus).toBe('pending')
    expect(state.oabVerified).toBe(false)
    expect(state.oabRequestedAt).toBeTruthy()
    expect(current().oabStatus).toBe('pending') // sobrevive ao recarregar
  })

  it('pedir duas vezes não abre um segundo pedido', async () => {
    seed()
    const { api, mockOabQueue } = await lib()
    const first = await api.requestOabCheck()
    const second = await api.requestOabCheck()
    expect(second.oabRequestedAt).toBe(first.oabRequestedAt)
    expect(mockOabQueue.history('ana-lima-1234')).toHaveLength(1)
  })

  it('plano Free não tem conferência', async () => {
    seed({ plan: 'free' })
    const { api } = await lib()
    await expect(api.requestOabCheck()).rejects.toThrow(/planos pagos/i)
  })

  it('sem número de inscrição não dá para pedir', async () => {
    seed({ oabNumber: '  ' })
    const { api } = await lib()
    await expect(api.requestOabCheck()).rejects.toThrow(/número de inscrição/i)
  })

  it('fica pendente até o admin decidir — e a aprovação concede a marca', async () => {
    seed()
    const { api, mockOabQueue } = await lib()
    await api.requestOabCheck()
    expect(mockOabQueue.pending()).toHaveLength(1)

    const decided = mockOabQueue.decide('ana-lima-1234', 'verify')
    expect(decided.oabStatus).toBe('verified')
    expect(decided.oabVerified).toBe(true)
    expect(mockOabQueue.pending()).toHaveLength(0)
  })

  it('rejeição exige motivo e devolve o motivo ao advogado', async () => {
    seed()
    const { api, mockOabQueue } = await lib()
    await api.requestOabCheck()

    expect(() => mockOabQueue.decide('ana-lima-1234', 'reject', '   ')).toThrow(/motivo/i)

    const decided = mockOabQueue.decide('ana-lima-1234', 'reject', 'Nome diverge do CNA.')
    expect(decided.oabStatus).toBe('rejected')
    expect(decided.oabVerified).toBe(false)
    expect(decided.oabReason).toBe('Nome diverge do CNA.')
    expect(current().oabReason).toBe('Nome diverge do CNA.')
  })

  it('um novo pedido limpa o motivo da rejeição anterior', async () => {
    seed()
    const { api, mockOabQueue } = await lib()
    await api.requestOabCheck()
    mockOabQueue.decide('ana-lima-1234', 'reject', 'Nome diverge do CNA.')

    const again = await api.requestOabCheck()
    expect(again.oabStatus).toBe('pending')
    expect(again.oabReason).toBeFalsy()
  })

  it('trocar o número de inscrição derruba a conferência', async () => {
    seed()
    const { api, mockOabQueue } = await lib()
    await api.requestOabCheck()
    mockOabQueue.decide('ana-lima-1234', 'verify')

    await api.saveDraft({ ...current(), oabNumber: 'OAB/SP 999.999' })
    expect(current().oabStatus).toBe('none')
    expect(current().oabVerified).toBe(false)
  })

  it('o autosave do editor não altera o estado da conferência', async () => {
    seed()
    const { api, mockOabQueue } = await lib()
    await api.requestOabCheck()
    mockOabQueue.decide('ana-lima-1234', 'verify')

    // O editor manda o perfil inteiro — inclusive um oabStatus velho da tela.
    await api.saveDraft({ ...current(), oabStatus: 'none', oabVerified: false, bio: 'texto novo' })
    expect(current().oabStatus).toBe('verified')
    expect(current().bio).toBe('texto novo')
  })
})
