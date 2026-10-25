"use client";

import { EyeOff, ExternalLink, Loader2, Maximize2, PlayCircle, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MENOR_MELHOR_TOP, type LinhaTop, type MetricasTop, type Nivel, type OrdemTop } from "@/lib/top-midias-tipos";
import type { Criativo } from "@/lib/integracoes/criativos";
import { fmtInteiro, fmtMoeda, fmtMultiplo, fmtPct, variacao } from "@/lib/formato";
import { Portal } from "./Portal";

const NIVEIS: { k: Nivel; rotulo: string; singular: string; artigo: string }[] = [
  { k: "campanha", rotulo: "Campanhas", singular: "Campanha", artigo: "na campanha" },
  { k: "conjunto", rotulo: "Conjuntos", singular: "Conjunto", artigo: "no conjunto" },
  { k: "anuncio", rotulo: "Anúncios", singular: "Anúncio", artigo: "" },
];

const METRICAS: { k: OrdemTop; rotulo: string; fmt: (v: number | null) => string }[] = [
  { k: "leads", rotulo: "Leads", fmt: fmtInteiro },
  { k: "vendas", rotulo: "Vendas", fmt: fmtInteiro },
  { k: "faturamento", rotulo: "Faturamento", fmt: fmtMoeda },
  { k: "investido", rotulo: "Investimento", fmt: fmtMoeda },
  { k: "cpl", rotulo: "CPL", fmt: fmtMoeda },
  { k: "cpa", rotulo: "CPA", fmt: fmtMoeda },
  { k: "roas", rotulo: "ROAS", fmt: fmtMultiplo },
  { k: "ctr", rotulo: "CTR", fmt: fmtPct },
  { k: "impressoes", rotulo: "Impressões", fmt: fmtInteiro },
  { k: "cliques", rotulo: "Cliques (mídia)", fmt: fmtInteiro },
];
const metrica = (k: OrdemTop) => METRICAS.find((m) => m.k === k)!;

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  ACTIVE: { rotulo: "Ativo", cor: "var(--sucesso)" },
  PAUSED: { rotulo: "Pausado", cor: "var(--alerta)" },
  CAMPAIGN_PAUSED: { rotulo: "Campanha pausada", cor: "var(--alerta)" },
  ADSET_PAUSED: { rotulo: "Conjunto pausado", cor: "var(--alerta)" },
  ARCHIVED: { rotulo: "Arquivado", cor: "var(--texto-3)" },
  DELETED: { rotulo: "Excluído", cor: "var(--texto-3)" },
  DISAPPROVED: { rotulo: "Reprovado", cor: "var(--perigo)" },
  WITH_ISSUES: { rotulo: "Com problemas", cor: "var(--perigo)" },
  IN_PROCESS: { rotulo: "Em análise", cor: "var(--texto-2)" },
  PENDING_REVIEW: { rotulo: "Em análise", cor: "var(--texto-2)" },
};

/** Variação contra o período anterior, já dizendo se é boa ou ruim para a métrica. */
function delta(k: OrdemTop, atual: number | null, antes: MetricasTop | null) {
  const v = variacao(atual, antes ? antes[k] : null);
  if (v == null) return null;
  const melhorou = MENOR_MELHOR_TOP.has(k) ? v < 0 : v > 0;
  return { v, melhorou, estavel: Math.abs(v) <= 0.05 };
}

function corBarra(l: LinhaTop, k: OrdemTop) {
  const d = delta(k, l[k], l.anterior);
  if (!d) return { cor: "var(--neutro-barra)", rotulo: "Sem base vs. período anterior" };
  if (d.estavel) return { cor: "var(--alerta)", rotulo: `Estável (${d.v >= 0 ? "+" : ""}${fmtPct(d.v)}) vs. período anterior` };
  return d.melhorou
    ? { cor: "var(--sucesso)", rotulo: `Melhorou (${d.v >= 0 ? "+" : ""}${fmtPct(d.v)}) vs. período anterior` }
    : { cor: "var(--perigo)", rotulo: `Piorou (${d.v >= 0 ? "+" : ""}${fmtPct(d.v)}) vs. período anterior` };
}

function Variacao({ k, l }: { k: OrdemTop; l: LinhaTop }) {
  const d = delta(k, l[k], l.anterior);
  if (!d) return <span className="w-16" />;
  return (
    <span className={`num w-16 text-right text-[11px] ${d.melhorou ? "text-sucesso" : "text-perigo"}`}>
      {d.v >= 0 ? "▲" : "▼"}
      {fmtPct(Math.abs(d.v))}
    </span>
  );
}

function Detalhes({ l, ordem }: { l: LinhaTop; ordem: OrdemTop }) {
  const grupos: OrdemTop[][] = [["leads", "investido", "faturamento"], ["cpl", "cpa", "roas", "ctr"], ["impressoes", "cliques"]];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg bg-superficie px-3 py-2">
        <span className="text-sm text-texto-2">{metrica(ordem).rotulo}</span>
        <span className="flex items-center gap-2">
          <span className="num font-semibold">{metrica(ordem).fmt(l[ordem])}</span>
          <Variacao k={ordem} l={l} />
        </span>
      </div>
      {grupos.map((g, i) => (
        <div key={i} className={`space-y-1 ${i ? "border-t border-borda pt-2" : ""}`}>
          {g
            .filter((k) => k !== ordem)
            .map((k) => (
              <div key={k} className="flex items-center justify-between gap-4 text-[12px]">
                <span className="text-texto-3">{metrica(k).rotulo}</span>
                <span className="flex items-center gap-2">
                  <span className="num">{metrica(k).fmt(l[k])}</span>
                  <Variacao k={k} l={l} />
                </span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

type Detalhe = { anuncio: Criativo | null; status: string | null; metricas?: LinhaTop | null; escolhidoPor?: OrdemTop | null; erro?: string };

type Props = { linhas: LinhaTop[]; nivel: Nivel; ordem: OrdemTop; limite: number; periodoAnterior: string; janela: string };

export function TopMidias({ linhas, nivel, ordem, limite, periodoAnterior, janela }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();
  const [selecionado, setSelecionado] = useState<string | null>(linhas[0]?.id ?? null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [semImagem, setSemImagem] = useState(false);

  const n = NIVEIS.find((x) => x.k === nivel)!;
  const sel = linhas.find((l) => l.id === selecionado) ?? null;

  useEffect(() => {
    setSelecionado(linhas[0]?.id ?? null);
  }, [linhas]);

  useEffect(() => {
    if (!selecionado) return setDetalhe(null);
    let cancelado = false;
    setCarregando(true);
    setSemImagem(false);
    const p = new URLSearchParams(busca.toString());
    p.set("nivel", nivel);
    p.set("id", selecionado);
    p.set("ordem", ordem);
    fetch(`/api/midia/detalhe?${p}`)
      .then(async (r) => (await r.json()) as Detalhe)
      .then((j) => !cancelado && setDetalhe(j))
      .catch(() => !cancelado && setDetalhe({ anuncio: null, status: null, erro: "Não foi possível carregar o anúncio." }))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [selecionado, nivel, ordem, busca]);

  function trocar(m: Record<string, string>) {
    const p = new URLSearchParams(busca.toString());
    for (const [k, v] of Object.entries(m)) p.set(k, v);
    router.push(`${caminho}?${p}#top-midias`, { scroll: false });
  }

  const max = Math.max(...linhas.map((l) => l[ordem] ?? 0), 0) || 1;
  const status = detalhe?.status ? STATUS[detalhe.status] ?? { rotulo: detalhe.status, cor: "var(--texto-3)" } : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="controle" value={nivel} onChange={(e) => trocar({ nivel: e.target.value })} aria-label="Nível">
          {NIVEIS.map((x) => (
            <option key={x.k} value={x.k}>
              Meta · {x.rotulo}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-texto-3">Classificar por</span>
        <select className="controle" value={ordem} onChange={(e) => trocar({ ordem: e.target.value })} aria-label="Classificar por">
          {METRICAS.map((m) => (
            <option key={m.k} value={m.k}>
              {m.rotulo}
            </option>
          ))}
        </select>
        <span className="text-xs text-texto-3">Top</span>
        <div className="flex rounded-lg border border-borda p-0.5">
          {[10, 20, 50].map((x) => (
            <button key={x} onClick={() => trocar({ top: String(x) })} className={`num rounded-md px-2.5 py-1.5 text-xs ${x === limite ? "bg-marca-suave text-texto" : "text-texto-3 hover:text-texto"}`}>
              {x}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-texto-3">
        Top {limite} {n.rotulo.toLowerCase()} por {metrica(ordem).rotulo.toLowerCase()}
        {MENOR_MELHOR_TOP.has(ordem) ? " (menor primeiro)" : ""} · cor = vs. período anterior ({periodoAnterior})
      </p>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-texto-3">
        {[["var(--sucesso)", "Melhorou"], ["var(--alerta)", "Estável (±5%)"], ["var(--perigo)", "Piorou"], ["var(--neutro-barra)", "Sem base"]].map(([c, r]) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
            {r}
          </span>
        ))}
      </div>

      {linhas.length === 0 ? (
        <p className="py-12 text-center text-sm text-texto-3">Nenhum item com {metrica(ordem).rotulo.toLowerCase()} no período.</p>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <ol className="rounded-xl border border-borda p-3" onMouseLeave={() => setSobre(null)}>
            {linhas.map((l, i) => {
              const b = corBarra(l, ordem);
              const v = l[ordem] ?? 0;
              const ativo = l.id === selecionado;
              return (
                <li key={l.id} className="relative">
                  <button
                    onClick={() => setSelecionado(l.id)}
                    onMouseEnter={() => setSobre(l.id)}
                    onFocus={() => setSobre(l.id)}
                    className={`grid w-full grid-cols-[1.5rem_minmax(0,16rem)_minmax(0,1fr)] items-center gap-3 rounded-lg px-2 py-2 text-left ${ativo ? "bg-marca-suave" : "hover:bg-superficie-2"}`}
                  >
                    <span className="num text-xs text-texto-3">{i + 1}</span>
                    <span className="truncate text-[13px] font-medium" title={l.nome}>
                      {l.nome}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-5 flex-1 overflow-hidden rounded bg-superficie-2">
                        <span className="block h-full rounded" style={{ width: `${Math.max((v / max) * 100, 1.5)}%`, background: b.cor, opacity: 0.85 }} />
                      </span>
                      <span className="num w-24 text-right text-[13px]">{metrica(ordem).fmt(l[ordem])}</span>
                    </span>
                  </button>
                  {sobre === l.id && (
                    <div className="pointer-events-none absolute left-1/3 top-full z-20 mt-1 hidden w-80 rounded-xl border border-borda-forte bg-superficie-2 p-3 shadow-2xl md:block">
                      <p className="mb-2 break-words text-sm font-semibold">{l.nome}</p>
                      <Detalhes l={l} ordem={ordem} />
                      <p className="mt-2 border-t border-borda pt-2 text-[11px] text-texto-3">
                        <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: b.cor }} />
                        Barra: {b.rotulo}
                      </p>
                      <p className="mt-1 text-[11px] text-marca">Clique para ver o anúncio</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {sel && (
            <aside className="rounded-xl border border-borda p-4" aria-label={`${n.singular} selecionado`}>
              <p className="rotulo">{n.singular} selecionad{nivel === "campanha" ? "a" : "o"}</p>
              <p className="mt-1 break-words text-sm font-semibold text-marca">{sel.nome}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-texto-3">
                {nivel !== "anuncio" && detalhe?.anuncio && (
                  <span>
                    Anúncio com mais {metrica(ordem).rotulo.toLowerCase()} {n.artigo}: <span className="text-texto-2">{detalhe.anuncio.nome}</span>
                  </span>
                )}
                {status && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-borda px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.cor }} />
                    {status.rotulo}
                  </span>
                )}
              </div>

              <div className="relative mt-3 aspect-[4/5] overflow-hidden rounded-lg border border-borda bg-superficie-2">
                {carregando ? (
                  <div className="grid h-full place-items-center text-xs text-texto-3">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Carregando a peça do anúncio…
                    </span>
                  </div>
                ) : detalhe?.erro ? (
                  <p className="grid h-full place-items-center p-4 text-center text-xs text-perigo">{detalhe.erro}</p>
                ) : detalhe?.anuncio?.imagem && !semImagem ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detalhe.anuncio.imagem}
                      alt={detalhe.anuncio.nome ?? "Criativo do anúncio"}
                      className="h-full w-full cursor-zoom-in object-cover"
                      onClick={() => setAmpliado(true)}
                      onError={() => setSemImagem(true)}
                    />
                    {detalhe.anuncio.video && <PlayCircle size={44} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/85 drop-shadow" />}
                    <div className="absolute inset-x-2 top-2 flex justify-between gap-2">
                      {detalhe.anuncio.link && (
                        <a href={detalhe.anuncio.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold tracking-wide text-white hover:bg-black/85">
                          VER ANÚNCIO <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    <button onClick={() => setAmpliado(true)} className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold tracking-wide text-white hover:bg-black/85">
                      <Maximize2 size={11} /> AMPLIAR
                    </button>
                  </>
                ) : (
                  <div className="grid h-full place-items-center p-4 text-center text-xs text-texto-3">
                    <span>
                      <EyeOff size={18} className="mx-auto mb-2" />
                      {semImagem ? "A imagem do criativo não carregou (o link da Meta pode ter expirado)." : "A Meta não devolveu imagem para este anúncio."}
                      {detalhe?.anuncio?.link && (
                        <a href={detalhe.anuncio.link} target="_blank" rel="noreferrer" className="mt-2 block text-marca underline">
                          Ver anúncio na Meta
                        </a>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <Detalhes l={sel} ordem={ordem} />
              </div>
              {(detalhe?.anuncio?.titulo || detalhe?.anuncio?.texto) && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-semibold tracking-wide text-texto-2">COPY DO ANÚNCIO</summary>
                  {detalhe.anuncio.titulo && <p className="mt-2 font-semibold">{detalhe.anuncio.titulo}</p>}
                  {detalhe.anuncio.texto && <p className="mt-1 whitespace-pre-line text-texto-2">{detalhe.anuncio.texto}</p>}
                </details>
              )}
            </aside>
          )}
        </div>
      )}

      {ampliado && sel && detalhe?.anuncio && (
        <ModalAnuncio
          item={sel}
          nivel={nivel}
          anuncio={detalhe.anuncio}
          metricasAnuncio={nivel === "anuncio" ? sel : detalhe.metricas ?? null}
          escolhidoPor={detalhe.escolhidoPor ?? null}
          janela={janela}
          onFechar={() => setAmpliado(false)}
        />
      )}
    </div>
  );
}

// Métricas que se somam: faz sentido mostrar quanto do total da campanha/conjunto veio do anúncio
const SOMAVEIS = new Set<OrdemTop>(["leads", "investido", "vendas", "faturamento", "impressoes", "cliques"]);
const ORDEM_TABELA: OrdemTop[] = ["leads", "investido", "vendas", "faturamento", "impressoes", "cliques", "cpl", "cpa", "roas", "ctr"];

function ModalAnuncio({
  item, nivel, anuncio, metricasAnuncio, escolhidoPor, janela, onFechar,
}: {
  item: LinhaTop;
  nivel: Nivel;
  anuncio: Criativo;
  metricasAnuncio: LinhaTop | null;
  escolhidoPor: OrdemTop | null;
  janela: string;
  onFechar: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  const grupo = nivel !== "anuncio";
  const n = NIVEIS.find((x) => x.k === nivel)!;
  const linhaInfo = (r: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-1 text-sm">
      <span className="rotulo !text-[11px]">{r}</span>
      <span className="break-words">{v}</span>
    </div>
  );
  return (
    <Portal>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onClick={onFechar} role="dialog" aria-label={`Detalhes de ${item.nome}`}>
        <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-borda-forte bg-superficie shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <header className="flex items-start justify-between gap-4 border-b border-borda px-5 py-4">
            <h3 className="break-words text-lg font-semibold">{item.nome}</h3>
            <button onClick={onFechar} aria-label="Fechar" className="text-texto-3 hover:text-texto">
              <X size={20} />
            </button>
          </header>
          <div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              {anuncio.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={anuncio.imagem} alt={anuncio.nome ?? "Criativo"} className="w-full rounded-xl border border-borda object-contain" />
              ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-xl border border-borda text-xs text-texto-3">Sem imagem</div>
              )}
              {(anuncio.titulo || anuncio.texto) && (
                <div className="mt-4">
                  <p className="rotulo !text-[11px]">Copy do anúncio</p>
                  {anuncio.titulo && <p className="mt-1 font-semibold">{anuncio.titulo}</p>}
                  {anuncio.texto && <p className="mt-1 whitespace-pre-line text-sm text-texto-2">{anuncio.texto}</p>}
                </div>
              )}
            </div>
            <div>
              {linhaInfo("Anúncio", <span className="num">{anuncio.id}</span>)}
              {grupo && escolhidoPor && linhaInfo("Escolhido por", `Mais ${metrica(escolhidoPor).rotulo.toLowerCase()} ${n.artigo}`)}
              {linhaInfo("Janela", janela)}
              <table className="tabela mt-4 w-full">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    {grupo && <th className="!text-right">{n.singular}</th>}
                    <th className="!text-right">Este anúncio</th>
                    {grupo && <th className="!text-right">% d{nivel === "campanha" ? "a" : "o"} {n.singular.toLowerCase()}</th>}
                  </tr>
                </thead>
                <tbody>
                  {ORDEM_TABELA.map((k) => {
                    const doAnuncio = grupo ? metricasAnuncio?.[k] ?? null : item[k];
                    const total = item[k];
                    const parte = grupo && SOMAVEIS.has(k) && total && doAnuncio != null ? doAnuncio / total : null;
                    return (
                      <tr key={k} className={k === escolhidoPor ? "font-semibold" : ""}>
                        <td>{metrica(k).rotulo}</td>
                        {grupo && <td className="num text-right">{metrica(k).fmt(total)}</td>}
                        <td className="num text-right">{metrica(k).fmt(doAnuncio)}</td>
                        {grupo && <td className="num text-right text-texto-2">{parte != null ? fmtPct(parte) : ""}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <footer className="flex flex-wrap gap-2 border-t border-borda px-5 py-3">
            {anuncio.link && (
              <a href={anuncio.link} target="_blank" rel="noreferrer" className="botao-sec text-[12px] font-semibold tracking-wide">
                VER ANÚNCIO <ExternalLink size={12} />
              </a>
            )}
            {anuncio.gerenciador && anuncio.gerenciador !== anuncio.link && (
              <a href={anuncio.gerenciador} target="_blank" rel="noreferrer" className="botao-sec text-[12px] font-semibold tracking-wide">
                ABRIR NO GERENCIADOR DA META <ExternalLink size={12} />
              </a>
            )}
          </footer>
        </div>
      </div>
    </Portal>
  );
}
