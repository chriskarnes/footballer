import { isHex, type Hex } from './brand-colors';

/**
 * Branding is opt-in. With no row, or a row an admin has reset, the app is the
 * monochrome Train.futbol in globals.css and nothing here runs — unbranded is
 * the default, not a palette.
 *
 * A palette is two colours. `primary` is the kit: the brand block, the filled
 * button, the selected chip. `accent` is the trim: subtext and the progress
 * fill on the brand block. Every other tone is derived in brand-colors.ts.
 */
export type Palette = { id: string; name: string; note: string; primary: Hex; accent: Hex };

export const PALETTES: Palette[] = [
  { id: 'royal',     name: 'Royal & Gold',     note: 'Royal blue with a gold trim',      primary: '#1D4ED8', accent: '#FACC15' },
  { id: 'crimson',   name: 'Crimson',          note: 'Home red, white numbers',          primary: '#B91C1C', accent: '#FFFFFF' },
  { id: 'pitch',     name: 'Pitch',            note: 'Grass green with a lime flash',    primary: '#166534', accent: '#BEF264' },
  { id: 'midnight',  name: 'Midnight & Gold',  note: 'Navy and old gold',                primary: '#0B1F44', accent: '#E0B33A' },
  { id: 'claret',    name: 'Claret & Sky',     note: 'Deep claret, sky-blue sleeves',    primary: '#6E1A37', accent: '#8EC5EC' },
  { id: 'tangerine', name: 'Tangerine',        note: 'Bright orange, black detail',      primary: '#EA580C', accent: '#111111' },
  { id: 'celeste',   name: 'Celeste',          note: 'Sky blue and navy',                primary: '#6CACE4', accent: '#0B1F44' },
  { id: 'onyx',      name: 'Black & Gold',     note: 'Black kit, gold crest',            primary: '#111111', accent: '#F2B705' },
];

/** What the app reads. `logo` is a URL, versioned so a new upload busts caches. */
export type Branding = {
  name: string | null;        // replaces the Train.futbol wordmark when set
  primary: Hex | null;        // both or neither
  accent: Hex | null;
  paletteId: string | null;   // null when the colours were picked by hand
  logo: string | null;
};

export type BrandingRow = {
  enabled: boolean;
  name: string | null;
  palette_id: string | null;
  primary_color: string | null;
  accent_color: string | null;
  logo_type: string | null;
  updated_at: string;
};

export function toBranding(row: BrandingRow | null): Branding | null {
  if (!row?.enabled) return null;
  // A logo with no colours is still a brand; it just keeps the monochrome scheme.
  const colours = isHex(row.primary_color) && isHex(row.accent_color);
  return {
    name: row.name?.trim() || null,
    primary: colours ? row.primary_color as Hex : null,
    accent: colours ? row.accent_color as Hex : null,
    paletteId: row.palette_id,
    logo: row.logo_type ? `/brand/logo?v=${encodeURIComponent(row.updated_at)}` : null,
  };
}

export const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
/** Stored in the row, so it is kept small: a logo, not a photograph. */
export const LOGO_MAX_BYTES = 512 * 1024;
