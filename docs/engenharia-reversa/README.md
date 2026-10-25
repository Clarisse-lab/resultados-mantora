# Engenharia reversa — arquiteto-do-corpo.vercel.app/visao-geral

Levantamento feito em 2026-10-25 só com o que o site serve publicamente
(HTML, CSS, JS, `manifest.json` e APIs abertas).

## Limitação principal

`/visao-geral` exige login. Sem sessão, o servidor responde
`307 → /login?callbackUrl=%2Fvisao-geral`. O conteúdo do painel (KPIs, gráficos,
dados) é renderizado no servidor e os chunks JS dessa rota só são entregues
depois do login. Por isso **o layout e os números do painel não foram
capturados**. O que segue é a estrutura, a stack e o design system, que vêm no
CSS e no JS globais.

## Produto

| Campo | Valor |
|---|---|
| Nome | **Hosaka — Painel** (`application-name: hosaka-painel`) |
| Descrição | "Dashboard de marketing + comercial do funil perpétuo da Hosaka." |
| Idioma | `pt-BR` |
| PWA | `manifest.json`, `start_url: /visao-geral`, `display: standalone`, cor `#0a1422` |
| Tema | escuro por padrão (`<html class="dark" data-theme="dark">`), com tema claro (`[data-theme=light]`) |

## Stack (inferida dos bundles)

- **Next.js App Router** com **Turbopack** (`/_next/static/immutable/chunks/*`, RSC), hospedado na Vercel.
- **Tailwind CSS v4** (processado por lightningcss, tokens `--color-*`, `@theme`).
- **Recharts**: classes `recharts-wrapper`, `recharts-bar-rectangle`, `recharts-label-list`.
- **react-simple-maps**: `rsm-geography`, `[data-geo-modo]` (mapa por região), com filtro `regiao-filtro`.
- **TanStack Query** ("No mutationFn found").
- **Sonner** para toasts ("Close toast").
- Fontes via `next/font`: **Hanken Grotesk** (corpo), **Spectral** (display/serifada), **JetBrains Mono** (números, `.numeric-display` com `tabular-nums slashed-zero`).
- CSP com nonce, `X-Frame-Options: DENY`, HSTS.

## Rotas e APIs encontradas

| Rota | Observação |
|---|---|
| `/visao-geral` | painel principal (protegido) |
| `/login` | e-mail + senha, `POST /api/auth/login` `{email, password}` |
| `/signup` | "Primeiro acesso? Criar conta →" |
| `/esqueci-senha` | recuperação de senha |
| `/setup` | "Configurar primeiro admin →", aparece se `GET /api/setup` → `setup_available: true` |
| `GET /api/auth/session` | sem login: `{"user":null,"permissoes":{"ascensao":false,"jornada":false,"paginas":[]},"mock":false}` |

Autenticação própria (não é NextAuth: `/api/auth/providers` dá 404). A sessão
traz **permissões por página** e duas flags de módulo, `ascensao` e
`jornada`, o que sugere seções do painel com esses nomes. O campo `mock`
indica um modo de dados fictícios.

Mensagens do login: "E-mail ou senha inválidos.", "Muitas tentativas. Aguarde
um instante e tente de novo." (429), "Login indisponível neste ambiente." (503),
"Falha de conexão. Tente novamente.", botão "Entrar" / "Entrando…".

## Pistas do conteúdo do painel (a partir do CSS global)

O Tailwind gera um CSS único com tudo o que o app usa, então os tokens revelam
os componentes do painel mesmo sem acesso à rota:

- **Funil**: `--funnel-flow-1..5`, `--funnel-edge-1..3`, `--funnel-pool-*`,
  `--funnel-drop`, ou seja, um funil desenhado em SVG com 5 etapas e "vazamento" entre elas.
- **Origem do tráfego**: `--data-pago`, `--data-organico`, `--data-conversacional`
  (pago / orgânico / conversacional).
- **Jornada**: `--jornada-1..5` e um efeito de vidro, uma jornada em 5 estágios.
- **Gráficos**: paleta `--chart-1..8` (dourado, petróleo, verde, roxo, âmbar, rosa, cinza, azul).
- **KPIs**: `--gradient-kpi-card` e `.numeric-display`.
- **Mapa** por região com filtro (`.regiao-filtro`, `.rsm-geography`).
- Barras com rótulos animados (`[data-rotulos-barra]`, `@keyframes rotulos-pousam`).
- Drawers e modais (`sheet-in-left/right`, `modal-in`, `.overlay-scrim--drawer`),
  esqueleto de carregamento (`.skeleton-shimmer`), slider dourado (`.range-gold`).

## Design system

Arquivo completo em [`tokens.css`](./tokens.css), com os temas escuro e claro e
as classes de componente.

Resumo:

| Token | Escuro | Claro |
|---|---|---|
| `--bg-base` | `#0a1422` | `#f6f3eb` |
| `--bg-surface` | `#0f1d2e` | `#fbf9f3` |
| `--bg-elevated` | `#17273a` | `#fff` |
| `--gold` | `#cda659` | `#8c6b2e` |
| `--gold-light` | `#e6cb8c` | `#5e4a24` |
| `--gold-dark` | `#bf8f42` | `#6f5320` |
| `--danger` | `#d88a7f` | `#ac453a` |
| `--info` | `#72a9db` | `#2c68a5` |

Estética: navy profundo e dourado metálico, com vidro (backdrop-blur), um fundo
em camadas (`.cnv-bg`: brilho, grade de 64px, pontos, vinheta e granulação),
botão com borda em `conic-gradient` girando (`.btn-glow`, `@property --hsk-angle`)
e logo em SVG desenhado traço a traço (`stroke-dashoffset`), respeitando
`prefers-reduced-motion`.

## Próximos passos para capturar o painel

1. Credenciais de um usuário de teste (com permissão de `jornada`/`ascensao`), ou
2. "Salvar página como → completa" de `/visao-geral` logado, mais prints, ou
3. Acesso ao repositório de origem.
