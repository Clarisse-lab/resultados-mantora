import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
}

function conectar() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    max: 5,
    // numeric chega como string; convertemos para number (valores monetários cabem com folga)
    types: { numeric: { to: 1700, from: [1700], serialize: String, parse: Number } },
    // Supabase em modo pooler (porta 6543) não aceita prepared statements
    prepare: !url.includes(":6543"),
  });
}

const obter = () => globalThis.__sql ?? (globalThis.__sql = conectar());

// Uma conexão por processo, criada no primeiro uso (o build roda sem DATABASE_URL);
// em dev o hot reload reaproveita a mesma.
export const sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply: (_alvo, _this, args) => (obter() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_alvo, prop) => {
    const real = obter() as unknown as Record<PropertyKey, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
