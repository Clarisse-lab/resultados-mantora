// Linha de indicadores simples (sem comparação com período anterior).
export function Indicadores({ itens }: { itens: { rotulo: string; valor: string; detalhe?: string }[] }) {
  return (
    <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {itens.map((i) => (
        <div key={i.rotulo} className="cartao p-4">
          <p className="rotulo">{i.rotulo}</p>
          <p className="num mt-2 text-[22px] font-semibold leading-tight">{i.valor}</p>
          {i.detalhe && <p className="mt-1 text-[11px] text-texto-3">{i.detalhe}</p>}
        </div>
      ))}
    </section>
  );
}
