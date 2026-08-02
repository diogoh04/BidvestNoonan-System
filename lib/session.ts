import type { AppRole } from "./types";

const encoder = new TextEncoder();

export type SessionPayload = {
  userId: string;
  role: AppRole;
  staffId: string | null;
  exp: number;
};

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(str: string) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

export async function createSessionToken(user: {
  userId: string;
  role: AppRole;
  staffId: string | null;
}): Promise<string> {
  const secret = process.env.AUTH_SECRET!;
  const key = await getKey(secret);
  const payload: SessionPayload = { ...user, exp: Date.now() + THIRTY_DAYS_MS };
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64url(sig)}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  const secret = process.env.AUTH_SECRET!;
  const key = await getKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const expectedSigB64 = base64url(expectedSig);
  if (expectedSigB64 !== sigB64) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    // Tokens antigos (formato { exp } sem userId/role) devem ser tratados
    // como inválidos — força relogin no dia da troca do esquema de auth.
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
