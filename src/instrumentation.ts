// Sincroniza a Meta Ads de hora em hora dentro do próprio servidor (uma instância no Railway).
// Para usar um agendador externo, defina SYNC_INTERNO=0 e chame POST /api/cron/meta.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SYNC_INTERNO === "0" || !process.env.DATABASE_URL) return;
  if (process.env.NODE_ENV !== "production") return;
  const { sincronizarTodas } = await import("./lib/integracoes/meta-ads");
  const rodar = () =>
    sincronizarTodas(3)
      .then((r) => console.log("[meta] sincronização", JSON.stringify(r)))
      .catch((e) => console.error("[meta] falha na sincronização", e));
  setTimeout(rodar, 60_000);
  setInterval(rodar, 60 * 60_000);
}
