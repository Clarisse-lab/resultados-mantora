# Engenharia reversa — Hosaka Painel (arquiteto-do-corpo.vercel.app)

Levantamento de 2026-10-25. Fontes usadas:

- o que o site serve publicamente (HTML de login, CSS, `manifest.json`, `/api/auth/session`);
- duas páginas salvas logadas (`/visao-geral` e `/comercial`) e 5 prints;
- os 32 arquivos JS do app, baixados pelos nomes que aparecem nas páginas salvas.

Os chunks das rotas **LTV Ascensão**, **Gerenciador**, **Lançamentos** e **Admin**
não vieram nas páginas salvas. O que está descrito sobre elas vem dos prints, do
menu e de textos que aparecem em código compartilhado.

> Nenhum dado de cliente (nomes, telefones) foi copiado para este repositório.

---

## 1. O que é

Painel de **marketing + comercial de um infoproduto/serviço vendido em funil
perpétuo** (com suporte a **lançamentos**). Ele junta três mundos que normalmente
ficam separados:

1. **Mídia paga**: investimento, cliques, page views e criativos da Meta Ads (e Google Ads).
2. **Captação e vendas**: cadastros (leads), checkouts e vendas aprovadas, com UTM de entrada.
3. **Comercial**: um CRM em Kanban para SDRs (leads, agendamento, call, checkout, venda)
   e uma fila de **ascensão** (upsell e recompra) com score.

A pergunta que ele responde: *"quanto investi, quanto voltou, por onde o cliente
entrou e onde o funil está vazando?"*

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js (App Router, RSC) com Turbopack, na Vercel |
| UI | React, Tailwind CSS v4, design system próprio (vidro, navy e dourado) |
| Dados no cliente | TanStack Query (`queryKey: ["overview", filtros]` etc.) |
| Gráficos | Recharts (barras e linha com eixo duplo, sparklines nos KPIs) |
| Mapa | react-simple-maps (UFs do Brasil, clique detalha as cidades) |
| Toasts | Sonner |
| Datas | date-fns (locale pt-BR) |
| Auth | própria: `POST /api/auth/login` com cookie de sessão e permissões por página |
| Extras | PWA instalável, **push de "Nova venda"** (Web Push/VAPID), paleta de comandos (Ctrl+K), tema claro/escuro |
| Feature flags | `NEXT_PUBLIC_ASCENSAO_VISIVEL`, `NEXT_PUBLIC_LANCAMENTOS_VISIVEIS`, `NEXT_PUBLIC_PAGINAS_POR_USUARIO`, `NEXT_PUBLIC_PARTICAO_CONTEXTO_VISIVEL`, `NEXT_PUBLIC_TOPICOS_VISIVEIS`, `NEXT_PUBLIC_VISAO_LANCAMENTO_VISIVEL` |

## 3. Mapa de telas

```
PAINEL
├─ Dashboard
│  ├─ Visão geral          /visao-geral
│  ├─ Vendas detalhadas    /visao-geral?aba=vendas
│  └─ Lançamentos          /visao-geral?recorte=lancamento  (flag)
├─ Comercial
│  ├─ Kanban               /comercial
│  └─ LTV Ascensão         /comercial/ascensao?visao=fila|tabela
├─ Gerenciador             /gerenciador   (Perpétuo | Lançamentos)
└─ Admin                   /admin
   ├─ Usuários             /admin/usuarios
   ├─ Integrações          /admin/integracoes
   ├─ Metas                /admin/metas?secao=kpi
   ├─ Filtros (origens)    /admin/origens
   └─ Redirect             /admin/redirect
Conta /conta · Login /login · Cadastro /signup · Esqueci senha /esqueci-senha · Setup /setup
```

O menu lateral é recolhível (botão "Recolher") e mostra o e-mail do usuário, "Conta" e "Sair".

### Barra superior (todas as páginas)

- **Período**: Hoje, Ontem, Últimos 7 / 30 / 90 / 180 dias, mais um calendário de intervalo. O padrão é 7 dias.
- **Filtros** (gaveta): categoria de origem, plataforma, **funil** e **tópicos** (até 16
  dimensões livres, passadas na URL como `t_<tópico>=<valor>`). O botão mostra quantos filtros estão ativos.
- **"Atualizado há X minutos"**, botão **Sincronizar** (`/api/sync-status`), sino de
  notificações e alternância de tema.
- Na página: **Metas** (editar a meta do mês por KPI) e **Alargar** (largura total, Esc volta).

Todo o estado de filtro fica **na URL** (`from`, `to`, `granularidade=dia|semana|mes`,
`categoria`, `plataforma`, `recorte=unificada|perpetuo|lancamento`, `funil`,
`lancamento`, `t_*`), então qualquer visão pode ser compartilhada por link.

### Recortes: Unificada, Perpétuo e Lançamento

O mesmo dado pode ser visto em três "contextos":

- **Perpétuo**: só as campanhas cujo nome casa com as **palavras-chave do perpétuo**
  (configuradas em Admin → Metas).
- **Lançamento**: as campanhas de cada lançamento (cada edição tem janela e status:
  `captacao`, `cpl`, `carrinho`, `encerrado`).
- **Unificada**: tudo junto.

Duas salvaguardas aparecem na tela:
- *"Investimento fora dos filtros de contexto"*: gasto em campanhas que não casam com
  nenhum filtro. O painel lista as campanhas e manda ajustar as palavras-chave.
- No recorte Lançamento, os cards **Leads**, **Custo por lead** e **Conv. lead → compra** somem,
  porque não dá para saber de que lado um cadastro veio.

## 4. Visão geral (`/visao-geral`)

Fonte: `GET /api/overview?<filtros>` →
`{ kpis[], serie[], funil[], funilPorContexto, porGeo, semGeo, spendNaoAtribuido, filtroConfigurado, leadsParticionaveis, recorte, mock }`
e `GET /api/admin/metas`.

### 4.1 KPIs

9 cards possíveis: 3 aparecem por padrão e o resto fica em "Mais detalhes (+6)".
O usuário pode esconder, reordenar e **salvar modelos de visualização** (botão "Métricas").

| key | Rótulo | Fórmula (inferida) |
|---|---|---|
| `faturamento` | Faturamento | soma das vendas aprovadas |
| `vendas` | Vendas | nº de vendas aprovadas |
| `roas` | ROAS | faturamento ÷ investido (ex.: 2,71×) |
| `ticketMedio` | Ticket médio | faturamento ÷ vendas |
| `custoPorVenda` | Custo por venda | investido ÷ vendas |
| `custoPorLead` | Custo por lead | investido ÷ leads |
| `leads` | Leads | cadastros no período |
| `checkouts` | Checkouts | checkouts iniciados |
| `investido` | Investido | gasto em mídia (Meta/Google) |

Faturamento, Vendas, Leads e Investido têm **sparkline** da série diária. Com meta
cadastrada para o mês, o card mostra uma barra de progresso contra a meta,
proporcional ao período escolhido.

### 4.2 Funil · Unificada

Funil em SVG (taça dourada) com 5 etapas e a conversão de cada uma em relação à anterior:

```
Cliques (mídia) → Page views (mídia) → Cadastros → Checkouts → Vendas
  35.903            5.639  15,7%        869  15,4%   109  12,5%  60  55,0%
```

### 4.3 Investimento, faturamento e ROAS

Gráfico combinado: barras de **Investimento** (cinza) e **Faturamento** (dourado) em R$
por dia, mais a linha do **ROAS** no eixo direito. Segue a granularidade (dia/semana/mês).

### 4.4 Distribuição geográfica

Mapa do Brasil por UF, com métrica escolhível (Faturamento, Vendas, Leads, Investido)
e escala de cor do mínimo ao máximo. Clicar num estado detalha as **cidades**; também há o botão "Ver estados" (lista).
Rodapé: *"N leads e N vendas sem estado do Brasil identificado — fora do mapa, mas dentro do total dos cards."*

### 4.5 Top mídias

Ranking de **Campanhas, Conjuntos ou Anúncios** (filtro por origem: Todos, Meta, Google, Orgânico),
**ordenado por** Leads, Vendas, Faturamento, Investido etc., mostrando o Top 10, 20 ou 50.
A cor de cada barra compara com o **período anterior de mesmo tamanho**: Melhorou, Estável (±5%),
Piorou ou Sem base. Clicar abre o **painel do anúncio**, com imagem do criativo, copy,
métricas (CTR, CPM, CPC, CPL, CPPV, CPCO) e o link "Abrir no gerenciador da Meta".
Fontes: `/api/top-midia-periodo`, `/api/ads/:id`.

## 5. Vendas detalhadas (`/visao-geral?aba=vendas`)

Fonte: `GET /api/vendas-detalhadas`. Tabela com busca, **colunas que dá para mostrar, esconder,
reordenar e redimensionar**, ordenação e exportação **CSV**. Acima da tabela vai um resumo por
funil (Lançamento, Lançamento › Renovação, Perpétuo, Perpétuo › Renovação, sem funil).

Colunas: Data, Cliente, Telefone, Valor, Produto, Status (`approved`…), Possui Ctwaclid,
Origem (ex.: "Meta Ads", "Bio Instagram orgânico", "Stories Instagram orgânico", "Não definido"),
Categoria (`pago`, `organico`, `nao-definido`), Página de origem, Campanha, Conjunto, Anúncio,
Funil, Contexto, Cidade/UF, UTMs (source/medium/campaign/content/term/id e `ad_id` **de entrada**).

A atribuição usa a **UTM de entrada** (o primeiro toque do lead), e o **ctwaclid**
(click-id dos anúncios Click-to-WhatsApp) marca as vendas que vieram de conversa no WhatsApp.

## 6. Comercial: Kanban (`/comercial`)

Fonte: `GET /api/comercial`, `/api/leads`, `/api/sdrs`, `/api/admin/pipeline-stages`.

- KPIs: Leads, Checkouts, Vendas (+3).
- **Pipeline comercial** com colunas **Lead → Agendamento → Call realizada → Checkout → Venda**.
  - **Lead**, **Checkout** e **Venda** são etapas *estruturais*: vêm do dado real e não podem ser excluídas.
  - O admin pode criar etapas intermediárias ("Gerenciar etapas", até 16).
  - Cada coluna mostra o total, a conversão em relação à anterior e o valor em R$.
- **Card do lead**: nome, campanha/anúncio de entrada, telefone, origem (Meta Ads, orgânico...),
  selo **CTWA**, **SDR** responsável, data. Abre um detalhe com as **respostas do WhatsApp Flow**
  (formulário de qualificação) e o histórico.
- Ações: **Novo lead** manual (telefone obrigatório, sem duplicar), mover entre etapas
  (arrastar ou setas; só admin), busca, CSV.
- **Motivo de perda**: Sem orçamento, Sem perfil, Comprou concorrente, Adiou a decisão,
  Sem retorno / sumiu, Outro. Alimenta o relatório "Motivos de perda" do BI.

## 7. LTV Ascensão (`/comercial/ascensao`)

Carteira de **clientes que já compraram**, para vender de novo (renovação ou upgrade).

- KPIs: Clientes únicos, Receita histórica, LTV médio (+6).
- Visões **Quadro** (Kanban) e **Tabela**.
- **Fila de entrada por ordem de score**: colunas **Prioridade alta**, **Prioridade média**,
  **Prioridade baixa** e **Revisar**. Os cards vão sendo arrastados para as etapas de abordagem.
- Card: nome, **score** (0–100), LTV em R$, nº de compras, "última compra há N dias",
  **faixa de renda** (vinda da anamnese), responsável e "Nunca houve interação".
- A coluna "Revisar" reúne quem não tem renda conhecida: a anamnese não chegou ou chegou sem
  essa resposta. Ali o score é **só transacional** (LTV, compras e recência), ou seja, um
  modelo **RFM** com bônus de renda declarada.

## 8. Gerenciador e Lançamentos

- **Gerenciador** (Perpétuo | Lançamentos): visão estilo gerenciador de anúncios, com
  campanhas, conjuntos e anúncios, status (Ativo, Pausado, Arquivado, Excluído),
  investimento, CPL, CPL alvo e CPLs no ar.
- **Lançamentos**: cada edição tem fases (Captação, CPL, Carrinho aberto, Encerrado),
  **marcos** desenhados nos gráficos, leads e faturamento acumulados e um
  **comparativo entre edições** (`/api/lancamentos/comparativo`).

## 9. Admin

- **Usuários**: convites, papéis e **páginas permitidas por usuário**
  (`permissoes: { paginas[], jornada, ascensao }`).
- **Integrações**: contas de anúncio (Meta/Google) e fonte de vendas, com status de coleta
  (Atualizado, Desatualizado, Sem coleta, Falha na coleta, Sem sinal).
- **Metas**: metas mensais por KPI (Faturamento, Vendas, Leads...), palavras-chave do
  perpétuo e configuração de lançamentos.
- **Filtros/Origens**: catálogo de categorias e subcategorias de origem
  (ex.: Pago › Meta Ads; Orgânico › Bio Instagram, Stories…; Conversacional).
- **Redirect**: links rastreáveis (`/r/...`) que gravam a origem antes de mandar para a página.

## 10. APIs internas

```
POST /api/auth/login  · POST /api/auth/logout · GET /api/auth/session
GET  /api/setup       · GET  /api/sync-status · GET /api/catalogo
GET  /api/overview    · GET  /api/vendas-detalhadas · GET /api/sales-feed
GET  /api/top-midia-periodo · GET /api/ads/:id
GET  /api/comercial   · GET|POST|PATCH /api/leads · GET /api/sdrs
GET  /api/comercial/lead-por-aluno
GET|PUT /api/admin/metas · /api/admin/pipeline-stages · /api/admin/lancamentos
GET  /api/lancamentos · /api/lancamentos/{top-midia,detalhe,comparativo}
POST /api/push/{subscribe,unsubscribe} · GET|PUT /api/prefs/:chave
```

## 11. Modelo de dados provável

```
usuarios(id, email, senha_hash, papel, paginas[], jornada, ascensao)
contas_anuncio(id, plataforma[meta|google], ...)
midia_diaria(data, plataforma, campanha_id, conjunto_id, anuncio_id, nomes…, investido, impressoes, cliques, page_views)
leads(id, criado_em, nome, telefone, email, cidade, uf, utm_*_entrada, ad_id_entrada, ctwaclid, pagina_origem, origem, categoria, etapa, sdr_id, motivo_perda, respostas_flow jsonb)
checkouts(id, lead_id?, criado_em, produto, valor)
vendas(id, criado_em, cliente, telefone, produto, valor, status, funil, contexto, origem, categoria, utm_*, ctwaclid, lancamento_id)
lancamentos(id, nome, status, janela_de, janela_ate, palavras_chave, marcos jsonb)
metas(mes, kpi, valor, contexto)
pipeline_etapas(id, chave, rotulo, ordem, estrutural)
clientes_ascensao(view: cliente, ltv, compras, ultima_compra, faixa_renda, score, prioridade, responsavel)
prefs(usuario_id, chave, valor jsonb)   -- colunas, modelos de visualização, KPIs ocultos
push_subscriptions(usuario_id, endpoint, keys)
```

## 12. Design system

Os tokens completos estão em [`tokens.css`](./tokens.css) (temas escuro e claro e as classes
de componente). Base: navy `#0a1422` / `#0f1d2e` / `#17273a`, dourado `#cda659`
(claro `#e6cb8c`, escuro `#bf8f42`). Títulos em **Spectral** (serifada), texto em
**Hanken Grotesk** e números em **JetBrains Mono** com `tabular-nums`. Rótulos dos KPIs
ficam em caixa alta com espaçamento largo. Cards de vidro com borda dourada sutil e fundo
com grade de 64px, pontos e vinheta.
