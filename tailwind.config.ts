import type { Config } from 'tailwindcss';

/**
 * Forge design system.
 *
 * Gold is sampled from the logo (#FEDD39) and is only 1.34:1 on white, so it is a
 * FILL with near-black ink. `goldUi` and `goldText` are the darkened steps that pass
 * WCAG for indicators and text. Everything else is a warm neutral ramp — warm rather
 * than blue-grey because it sits under gold without going muddy.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        text: ['var(--font-text)', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold:     '#FEDD39',
        goldUi:   '#A88C00',
        goldText: '#8A7300',
        goldSoft: '#FFF8DC',
        ink:      '#0A0708',
        page:     '#F6F6F4',   // warm neutral, not blue-grey
        surface:  '#FFFFFF',
        surface2: '#F2F2EF',
        line:     '#E8E8E3',
        body:     '#12120F',
        muted:    '#6B6B63',
        faint:    '#9A9A90',
      },
      borderRadius: { card: '22px', pill: '999px', btn: '16px' },
      boxShadow: {
        // layered, low-opacity — depth without the grey haze of a single big blur
        card: '0 1px 2px rgba(18,18,15,.04), 0 8px 24px -12px rgba(18,18,15,.10)',
        lift: '0 2px 4px rgba(18,18,15,.05), 0 18px 40px -16px rgba(18,18,15,.18)',
        nav:  '0 4px 12px rgba(18,18,15,.06), 0 20px 48px -20px rgba(18,18,15,.30)',
        gold: '0 2px 6px rgba(168,140,0,.20), 0 12px 28px -12px rgba(168,140,0,.45)',
      },
      letterSpacing: { tightest: '-0.045em', tighter: '-0.03em' },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(10px)' },
                '100%': { opacity: '1', transform: 'none' } },
        pop:  { '0%': { opacity: '0', transform: 'scale(.97)' },
                '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        rise: 'rise .45s cubic-bezier(.16,1,.3,1) both',
        pop:  'pop .35s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
