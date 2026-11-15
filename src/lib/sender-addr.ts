/**
 * The part of an address that stands for one sender, for limits.
 *
 * An IPv4 address is one sender. An IPv6 one isn't: a home or a phone is
 * handed a whole /64 (millions of addresses) and can use a new one for every
 * request, so the limit goes on the /64. Anything unreadable is kept as it
 * is, so it still counts against itself.
 */
export function addrKey(ip: string): string {
  const raw = ip.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (!raw.includes(':')) return raw;
  // IPv4 written as IPv6 (::ffff:1.2.3.4) is that IPv4 address.
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const [head, tail = ''] = raw.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  if (raw.includes('::')) {
    const fill = 8 - left.length - right.length;
    if (fill < 0) return raw;
    left.push(...Array(fill).fill('0'), ...right);
  }
  if (left.length !== 8 || left.some((h) => !/^[0-9a-f]{1,4}$/.test(h))) return raw;
  return `${left.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
