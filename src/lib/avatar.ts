/** What a profile photo may be, and how big once the browser has shrunk it. */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 300 * 1024;
/** The square, in pixels, a photo is cropped and scaled to before upload. */
export const AVATAR_SIZE = 256;

/** The address of the signed-in player's photo; a new upload is a new address. */
export const avatarSrc = (updatedAt: string | null | undefined) =>
  updatedAt ? `/me/avatar?v=${encodeURIComponent(updatedAt)}` : null;
