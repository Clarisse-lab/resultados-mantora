// Descreve a forma de um payload sem revelar os valores (para log): nomes de campo e tipos.
export function estrutura(v: unknown, prof = 0): unknown {
  if (prof > 6) return "…";
  if (v === null) return "null";
  if (Array.isArray(v)) return v.length ? [estrutura(v[0], prof + 1), `(${v.length} itens)`] : [];
  if (typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, estrutura(x, prof + 1)]));
  }
  if (typeof v === "string") {
    if (/^[^@\s]+@[^@\s]+$/.test(v)) return "texto:email";
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "texto:data";
    if (/^[\d\s().+-]{8,}$/.test(v)) return `texto:dígitos(${v.replace(/\D/g, "").length})`;
    if (/^-?\d+([.,]\d+)?$/.test(v)) return "texto:número";
    return `texto(${v.length})`;
  }
  return typeof v;
}
