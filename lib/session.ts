const encoder = new TextEncoder();

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

// Achei a causa provável do Team Leader não acha
// o prédio dele não é bug de query, é estrutural. O payload da sessão
// só guarda { exp }, sem nenhum identificador de QUEM logou (login é uma
// senha única compartilhada, não por pessoa). Ou seja: o sistema não tem
// como saber "quem está usando o app agora" é por isso não dá pra montar
// um "meu prédio" automático hoje.
//
// Duas formas de resolver, pra você escolher:
//   1) Login por pessoa (cada staff com usuário/senha próprio) vai resolve
//      de vez, mas é mudança grande na autenticação inteira.
//   2) Atalho mais simples: depois que a pessoa acha a própria página de
//      team-leader uma vez, salvar o ID dela num cookie/localStorage do
//      navegador, e nas próximas visitas redirecionar direto pra lá. Não
//      é "seguro" de verdade (qualquer um no mesmo navegador veria o
//      mesmo atalho), mas remove a fricção sem mexer no resto do sistema.
//
// A query em app/api/team-leaders/[id]/route.ts já está certa, não
// precisa mexer nela o gargalo é só "quem é o usuário atual".
export async function createSessionToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET!;
  const key = await getKey(secret);
  const payload = JSON.stringify({ exp: Date.now() + THIRTY_DAYS_MS });
  const payloadB64 = base64url(encoder.encode(payload));
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64url(sig)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;

  const secret = process.env.AUTH_SECRET!;
  const key = await getKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const expectedSigB64 = base64url(expectedSig);
  if (expectedSigB64 !== sigB64) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}
