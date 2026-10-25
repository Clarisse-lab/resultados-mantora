// Next compila este arquivo também para o runtime Edge; o import condicional
// deixa o código de banco só no bundle Node (padrão recomendado na documentação do Next).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
