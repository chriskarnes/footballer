import type { Config } from 'tailwindcss';

/**
 * Train.futbol design system — Material Design 3.
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
 * The scheme is monochrome — one neutral ramp at chroma 0. The role names
 * below are unchanged and still worth having: `primary` means "the accent"
 * whether the accent is a hue or a value, and keeping the M3 vocabulary is
 * what let the palette swap out underneath this file without touching it.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* The in-between steps the app keeps needing: 18px icons, 22px boxes,
         52px rows and buttons (the tick column and the big ghost button). */
      spacing: { 4.5: '18px', 5.5: '22px', 13: '52px' },
      fontFamily: {
        brand: ['var(--md-ref-typeface-brand)'],
        plain: ['var(--md-ref-typeface-plain)'],
      },
      colors: {
        /* The marketing site's fixed palette: see the MARKETING SITE block in globals.css. */
        // Hex, not var(): Tailwind can only apply /opacity (border-site-ink/45) to
        // literal colours. Keep in step with the --site-* variables in globals.css.
        site: { ink: '#071D17', pitch: '#0D3026', moss: '#3D6B58',
                mint: '#CFE8D9', paper: '#F2F7F3', lime: '#C8F03C' },
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
        /* App extensions — M3 defines no role for these. */
        /* The brand block: a surface made of the brand that does not follow
           the scheme. See the note in globals.css for why this is not
           inverse-surface. */
        'surface-brand':                    'var(--app-surface-brand)',
        'on-surface-brand':                 'var(--app-on-surface-brand)',
        'on-surface-brand-variant':         'var(--app-on-surface-brand-variant)',
        'brand-track':                      'var(--app-brand-track)',
        'brand-edge':                       'var(--app-brand-edge)',
        'brand-accent':                     'var(--app-brand-accent)',
        'status-good':                      'var(--app-status-good)',
        'status-warn':                      'var(--app-status-warn)',
        'status-bad':                       'var(--app-status-bad)',
        'app-inverse-on-surface-variant': 'var(--app-inverse-on-surface-variant)',
        'app-inverse-outline-variant':    'var(--app-inverse-outline-variant)',
        'app-category-technical':         'var(--app-category-technical)',
        'app-category-technical-dim':     'var(--app-category-technical-dim)',
        'app-category-physical':          'var(--app-category-physical)',
        'app-category-physical-dim':      'var(--app-category-physical-dim)',
        'app-category-finishing':         'var(--app-category-finishing)',
        'app-category-finishing-dim':     'var(--app-category-finishing-dim)',
        'on-category':                      'var(--app-on-category)',
        'on-category-variant':              'var(--app-on-category-variant)',
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
      fontSize: {
        /* The app's type steps. Every size in the app is one of these; the
           M3 roles above them (.h-page, .h-card, .eyebrow) use the same
           tokens. Font size only: line height stays with the element. */
        'label-sm':    'var(--md-sys-typescale-label-small-size)',   // 11
        caption:       '12px',
        'body-sm':     '13px',
        body:          '14px',
        'body-lg':     'var(--md-sys-typescale-body-large-size)',    // 15
        'title-sm':    '16px',
        title:         'var(--md-sys-typescale-title-medium-size)',  // 17
        'title-lg':    '19px',
        'display-sm':  '22px',
        display:       '24px',
        headline:      'var(--md-sys-typescale-headline-small-size)', // 27
        'headline-lg': 'var(--md-sys-typescale-headline-large-size)', // 34
      },
      letterSpacing: {
        /* Brand-face tracking, retuned for Roboto Flex — see globals.css.
           Named apart from Tailwind's own tight/tighter (-0.025/-0.05em):
           these are looser than both, and were once called "tightest" and
           "tighter", the wrong way round. */
        'brand-tight': 'var(--app-track-brand-tight)',
        'brand-snug':  'var(--app-track-brand-snug)',
      },
    },
  },
  plugins: [],
};
export default config;
