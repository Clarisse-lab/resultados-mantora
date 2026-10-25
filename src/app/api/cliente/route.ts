import { COOKIE_CLIENTE, podeVerCliente, sessaoAtual } from "@/lib/auth";
import { redirecionar } from "@/lib/redirecionar";

// Troca o cliente que está sendo visto (seletor no topo e lista de clientes).
export async function POST(req: Request) {
  const s = await sessaoAtual();
  const form = await req.formData();
  const id = String(form.get("cliente") ?? "");
  const res = redirecionar(String(form.get("volta") ?? "/visao-geral"));
  if (s && (await podeVerCliente(s, id))) {
    res.cookies.set(COOKIE_CLIENTE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
