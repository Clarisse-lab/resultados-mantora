// Marca provisória até chegar o logo do Mantora.
export function Marca({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-lg bg-marca font-bold text-white"
        style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.5 }}
        aria-hidden
      >
        M
      </span>
      <span className="text-[17px] font-semibold tracking-tight">Mantora</span>
    </span>
  );
}
