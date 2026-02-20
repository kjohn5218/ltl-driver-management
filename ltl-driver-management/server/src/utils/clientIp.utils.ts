import { Request } from 'express';

/**
 * Trusted Proxy Configuration
 * Per SECURITY_STANDARDS.md §7.2: X-Forwarded-For is only trusted if client IP is a known trusted proxy/LB
 *
 * Configure via TRUSTED_PROXIES env var (comma-separated CIDR ranges or IPs)
 * Examples:
 *   - TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
 *   - TRUSTED_PROXIES=172.16.0.0/12,192.168.0.0/16
 */

// Parse CIDR notation into base IP and mask
interface CIDRRange {
  base: number;
  mask: number;
}

const parseCIDR = (cidr: string): CIDRRange | null => {
  const parts = cidr.trim().split('/');
  const ip = parts[0];
  const maskBits = parts[1] ? parseInt(parts[1], 10) : 32;

  const ipParts = ip.split('.');
  if (ipParts.length !== 4) return null;

  const ipNum = ipParts.reduce((acc, octet) => {
    const num = parseInt(octet, 10);
    if (isNaN(num) || num < 0 || num > 255) return NaN;
    return (acc << 8) + num;
  }, 0);

  if (isNaN(ipNum)) return null;

  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;

  return { base: (ipNum & mask) >>> 0, mask };
};

const ipToNumber = (ip: string): number | null => {
  // Handle IPv6-mapped IPv4 (::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  const num = parts.reduce((acc, octet) => {
    const n = parseInt(octet, 10);
    if (isNaN(n) || n < 0 || n > 255) return NaN;
    return (acc << 8) + n;
  }, 0);

  return isNaN(num) ? null : num >>> 0;
};

// Parse trusted proxies from environment
const parseTrustedProxies = (): CIDRRange[] => {
  const envValue = process.env.TRUSTED_PROXIES || '';

  // Default trusted proxies: localhost and common private ranges
  // In production, set TRUSTED_PROXIES explicitly to your load balancer IPs
  const defaults = ['127.0.0.1/32', '::1/128'];

  const proxies = envValue
    ? envValue.split(',').map(p => p.trim()).filter(Boolean)
    : defaults;

  return proxies
    .map(parseCIDR)
    .filter((p): p is CIDRRange => p !== null);
};

// Cache parsed trusted proxies
let trustedProxiesCache: CIDRRange[] | null = null;

const getTrustedProxies = (): CIDRRange[] => {
  if (!trustedProxiesCache) {
    trustedProxiesCache = parseTrustedProxies();
  }
  return trustedProxiesCache;
};

/**
 * Check if an IP address is a trusted proxy
 */
export const isTrustedProxy = (ip: string | undefined): boolean => {
  if (!ip) return false;

  const ipNum = ipToNumber(ip);
  if (ipNum === null) return false;

  const trustedProxies = getTrustedProxies();

  return trustedProxies.some(range => {
    return (ipNum & range.mask) >>> 0 === range.base;
  });
};

/**
 * Get the real client IP address
 * Only trusts X-Forwarded-For if the direct connection is from a trusted proxy
 *
 * Per SECURITY_STANDARDS.md §7.2
 */
export const getClientIp = (req: Request): string => {
  const directIp = req.socket.remoteAddress || 'unknown';

  // Only trust X-Forwarded-For if connection is from trusted proxy
  if (isTrustedProxy(directIp)) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can be comma-separated list: client, proxy1, proxy2
      // The first IP is the original client
      const clientIp = (typeof forwarded === 'string' ? forwarded : forwarded[0])
        .split(',')[0]
        .trim();
      if (clientIp) {
        return clientIp;
      }
    }
  }

  // Not from trusted proxy or no X-Forwarded-For - use direct connection IP
  return directIp;
};

/**
 * Get client identity for rate limiting and security tracking
 * Uses authenticated user ID if available, otherwise client IP
 */
export const getClientIdentity = (req: Request): string => {
  // Check for authenticated user (set by auth middleware)
  const user = (req as any).user;
  if (user?.id) {
    return `user:${user.id}`;
  }

  // Fall back to IP-based identity
  return `ip:${getClientIp(req)}`;
};

// Allow cache reset for testing
export const resetTrustedProxiesCache = (): void => {
  trustedProxiesCache = null;
};
