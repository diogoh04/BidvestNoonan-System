// Códigos de país conhecidos que já podem vir salvos no telefone (Irlanda,
// Brasil, Reino Unido — os países vistos nos dados reais de staff).
const KNOWN_COUNTRY_CODES = ["353", "55", "44"];

// Gera o link do WhatsApp (wa.me) a partir de um telefone salvo em qualquer
// formato (com espaços, traços, parênteses, com ou sem código de país).
export function toWhatsAppHref(telefone: string | null | undefined): string | null {
  if (!telefone || !telefone.trim()) return null;

  let digits = telefone.replace(/\D/g, "");
  if (!digits) return null;

  // "00" é o prefixo internacional alternativo ao "+" (ex.: 0055..., 00353...).
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  const hasKnownCountryCode = KNOWN_COUNTRY_CODES.some((code) => digits.startsWith(code));

  // Sem código de país reconhecível e com o tamanho de um número local
  // (DDD + número) — assume Brasil, funciona pra qualquer DDD.
  if (!hasKnownCountryCode && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }

  return `https://wa.me/${digits}`;
}
