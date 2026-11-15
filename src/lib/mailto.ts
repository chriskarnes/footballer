/**
 * An address for a mailto: link. The address is typed by whoever filled in
 * a form, and `?`, `&` and the like in it would add fields of their choosing
 * (a bcc, say) to the draft an admin opens: those are escaped, the rest left
 * as mail apps expect it.
 */
export const mailtoAddr = (email: string) => email.trim().replace(/[^A-Za-z0-9@._+\-]/g, (c) => encodeURIComponent(c));
