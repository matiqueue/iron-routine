import { ensureSchema, getSql } from './db.js';
import { jsonResponse } from './cloudStore.js';

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for') || '';
  const firstIp = xff.split(',')[0]?.trim();
  if (firstIp) return firstIp.slice(0, 64);
  const realIp = (request.headers.get('x-real-ip') || '').trim();
  if (realIp) return realIp.slice(0, 64);
  return 'unknown';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Atomic PostgreSQL fixed-window rate limiter backed by Neon (`api_rate_limits`).
 * Fails open on transient DB errors so legitimate traffic is never blocked by infra hiccups.
 */
export async function checkRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = params;
  const nowSec = Math.floor(Date.now() / 1000);
  const windowBucket = Math.floor(nowSec / windowSeconds);
  const bucketKey = `${key}:${windowBucket}`.slice(0, 160);
  const retryAfterSeconds = Math.max(1, (windowBucket + 1) * windowSeconds - nowSec);
  const expiresAtIso = new Date((windowBucket + 1) * windowSeconds * 1000).toISOString();

  try {
    await ensureSchema();
    const sql = getSql();
    const rows: any[] = await sql`
      INSERT INTO api_rate_limits (bucket_key, count, expires_at)
      VALUES (${bucketKey}, 1, ${expiresAtIso}::timestamptz)
      ON CONFLICT (bucket_key) DO UPDATE SET
        count = api_rate_limits.count + 1
      RETURNING count
    `;
    const count = Number(rows[0]?.count || 1);

    // Opportunistic low-overhead cleanup of expired windows (~2% of calls)
    if (Math.random() < 0.02) {
      sql`DELETE FROM api_rate_limits WHERE expires_at < NOW()`.catch(() => {});
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds,
    };
  } catch {
    return {
      allowed: true,
      remaining: limit,
      retryAfterSeconds: 0,
    };
  }
}

export function rateLimitedResponse(retryAfterSeconds: number): Response {
  const base = jsonResponse(
    {
      ok: false,
      error: 'RATE_LIMITED',
      message: 'Zbyt wiele zapytań. Spróbuj ponownie za chwilę.',
      retryAfterSeconds,
    },
    429
  );
  const headers = new Headers(base.headers);
  headers.set('Retry-After', String(Math.max(1, retryAfterSeconds)));
  return new Response(base.body, { status: 429, headers });
}
