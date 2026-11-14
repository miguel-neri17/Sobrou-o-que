# Sistema visual: Sobrou o Quê?

Este documento descreve o visual **como ele é hoje**, a partir do `style.css`, com os contrastes **medidos**. Para quem usa o app e o que ele quer fazer, veja o [PRODUCT.md](PRODUCT.md). O `tests/design.test.js` confere que todo token citado aqui existe no CSS e que as regras de contraste e de movimento continuam valendo.

## 1. Identidade (o que não muda)

- **Verde** `--brand` (`#1F6F5C`): estrutura, botões principais, gastos.
- **Laranja** `--sobra` (`#F2A541`): **só** para "o que sobrou". É o que faz o valor se destacar.
- **Vermelho** `--danger` / `--danger-text`: gastos que passaram da renda, orçamento estourado, erros.
- **Chonburi** (`--display`, serifada): só no valor que sobrou, nos títulos de página e no nome do site. Nunca em rótulo, tabela ou dado.
- **IBM Plex Sans** (`--font`): todo o resto.
- Modo **claro e escuro** automáticos (`prefers-color-scheme`), com o escuro também forçável por `data-theme="dark"`.

## 2. Cor

| Papel | Token | Claro | Escuro |
|---|---|---|---|
| Marca, botão principal | `--brand` | `#1F6F5C` | `#277462` |
| Texto sobre a marca | `--on-brand` | `#FFFFFF` | `#FFFFFF` |
| Texto de apoio sobre a marca | `--on-brand-2` | `#CFE5DD` | `#DDEDE7` |
| Verde usado como texto | `--brand-text` | `#1A634F` | `#6CCDB2` |
| O que sobrou | `--sobra` | `#F2A541` | `#F2A541` |
| Fundo da página | `--bg` | `#F2F4F3` | `#0E1311` |
| Cartões e campos | `--surface` | `#FFFFFF` | `#151D1A` |
| Camada secundária | `--soft` | `#EAEFEC` | `#1E2824` |
| Divisórias decorativas | `--line` | `#D8DFDB` | `#2B3732` |
| Borda de campos e botões | `--field-line` | `#818A86` | `#68736F` |
| Texto | `--fg` | `#18211E` | `#E8EEEB` |
| Texto secundário | `--muted` | `#56625D` | `#9AA7A1` |
| Perigo | `--danger` | `#C23B3B` | `#C23B3B` |
| Perigo como texto | `--danger-text` | `#A82E2E` | `#FF9A9A` |
| Barra que bateu a meta | `--bar` | `#1F6F5C` | `#3FA88E` |
| Barra abaixo da meta | `--bar-low` | `#708E85` | `#5B766F` |
| Fundo branco da logo | `--tile` | `#FFFFFF` | `#FFFFFF` |
| Película atrás de menu e diálogo | `--scrim` | `rgba(10,20,17,.5)` | igual |

**Categorias de gasto** (família do verde, para o laranja da sobra se destacar): `--c-alimentacao`, `--c-transporte`, `--c-lazer`, `--c-assinaturas`, `--c-estudos`, `--c-outros`, e `--c-sobra` (o laranja). Elas **sempre vêm com legenda e valor em texto**, porque algumas ficam abaixo de 3:1 contra o cartão no tema claro (assinaturas 2,1:1, outros 2,9:1). Nunca use a cor de categoria sozinha para transmitir informação.

**Regra:** nenhuma cor escrita direto numa regra do CSS. Tudo vem de um token (o teste confere).

### Contraste medido (WCAG 2.2)

| Par | Claro | Escuro | Mínimo |
|---|---|---|---|
| `--fg` sobre `--bg` | 14,9:1 | 16,0:1 | 4,5 |
| `--muted` sobre `--surface` | 6,4:1 | 6,9:1 | 4,5 |
| `--muted` sobre `--soft` | 5,5:1 | 6,1:1 | 4,5 |
| `--brand-text` sobre `--surface` | 7,1:1 | 9,0:1 | 4,5 |
| `--danger-text` sobre `--surface` | 6,8:1 | 8,5:1 | 4,5 |
| `--on-brand` sobre `--brand` | 6,0:1 | 5,6:1 | 4,5 |
| `--on-brand-2` sobre `--brand` | 4,6:1 | 4,6:1 | 4,5 |
| `--field-line` sobre `--bg` | 3,2:1 | 3,8:1 | 3 (componentes) |
| `--field-line` sobre `--surface` | 3,6:1 | 3,5:1 | 3 |
| `--brand` sobre `--surface` | 6,0:1 | 3,1:1 | 3 |
| `--bar-low` sobre `--soft` | 3,1:1 | 3,1:1 | 3 |

O teste confere 14 pares de texto (mínimo 4,5:1) e 7 pares de componentes (mínimo 3:1) nos dois temas. Antes deste sistema, a borda dos campos tinha 1,8:1 e o botão verde no escuro 2,85:1: ambos abaixo do mínimo.

## 3. Tipografia

Tamanhos fixos em px, com o corpo em 15 px (`font:var(--t-base)/1.55`).

| Token | px | Uso |
|---|---|---|
| `--t-xs` | 12 | Rótulos de gráfico |
| `--t-sm` | 13 | Dicas, tabelas compactas, rótulos das abas |
| `--t-md` | 14 | Rótulos de campo, texto secundário |
| `--t-base` | 15 | Corpo do texto, botões |
| `--t-lg` | 16 | Títulos de cartão |
| `--t-xl` | 20 | Botões de passo (− e +) |
| `--t-2xl` | 26 | Valores de destaque nos cartões |
| `--t-3xl` | 28 | Título de página (celular) |
| `--t-4xl` | 34 | Título de página (computador) |

O valor que sobrou usa `clamp(44px,13vw,84px)` na Chonburi e é ajustado por script (`fitAmount`) para sempre caber em uma linha. Números usam `font-variant-numeric: tabular-nums`. Títulos usam `text-wrap: balance` e parágrafos `text-wrap: pretty`.

## 4. Espaçamento e raio

Escala de 4: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40.

Raios: `--r-xs` 3 (marcadores), `--r-sm` 4 (colunas), `--r-ctl` 6 (botões e campos), `--r` 8 (cartões), `--r-xl` 18 e `--r-2xl` 40 (a logo na tela de entrada).

Camadas: `--z-tabs` 30, `--z-scrim` 40, `--z-side` 50, `--z-dialog` 60.

## 5. Movimento

**Quem manda, em ordem:** a preferência "reduzir movimento" do sistema da pessoa; o briefing do projeto; as regras de produto abaixo; e só então o gosto de quem implementa.

| Token | ms | Uso |
|---|---|---|
| `--dur-fade` | 150 | Entrada de cada tela (um desvanecer único) |
| `--dur-fast` | 160 | Hover e toque em botões, abas e links |
| `--dur-base` | 220 | Película do menu, seta dos blocos recolhíveis |
| `--dur-drawer` | 260 | Gaveta do menu lateral |
| `--dur-slow` | 320 | Barras de estudo e de orçamento |
| `--dur-reveal` | 700 | Abertura da barra da renda, ao entrar |

Curvas: `--ease-out` (saída suave, padrão) e `--ease-drawer` (a gaveta).

- **Um** momento de destaque: o valor que conta de zero até o saldo (800 ms, em JavaScript), uma vez por entrada.
- Toda tela entra com **um desvanecer de 150 ms** (`fade`), e não com cascata de cartões.
- Movimento comunica estado, nunca decora. Os gráficos da Análise não animam.
- `prefers-reduced-motion: reduce` **zera todas as transições** (regra em `*`), desliga o desvanecer e a abertura da barra da renda, e a contagem do valor também é pulada. O teste confere cada uma dessas regras.
- Toda duração vem de um token `--dur-*`: nada de "160ms" solto.

## 6. Componentes e estados

| Componente | Classe | Estados que existem hoje |
|---|---|---|
| Botão principal | `.btn` | normal, hover (só com mouse), pressionado, foco |
| Botão secundário | `.btn.alt` | idem, com borda `--field-line` |
| Botão pequeno | `.btn.sm`, `.rm` | idem; sobe para 44 px em aparelhos de toque |
| Campo de texto e seleção | `.f input`, `.f select` | normal, foco (borda e anel), somente leitura |
| Cartão | `.card` | estático; `.tip` é a variante de apoio |
| Lista | `.list` | uma linha por item, divisória fina |
| Tabela de lançamentos | `.tbl` | vira bloco por linha no celular (esconde o cabeçalho) |
| Tabela de dados | `.dtab` | mantém o cabeçalho no celular (Análise e prévia do extrato) |
| Barra de progresso | `.bar` | animada ao mudar |
| Barra da renda | `.rbar` | um trecho por categoria; `.reveal` na entrada |
| Barras de estudo | `.col` | sólida = bateu a meta; **listrada** = abaixo da meta |
| Gráficos | `.an-svg` | SVG, sempre com tabela ou texto equivalente |
| Abas (celular) / links (computador) | `.tabs`, `.topnav` | normal, atual (`aria-current`), foco |
| Faixa de exemplo | `.demo-bar` | visível só na conta de exemplo |

**Estados que ainda faltam** (vão para os próximos PRs): estado *carregando* e *erro* padronizados nos botões e campos; *desabilitado* só existe em alguns botões; estados vazios existem, mas cada tela escreve o seu.

## 7. Acessibilidade

- **Foco:** anel de 2 px em `--brand-text` com deslocamento de 2 px (`:focus-visible`). Campos trocam a borda e ganham um anel suave.
- **Alvos de toque:** em aparelhos de toque (`pointer: coarse`), botões pequenos, passo, mês anterior/próximo e "Ocultar valores" têm 44 px. Os links soltos têm área de toque de 38 px, e as caixas de marcar têm 24 px (o mínimo do WCAG 2.5.8).
- **Nunca só cor:** barras abaixo da meta são listradas; a diferença entre meses é escrita ("a mais", "a menos"); categorias têm legenda com valor.
- **Rótulos:** todo campo tem `label`; todo botão só de ícone tem nome; títulos em ordem.
- **Gráficos:** SVG com `role="img"` e descrição, mais tabela ou texto equivalente.
- Medido em 5 larguras (320, 360, 390, 768 e 1280): **zero rolagem lateral**, zero campo sem rótulo, zero botão sem nome, zero id duplicado.

## 8. Superfícies do navegador

Caixas de marcar e botões nativos usam `accent-color` na cor da marca; o cursor de texto usa `caret-color`; a barra de rolagem usa `scrollbar-color`; a seleção de texto tem `::selection` tingida de verde; e `color-scheme` é declarado nos dois temas, para os controles nativos nascerem no tema certo.

## 9. Como verificar

```bash
npm run test:design     # contraste, movimento, tokens e este documento em dia com o CSS
npm run test:all        # tudo, incluindo o navegador real
```

Para conferir a olho: `npm run screenshots -- <rotulo> <largura> <altura> [light|dark] exemplo`, em 360, 390, 768 e 1280 px, nos dois temas.

Para **provar** que uma mudança de CSS não alterou o que não devia, use a regressão visual: ela tira retratos de 6 telas (celular e computador, claro e escuro) e compara dois conjuntos byte a byte. Uma refatoração tem de dar 100% iguais; uma mudança de design mostra exatamente quais telas mudaram.

```bash
npm run visual -- capturar antes       # antes de mexer
npm run visual -- capturar depois      # depois
npm run visual -- comparar antes depois
```

As capturas usam a fonte de reserva do sistema (sem o Google Fonts) para ficarem determinísticas. **Limite conhecido:** a Análise no computador claro às vezes oscila sozinha, sem nenhuma mudança de código. Uma diferença isolada nessa tela deve ser confirmada recapturando; várias telas diferentes ao mesmo tempo indicam mudança real.

## 10. Dívida visual conhecida

O que este sistema **ainda não** resolve, e para onde vai:

- **Valores fora da escala de espaçamento:** 14 px (12 usos), 28 px (3), 18 px (3), 22 px (2), 5 px (2), 9 px (2), 36 px, 58 px e 7 px (1 cada). Ficam como estão até as telas serem redesenhadas, para a troca não mudar o que já está bom.
- **Tamanhos de texto fora da escala:** 14,5 px, 19 px, 22 px e os tamanhos de exibição da tela de entrada.
- **Finanças** tem cerca de 6.100 px no celular (os botões de 44 px dos lançamentos pesam nisso): lançamentos recolhidos em "ver todos" e seções recolhíveis.
- **Cartões demais, todos com o mesmo peso:** o Início e a Finanças vão ganhar hierarquia.
- **Prévia do extrato:** é um painel sobre a página sem foco preso nem `Esc` para fechar; deve virar um diálogo acessível.
- **Faixa de exemplo** não fica fixa no topo.
- **Gráficos da Análise:** composição em duas colunas no computador e paleta validada para daltonismo.
- Atributos `style="--i:N"` nos cartões do `index.html` já não têm efeito (eram da cascata de entrada) e saem quando o HTML for reestruturado.
