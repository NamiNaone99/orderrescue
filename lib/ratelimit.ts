import "server-only";
import { isIP } from "node:net";

type Clock = () => number;
const clock: Clock = () => Date.now();
const minute = 60_000;

export function clientIp(request: Request): string {
  // Vercel supplies the IP at its edge. A direct local Web Request has no trusted peer header.
  if (process.env.VERCEL !== "1") return "local";
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for"))?.trim();
  return ip && isIP(ip) ? ip : "unknown";
}

export class TokenBucket {
  private readonly fullAt = new Map<string, number>();
  private nextCleanup = 0;

  constructor(private readonly burst: number, private readonly refillMs: number, private readonly now: Clock = clock) {}

  take(ip: string): boolean {
    const time = this.now();
    if (time >= this.nextCleanup) {
      for (const [key, full] of this.fullAt) if (full <= time) this.fullAt.delete(key);
      this.nextCleanup = time + minute;
    }
    // Each consumed token adds one interval to the time when this bucket will be full.
    const nextFull = Math.max(time, this.fullAt.get(ip) ?? time) + this.refillMs;
    if (nextFull - time > this.burst * this.refillMs) return false;
    this.fullAt.set(ip, nextFull);
    return true;
  }
}

interface InterpretLimits { burst: number; refillMs: number; dailyCap: number }

export class InterpreterQuota {
  private readonly bucket: TokenBucket;
  private day = -Infinity;
  private calls = 0;

  constructor(private readonly limits: InterpretLimits, private readonly now: Clock = clock) {
    this.bucket = new TokenBucket(limits.burst, limits.refillMs, now);
  }

  forRequest(ip: string): () => boolean {
    let admitted = false;
    return () => {
      const utcDay = Math.floor(this.now() / 86_400_000);
      if (utcDay > this.day) {
        this.day = utcDay;
        this.calls = 0;
      }
      if (this.calls >= this.limits.dailyCap || (!admitted && !this.bucket.take(ip))) return false;
      admitted = true;
      this.calls++;
      return true;
    };
  }
}

const shared = globalThis as typeof globalThis & {
  orderRescueInterpretQuota?: { config: string; quota: InterpreterQuota };
  orderRescueHeroResets?: Map<string, number[]>;
  orderRescuePlanningBucket?: TokenBucket;
};

function configuredInt(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number(value);
  return value?.trim() && Number.isSafeInteger(parsed) && parsed >= min ? parsed : fallback;
}

export function getInterpreterQuota(): InterpreterQuota {
  const burst = configuredInt(process.env.INTERPRET_BURST, 30, 0);
  const refillMs = configuredInt(process.env.INTERPRET_REFILL_MS, 2000, 1);
  const dailyCap = configuredInt(process.env.INTERPRET_DAILY_CAP, 500, 0);
  const config = `${burst}/${refillMs}/${dailyCap}`;
  if (shared.orderRescueInterpretQuota?.config !== config) {
    shared.orderRescueInterpretQuota = { config, quota: new InterpreterQuota({ burst, refillMs, dailyCap }) };
  }
  return shared.orderRescueInterpretQuota.quota;
}

export function takePlanningRequest(request: Request): boolean {
  const bucket = shared.orderRescuePlanningBucket ??= new TokenBucket(20, 1000);
  return bucket.take(clientIp(request));
}

export function takeHeroReset(ip: string): boolean {
  const now = clock();
  const cutoff = now - minute;
  const resets = shared.orderRescueHeroResets ??= new Map<string, number[]>();
  // Reinserting on admission keeps IPs ordered by their last successful reset.
  for (const [key, times] of resets) {
    if (times[times.length - 1] > cutoff) break;
    resets.delete(key);
  }
  const recent = (resets.get(ip) ?? []).filter(time => time > cutoff);
  if (recent.length >= 6) return false;
  recent.push(now);
  resets.delete(ip);
  resets.set(ip, recent);
  return true;
}
