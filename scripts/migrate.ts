import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "../src/lib/db";

const pasta = path.join(process.cwd(), "db/migrations");

await sql`create table if not exists schema_migrations (nome text primary key, aplicada_em timestamptz not null default now())`;
const feitas = new Set((await sql<{ nome: string }[]>`select nome from schema_migrations`).map((r) => r.nome));

for (const arquivo of (await readdir(pasta)).filter((f) => f.endsWith(".sql")).sort()) {
  if (feitas.has(arquivo)) continue;
  const conteudo = await readFile(path.join(pasta, arquivo), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(conteudo);
    await tx`insert into schema_migrations (nome) values (${arquivo})`;
  });
  console.log(`aplicada: ${arquivo}`);
}
console.log("migrações em dia");
await sql.end();
