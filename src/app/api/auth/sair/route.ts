import { COOKIE_SESSAO } from "@/lib/sessao-token";
import { redirecionar } from "@/lib/redirecionar";

export async function POST() {
  const res = redirecionar("/login");
  res.cookies.delete(COOKIE_SESSAO);
  return res;
}
