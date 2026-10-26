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
  // Números com cara de data (epoch em s ou ms): mostra só ano e mês
  if (typeof v === "number" && v > 1e9 && v < 1e13) {
    const d = new Date(v < 1e12 ? v * 1000 : v);
    return `data:${d.toISOString().slice(0, 7)}`;
  }
  return typeof v;
}
