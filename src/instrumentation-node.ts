// Sincroniza a Meta Ads de hora em hora dentro do próprio servidor (uma instância no Railway).
// Para usar um agendador externo, defina SYNC_INTERNO=0 e chame POST /api/cron/meta.
import { sincronizarTodas } from "./lib/integracoes/meta-ads";

if (process.env.NODE_ENV === "production" && process.env.SYNC_INTERNO !== "0" && process.env.DATABASE_URL) {
  const rodar = () =>
    sincronizarTodas(3)
      .then((r) => console.log("[meta] sincronização", JSON.stringify(r)))
      .catch((e) => console.error("[meta] falha na sincronização", e));
  setTimeout(rodar, 60_000);
  setInterval(rodar, 60 * 60_000);
}
