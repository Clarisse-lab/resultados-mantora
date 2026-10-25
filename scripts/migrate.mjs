// Aplica as migrações pendentes de db/migrations. Roda antes de cada start (JS puro, sem build).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { ssl: local ? false : "require", max: 1, prepare: !url.includes(":6543"), onnotice: () => {} });
const pasta = path.join(process.cwd(), "db/migrations");

await sql`create table if not exists schema_migrations (nome text primary key, aplicada_em timestamptz not null default now())`;
const feitas = new Set((await sql`select nome from schema_migrations`).map((r) => r.nome));
for (const arquivo of (await readdir(pasta)).filter((f) => f.endsWith(".sql")).sort()) {
  if (feitas.has(arquivo)) continue;
  const conteudo = await readFile(path.join(pasta, arquivo), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(conteudo);
    await tx`insert into schema_migrations (nome) values (${arquivo})`;
  });
  console.log(`migração aplicada: ${arquivo}`);
}
await sql.end();
