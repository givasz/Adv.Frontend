// O endereço do console de administração.
//
// É um segmento aleatório, sem palavra nenhuma dentro, e não é linkado em lugar
// algum da interface pública. Isso NÃO é controle de acesso — quem controla é a
// sessão do painel, no servidor (ver docs/plano-admin.md). É só para a tela de
// login não ficar a um `/admin` de distância de qualquer robô.
//
// Trocável por `VITE_ADMIN_PATH` na hora do build (sem barra inicial). O valor
// em uso fica anotado fora do repositório, em ~/.advocme-secrets.
export const ADMIN_PATH = (import.meta.env.VITE_ADMIN_PATH ?? 'czyqxwy7brd0v27ia9').replace(
  /^\/+/,
  '',
)
