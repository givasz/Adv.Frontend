/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Nota: as variantes de tema (tv-*, surf-*, foil) vivem em CSS puro fora de @layer
  // em src/index.css, então não precisam de safelist — nunca são purgadas.
  theme: {
    extend: {
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
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(33,28,23,0.04), 0 8px 24px -12px rgba(33,28,23,0.18)',
        lift: '0 2px 4px rgba(33,28,23,0.05), 0 18px 40px -16px rgba(33,28,23,0.28)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
