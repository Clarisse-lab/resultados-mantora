# Mantora — Resultados

Painel de marketing e vendas dos clientes Mantora. Junta, por cliente:

- **vendas** da Hotmart, Kiwify e PagTrust (webhooks), incluindo reembolsos, chargebacks e carrinhos abandonados;
- **mídia paga** da Meta Ads (investimento, impressões, cliques e page views por anúncio e por dia);
- **leads** dos formulários de captura;

e mostra KPIs, funil, investimento × faturamento × ROAS, mapa por estado e cidade, ranking de
campanhas, conjuntos e anúncios, e a tabela de vendas com exportação CSV.

A equipe Mantora vê todos os clientes. Cada cliente entra com o próprio login e vê só os seus dados.

A engenharia reversa do painel de referência está em [`docs/engenharia-reversa`](docs/engenharia-reversa/README.md).

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Recharts · Postgres (`postgres.js`) · login próprio (bcrypt + JWT em cookie).

## Rodar localmente

```bash
cp .env.example .env          # ajuste DATABASE_URL, SESSION_SECRET e CRON_SECRET
npm install
npm run db:migrate
npm run db:seed               # opcional: cliente de demonstração com 60 dias de dados fictícios
npm run dev
```

Login da demonstração: `equipe@mantora.local` / `mantora123` (só existe se você rodar o seed).

Para criar o primeiro usuário real da equipe:

```bash
npm run usuario:criar -- voce@mantora.com "Seu Nome" "uma-senha-forte" equipe
```

Testes: `npm test` · checagem de tipos: `npm run lint`.

## Deploy no Railway

1. Crie um projeto com **Postgres** e um serviço apontando para este repositório.
2. No serviço do app, defina as variáveis:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `SESSION_SECRET` = um valor longo e aleatório (`openssl rand -hex 32`)
   - `CRON_SECRET` = outro valor aleatório
3. Gere um domínio público para o serviço (Settings → Networking).
4. O `railway.json` cuida do resto: build, migrações a cada deploy e checagem de saúde em `/api/saude`.
5. Crie o primeiro usuário da equipe com `railway run npm run usuario:criar -- ...`.

A sincronização da Meta roda **de hora em hora dentro do próprio app**. Para usar um agendador
externo, defina `SYNC_INTERNO=0` e chame:

```bash
curl -X POST https://SEU-DOMINIO/api/cron/meta -H "Authorization: Bearer $CRON_SECRET"
```

## Conectar um cliente

Em **Clientes e integrações → (cliente)**:

| Integração | O que fazer |
|---|---|
| **Kiwify** | Adicione a integração, copie a URL e cadastre em Kiwify → Apps → Webhooks. Marque compra aprovada, reembolso, chargeback e carrinho abandonado. Cole o token do webhook no campo de segredo. |
| **Hotmart** | Adicione, copie a URL e cadastre em Ferramentas → Webhook, versão 2.0.0, com os eventos de compra e o abandono de carrinho. Cole o hottok no campo de segredo. |
| **PagTrust** | Adicione e cadastre a URL como webhook de vendas. Confira o primeiro evento em "Últimos eventos recebidos": o adaptador ainda precisa ser validado com uma venda real. |
| **Meta Ads** | Informe o ID da conta de anúncio e um token com `ads_read` (de preferência de um usuário do sistema do Business Manager). Clique em "Sincronizar agora" para trazer 90 dias de histórico. |
| **Captura de leads** | Faça o formulário da página enviar um POST para a URL com `nome`, `email`, `telefone`, `pagina` (a URL com as UTMs) e, se houver, `utm_*` e `ctwaclid`. |

### Padrão de UTMs nos anúncios

Para cada venda casar com a campanha, o conjunto e o anúncio certos, use nos anúncios da Meta:

```
utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}
```

As UTMs precisam chegar ao checkout. Na Kiwify elas passam direto. Na Hotmart, só os parâmetros
`src` e `sck` são repassados, então coloque a query de UTMs inteira no `src`, por exemplo via script na página de vendas.

### Perpétuo × Lançamento

Em "Dados do cliente", liste as palavras que identificam campanhas de lançamento (ex.: `lanc_`).
Campanhas cujo nome contém alguma delas entram no recorte "Lançamento"; o resto é "Perpétuo".

## Estrutura

```
db/migrations/           esquema do banco (SQL puro)
scripts/                 migração, seed e criação de usuário
src/lib/atribuicao.ts    UTMs → campanha/conjunto/anúncio, categoria, origem, UF pelo DDD
src/lib/integracoes/     conversores de webhook, ingestão, leads e Meta Ads
src/lib/metricas.ts      consultas da visão geral (KPIs, funil, série, mapa, top mídias, metas)
src/app/api/             webhooks, captura, cron, login, CSV
src/app/(painel)/        telas: visão geral, vendas detalhadas, admin
```

## Cores

As cores da marca ficam no topo de `src/app/globals.css` (`--marca`, `--marca-2`, fundos e textos).
Elas são provisórias até a definição da paleta do Mantora.
