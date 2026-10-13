/**
 * Asking for the install sheet from somewhere other than the sheet.
 *
 * <InstallNudge /> owns the install: it holds Chrome's one-shot prompt event
 * and draws the iPhone Share-button steps. It opens by itself once, on the
 * third visit. Me's Account section offers it permanently, for anyone who
 * dismissed it or never got that far — and asks through here rather than
 * duplicating the sheet.
 */
export const INSTALL_ASK = 'forge:install';
const INSTALLABLE = 'forge:installable';

let installable = false;

/** Called by InstallNudge once it knows it can install on this device. */
export function announceInstallable(): void {
  installable = true;
  window.dispatchEvent(new Event(INSTALLABLE));
}

/** Whether to offer it, and a way to hear if that changes — Chrome's prompt
 *  event can arrive after the page has rendered. */
export function watchInstallable(cb: (yes: boolean) => void): () => void {
  cb(installable);
  const on = () => cb(true);
  window.addEventListener(INSTALLABLE, on);
  return () => window.removeEventListener(INSTALLABLE, on);
}

export function askToInstall(): void {
  window.dispatchEvent(new Event(INSTALL_ASK));
}
