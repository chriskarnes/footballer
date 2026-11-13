/**
 * Two colours in, a whole scheme out.
 *
 * globals.css names this as the missing piece: "two hardcoded values cannot
 * answer 'what is the hover tint of your green'". This is the answer, kept
 * deliberately small — no tonal-palette library, just mixing toward white or
 * black until a WCAG ratio is met. Every text pair it emits is checked here,
 * not eyeballed, so a club that picks a yellow primary gets black text on it
 * rather than an invisible label.
 *
 * Pure functions only: this runs on the server to write the <style> tag and in
 * the admin panel to preview a palette before it is saved.
 */

export type Hex = `#${string}`;

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s: unknown): s is Hex => typeof s === 'string' && HEX.test(s);

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) =>
  ('#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')).toUpperCase() as Hex;

/** `a` moved `t` of the way toward `b`. */
export const mix = (a: string, b: string, t: number): Hex => {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};

const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

const WHITE = '#FFFFFF', INK = '#111111';

/** White or ink, whichever reads better on `bg`. */
export const onColor = (bg: string): Hex => (contrast(WHITE, bg) >= contrast(INK, bg) ? WHITE : INK);

/**
 * `fg`, pushed toward white or black (whichever is further from `bg`) in 5%
 * steps until it reaches `ratio` against `bg`. Keeps as much of the hue as the
 * ratio allows, which is the point: a gold that has to darken stays a gold.
 */
export function ensure(fg: string, bg: string, ratio = 4.5): Hex {
  const toward = lum(bg) > 0.18 ? '#000000' : WHITE;
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(fg, toward, t);
    if (contrast(c, bg) >= ratio) return c;
  }
  return toward as Hex;
}

const PAGE_LIGHT = '#FFFFFF', PAGE_DARK = '#121212';

/**
 * The custom properties a brand overrides. Anything not listed keeps its
 * monochrome value from globals.css, so the neutral surfaces stay neutral and
 * only the things that were already "the brand" take the colour.
 */
export function brandTokens(primary: string, accent: string) {
  const P = primary.toUpperCase();
  const onP = onColor(P);
  // The block can be any colour, but links and focus rings sit on the white
  // page, so they get a version of the primary that clears 4.5:1 there.
  const ink = ensure(P, PAGE_LIGHT);
  const quiet = ensure(mix(onP, P, 0.25), P);
  // The trim is spent sparingly — a label, the progress fill — and never on
  // secondary text: a card where every second line is gold has no second
  // line. It is held to 4.5:1 because the one label it colours is small.
  const accentOnBlock = contrast(accent, P) >= 3 ? ensure(accent, P) : quiet;
  const subtext = quiet;

  // Library category cards: three depths of the brand, white text on all of
  // them, darkest first so the stack still reads as three distinct cards.
  const cat = (t: number) => ensure(mix(ink, '#000000', t), WHITE, 4.5);
  const finishing = cat(0), finishingDim = mix(finishing, '#000000', 0.35);

  const light: Record<string, string> = {
    '--app-brand-primary': P,
    '--app-brand-secondary': onP,
    '--app-brand-accent': accentOnBlock,

    '--md-sys-color-primary': ink,
    '--md-sys-color-on-primary': onColor(ink),
    // The selection ring on chips and tiles, and the filled segment. The kit
    // colour itself, unless it's too light to see on white: a ring needs 3:1.
    '--md-sys-color-secondary-container': ensure(P, PAGE_LIGHT, 3),
    '--md-sys-color-on-secondary-container': onColor(ensure(P, PAGE_LIGHT, 3)),
    '--md-sys-color-primary-container': mix(P, WHITE, 0.86),
    '--md-sys-color-on-primary-container': ensure(mix(P, '#000000', 0.5), mix(P, WHITE, 0.86), 7),

    '--app-on-surface-brand-variant': subtext,
    '--app-brand-track': mix(P, onP, 0.22),
    '--md-sys-color-inverse-on-surface': onP,
    '--app-inverse-on-surface-variant': quiet,
    '--app-inverse-outline-variant': mix(P, onP, 0.3),

    '--app-category-technical': cat(0.45),
    '--app-category-technical-dim': mix(cat(0.45), '#000000', 0.5),
    '--app-category-physical': cat(0.22),
    '--app-category-physical-dim': mix(cat(0.22), '#000000', 0.45),
    '--app-category-finishing': finishing,
    '--app-category-finishing-dim': finishingDim,
    '--app-on-category': WHITE,
    '--app-on-category-variant': ensure(mix(WHITE, finishing, 0.15), finishing),
  };

  // Dark: the emphasised thing is a light tint of the brand, with a deep shade
  // of it on top — the same swap the monochrome scheme makes with #E3E3E3.
  const tint = ensure(mix(P, WHITE, 0.55), PAGE_DARK, 7);
  const deep = ensure(mix(P, '#000000', 0.55), tint, 7);
  const dark: Record<string, string> = {
    '--md-sys-color-primary': tint,
    '--md-sys-color-on-primary': deep,
    '--md-sys-color-primary-container': mix(P, PAGE_DARK, 0.55),
    '--md-sys-color-on-primary-container': ensure(mix(P, WHITE, 0.8), mix(P, PAGE_DARK, 0.55), 7),
    '--md-sys-color-secondary-container': tint,
    '--md-sys-color-on-secondary-container': deep,
    '--md-sys-color-inverse-surface': tint,
    '--md-sys-color-inverse-on-surface': deep,
    '--md-sys-color-inverse-primary': deep,
    '--app-inverse-on-surface-variant': ensure(mix(deep, tint, 0.3), tint),
    '--app-inverse-outline-variant': mix(deep, tint, 0.5),
    '--app-brand-edge': mix(P, WHITE, 0.25),
  };

  return { light, dark };
}

const decls = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `${k}:${v};`).join('');

/**
 * The stylesheet. Selectors mirror globals.css exactly — same specificity,
 * later in the document — so each block overrides its counterpart and nothing
 * else. Light goes on bare :root, which the dark blocks still beat in dark mode.
 */
export function brandCss(primary: string, accent: string) {
  const { light, dark } = brandTokens(primary, accent);
  return `:root{${decls(light)}}`
    + `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${decls(dark)}}}`;
}
