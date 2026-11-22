/**
 * The privacy policy and terms: when they last changed, and how to reach
 * whoever runs the platform. The address comes from NEXT_PUBLIC_CONTACT_EMAIL
 * so it's set once, where the app is deployed; with none set the pages give
 * the postal address only, rather than print an inbox nobody reads.
 */
export const LEGAL_UPDATED = 'November 22, 2026';
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '').trim() || null;

/** Where to write by post. */
export const POSTAL_ADDRESS = ['Train.futbol', '4387 W Swamp Rd', 'Doylestown, PA 18902'];
