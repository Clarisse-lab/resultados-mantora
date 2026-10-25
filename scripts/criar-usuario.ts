// Uso: npm run usuario:criar -- email@x.com "Nome" senha equipe|cliente [slug-do-cliente]
import bcrypt from "bcryptjs";
import { sql } from "../src/lib/db";

const [email, nome, senha, papel = "equipe", slug] = process.argv.slice(2);
if (!email || !senha || !["equipe", "cliente"].includes(papel)) {
  console.error('uso: npm run usuario:criar -- email "Nome" senha equipe|cliente [slug-do-cliente]');
  process.exit(1);
}
const hash = await bcrypt.hash(senha, 10);
const [u] = await sql<{ id: string }[]>`
  insert into usuarios (email, nome, senha_hash, papel) values (${email.toLowerCase()}, ${nome}, ${hash}, ${papel})
  on conflict (email) do update set nome = excluded.nome, senha_hash = excluded.senha_hash, papel = excluded.papel, ativo = true
  returning id`;
if (slug) {
  await sql`insert into usuarios_clientes (usuario_id, cliente_id) select ${u.id}, id from clientes where slug = ${slug} on conflict do nothing`;
}
console.log(`usuário ${email} (${papel}) pronto`);
await sql.end();
