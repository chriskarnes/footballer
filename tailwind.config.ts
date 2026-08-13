import type { Config } from 'tailwindcss';

/**
 * Forge design system — Material Design 3.
 *
 * Nothing is a literal here. Every value resolves to a custom property defined
 * in src/app/globals.css, which is what lets a utility like
 * `bg-primary-container` follow the light and dark schemes without a `dark:`
 * variant anywhere in the app.
 *
 * This is the Tailwind v3 shape of the job. On v4 the same tokens would live in
 * an `@theme` block and generate their utilities directly; on v3 the custom
 * properties live in CSS and this file names them.
 *
 * The whole colour scheme derives from one source hue — HCT 255, chroma 42 —
 * through Google's material-color-utilities. If the brand colour moves,
 * regenerate from the new source rather than hand-editing tones here.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        brand: ['var(--md-ref-typeface-brand)'],
        plain: ['var(--md-ref-typeface-plain)'],
      },
      colors: {
        surface:                     'var(--md-sys-color-surface)',
        primary:                     'var(--md-sys-color-primary)',
        'on-primary':                'var(--md-sys-color-on-primary)',
        'primary-container':         'var(--md-sys-color-primary-container)',
        'on-primary-container':      'var(--md-sys-color-on-primary-container)',
        secondary:                   'var(--md-sys-color-secondary)',
        'on-secondary':              'var(--md-sys-color-on-secondary)',
        'secondary-container':       'var(--md-sys-color-secondary-container)',
        'on-secondary-container':    'var(--md-sys-color-on-secondary-container)',
        tertiary:                    'var(--md-sys-color-tertiary)',
        'on-tertiary':               'var(--md-sys-color-on-tertiary)',
        'tertiary-container':        'var(--md-sys-color-tertiary-container)',
        'on-tertiary-container':     'var(--md-sys-color-on-tertiary-container)',
        error:                       'var(--md-sys-color-error)',
        'on-error':                  'var(--md-sys-color-on-error)',
        'error-container':           'var(--md-sys-color-error-container)',
        'on-error-container':        'var(--md-sys-color-on-error-container)',
        'on-surface':                'var(--md-sys-color-on-surface)',
        'surface-variant':           'var(--md-sys-color-surface-variant)',
        'on-surface-variant':        'var(--md-sys-color-on-surface-variant)',
        'surface-container-lowest':  'var(--md-sys-color-surface-container-lowest)',
        'surface-container-low':     'var(--md-sys-color-surface-container-low)',
        'surface-container':         'var(--md-sys-color-surface-container)',
        'surface-container-high':    'var(--md-sys-color-surface-container-high)',
        'surface-container-highest': 'var(--md-sys-color-surface-container-highest)',
        'surface-dim':               'var(--md-sys-color-surface-dim)',
        'surface-bright':            'var(--md-sys-color-surface-bright)',
        outline:                     'var(--md-sys-color-outline)',
        'outline-variant':           'var(--md-sys-color-outline-variant)',
        'inverse-surface':           'var(--md-sys-color-inverse-surface)',
        'inverse-on-surface':        'var(--md-sys-color-inverse-on-surface)',
        'inverse-primary':           'var(--md-sys-color-inverse-primary)',
        scrim:                       'var(--md-sys-color-scrim)',
        /* Forge extensions — M3 defines no role for these. */
        'forge-inverse-on-surface-variant': 'var(--forge-inverse-on-surface-variant)',
        'forge-inverse-outline-variant':    'var(--forge-inverse-outline-variant)',
        'forge-category-technical':         'var(--forge-category-technical)',
        'forge-category-technical-dim':     'var(--forge-category-technical-dim)',
        'forge-category-physical':          'var(--forge-category-physical)',
        'forge-category-physical-dim':      'var(--forge-category-physical-dim)',
        'forge-category-finishing':         'var(--forge-category-finishing)',
        'forge-category-finishing-dim':     'var(--forge-category-finishing-dim)',
        'on-category':                      'var(--forge-on-category)',
        'on-category-variant':              'var(--forge-on-category-variant)',
      },
      borderRadius: {
        /* ---- M3 shape scale (stage 1) ---- */
        none:              'var(--md-sys-shape-corner-none)',
        'extra-small':     'var(--md-sys-shape-corner-extra-small)',
        small:             'var(--md-sys-shape-corner-small)',
        medium:            'var(--md-sys-shape-corner-medium)',
        large:             'var(--md-sys-shape-corner-large)',
        'large-increased': 'var(--md-sys-shape-corner-large-increased)',
        'extra-large':     'var(--md-sys-shape-corner-extra-large)',
        full:              'var(--md-sys-shape-corner-full)',
      },
      boxShadow: {
        /* ---- M3 elevation (stage 1). M3 prefers tonal elevation over drop
           shadows, so most of these stay unused — see the note in globals.css. */
        level0: 'var(--md-sys-elevation-level0)',
        level1: 'var(--md-sys-elevation-level1)',
        level2: 'var(--md-sys-elevation-level2)',
        level3: 'var(--md-sys-elevation-level3)',
        level4: 'var(--md-sys-elevation-level4)',
        level5: 'var(--md-sys-elevation-level5)',
      },
      transitionTimingFunction: {
        standard:                'var(--md-sys-motion-easing-standard)',
        'emphasized-decelerate': 'var(--md-sys-motion-easing-emphasized-decelerate)',
        'emphasized-accelerate': 'var(--md-sys-motion-easing-emphasized-accelerate)',
      },
      transitionDuration: {
        short2:  'var(--md-sys-motion-duration-short2)',
        medium2: 'var(--md-sys-motion-duration-medium2)',
        long2:   'var(--md-sys-motion-duration-long2)',
      },
      letterSpacing: {
        /* M3 typescale tracking, retuned for Roboto Flex — see globals.css. */
        tightest: 'var(--forge-track-tightest)',
        tighter:  'var(--forge-track-tighter)',
      },
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
