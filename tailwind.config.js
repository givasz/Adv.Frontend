/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Nota: as variantes de tema (tv-*, surf-*, foil) vivem em CSS puro fora de @layer
  // em src/index.css, então não precisam de safelist — nunca são purgadas.
  theme: {
    extend: {
      // Celular de verdade começa em 320px (iPhone SE) e há Android de 280px.
      // `xs` é o ponto em que duas colunas e três botões lado a lado param de
      // espremer — abaixo dele a capa do painel empilha.
      screens: {
        xs: '420px',
      },
      colors: {
        // Paleta "Papel & Tinta" — letterhead de escritório de advocacia
        paper: {
          DEFAULT: '#f5f0e6',
          soft: '#faf6ec',
          deep: '#ebe3d3',
        },
        ink: {
          DEFAULT: '#211c17',
          soft: '#443b32',
          faint: '#6b6155',
        },
        burgundy: {
          DEFAULT: '#6b2131',
          deep: '#521826',
          soft: '#8a3243',
        },
        brass: {
          DEFAULT: '#b08d57',
          // escurecido de #96743f → ~5:1 sobre o papel (AA p/ texto pequeno)
          deep: '#835f2e',
          light: '#d8b985',
        },
        // Paleta do CONSOLE (painel interno de gestão). Deliberadamente fora do
        // "Papel & Tinta": o console é ferramenta de operação, não vitrine —
        // neutros frios, um acento só e cores semânticas (ok/aviso/perigo)
        // que o produto público não usa. Ver components/admin/pecas.tsx.
        adm: {
          bg: '#f3f5f9',
          surface: '#ffffff',
          raised: '#f8fafc',
          border: '#e3e8ef',
          line: '#edf1f6',
          ink: '#111827',
          soft: '#374151',
          muted: '#6b7280',
          faint: '#9ca3af',
          side: '#0f172a',
          'side-hi': '#1e293b',
          accent: '#2563eb',
          'accent-deep': '#1e40af',
          'accent-soft': '#e0e9ff',
          ok: '#15803d',
          'ok-soft': '#dcfce7',
          warn: '#b45309',
          'warn-soft': '#fef3c7',
          danger: '#b91c1c',
          'danger-soft': '#fee2e2',
          info: '#0e7490',
          'info-soft': '#cffafe',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        // Console: uma grotesca de interface, já carregada pelo index.html
        // (é a família do tema Ardósia) — nenhum pedido de fonte a mais.
        ui: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(33,28,23,0.04), 0 8px 24px -12px rgba(33,28,23,0.18)',
        lift: '0 2px 4px rgba(33,28,23,0.05), 0 18px 40px -16px rgba(33,28,23,0.28)',
        // O "selo": a plaqueta de tinta com a sombra de latão deslocada, como um
        // carimbo sobre papel timbrado. É a assinatura gráfica do painel.
        selo: '0 0 0 1px rgba(33,28,23,0.92), 3px 3px 0 0 #b08d57',
      },
      borderRadius: {
        // Era 1.25rem: o canto de 20px deixava cada caixa com cara de bolha de
        // aplicativo genérico. 14px mantém a suavidade e devolve o desenho seco
        // de papel timbrado — e vale para o app inteiro de uma vez.
        xl2: '0.875rem',
      },
    },
  },
  plugins: [],
}
