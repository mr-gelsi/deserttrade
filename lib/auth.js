// Password hashing (PBKDF2-SHA256) and session tokens using Web Crypto,
// which is built into Cloudflare Workers.
const ITER = 100000; // Cloudflare's maximum for PBKDF2
const enc = new TextEncoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, ITER);
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const [, iter, salt, hash] = stored.split('$');
  const bits = await derive(password, unb64(salt), Number(iter));
  return safeEqual(b64(bits), hash);
}

export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function newToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function randInt(n) { // 0..n-1, unbiased
  const max = Math.floor(0x100000000 / n) * n;
  let x;
  do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= max);
  return x % n;
}
