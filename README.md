# Sobrou o Quê?

[![Testes](https://github.com/miguel-neri17/Sobrou-o-que/actions/workflows/ci.yml/badge.svg)](https://github.com/miguel-neri17/Sobrou-o-que/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-1F6F5C.svg)](LICENSE)

**Demonstração:** https://miguel-neri17.github.io/Sobrou-o-que/ (na tela de entrada, use **Ver com dados de exemplo**)

> **In English:** a personal dashboard for students to track monthly income and spending, study hours and grades, and to simulate savings. It is a static site (plain HTML, CSS and JavaScript, no build step, no server) that keeps each user's data in the browser. The home screen answers the question in the name — *what's left over?* — with the amount that remained, or what was missing when spending passed income. It also imports bank statements (CSV), repeats fixed expenses, tracks a budget per category, compares months, and ships with a simulated student so anyone can try it without typing anything. Passwords are hashed (PBKDF2), JSON backup/import is validated, the layout is mobile-first with dark mode, and the tests run in jsdom and in a real browser.

Painel pessoal para estudantes: anote o que **entra e sai**, as **horas de estudo** e as **notas**, e veja de relance **o que sobrou** no mês.

<p align="center">
  <img src="docs/screenshots/inicio-celular.png" width="260" alt="Tela inicial no celular: valor que sobrou em destaque e a barra da renda por categoria">
  <img src="docs/screenshots/inicio-negativo-celular.png" width="260" alt="Quando os gastos passam da renda, a tela mostra quanto faltou">
  <img src="docs/screenshots/inicio-escuro-celular.png" width="260" alt="Tela inicial no modo escuro">
</p>

## Como experimentar

- **Sem instalar nada:** abra a [demonstração](https://miguel-neri17.github.io/Sobrou-o-que/) e clique em **Ver com dados de exemplo**. Você entra, sem senha, como um estudante simulado com 12 meses de dados. O que você mudar nele some ao sair.
- **Como aplicativo (instalar e usar sem internet):** na demonstração, o navegador oferece **Instalar** (Chrome e Edge) ou **Adicionar à tela inicial** (Safari). Depois da primeira visita o app abre sem internet. Isso só funciona pelo endereço do site: abrir o `index.html` com duplo clique não instala nada. **Cuidado:** os dados ficam no armazenamento do navegador, e o app instalado pode ter um armazenamento separado do site aberto numa aba (no iPhone isso é o normal). Para levar os dados de um para o outro, use **Exportar** e **Importar**.
- **No seu computador:** baixe o repositório e abra o `index.html` com duplo clique. Não precisa de servidor nem de instalação.

## O que o app faz

- **Início:** o valor que sobrou no mês é o protagonista. Se os gastos passam da renda, vira "Faltou…" em vermelho. Abaixo, a **barra da renda** (um trecho por categoria e um laranja para o que sobrou) e observações, como "o orçamento de Lazer passou em R$ X".
- **Finanças:**
  - renda do mês e gastos por categoria (adicionar, **editar** e **remover**);
  - **importar extrato do banco em CSV**, com uma tela de revisão antes de salvar: detecta separador, acentos, valores (`R$ 1.234,56`, `-12,50`, `(45,00)`) e datas, avisa o que é duplicado ou inválido, e reimportar o mesmo extrato não duplica nada. **A categoria de cada gasto é sugerida pela descrição** (por palavras-chave como "UBER" ou "NETFLIX" e, antes disso, pelo que você já corrigiu em importações anteriores); você troca a categoria de qualquer linha antes de importar, e o que trocar fica lembrado neste navegador (dá para esquecer tudo na própria tela). O que não é reconhecido fica em "Outros";
  - **gastos fixos**: marque "Repetir todo mês" ao registrar um gasto e lance todos de uma vez em cada mês, sem digitar de novo;
  - **orçamento por categoria**: um limite mensal por categoria, com aviso ao chegar perto (80%) e ao passar.
- **Estudos:** horas por semana e por dia da semana (as horas somam, e dá para **corrigir ou apagar** o total de um dia), com **meta semanal** em linha tracejada, e notas por matéria com média automática.
- **Investimentos:** simulador de aportes mensais (juros compostos) e quatro textos curtos de educação financeira. A taxa é só um exemplo para estudar.
- **Análise:** saldo mês a mês dos **últimos 12 meses** (gráfico e tabela; meses mais antigos continuam guardados, só não aparecem), comparação com o mês anterior (em palavras: "a mais", "a menos"), horas de estudo × nota com os seus meses, e **meta de reserva**: você informa quanto já guardou, vê o progresso em barra e em quantos meses chega nela (o prazo conta só o que falta, com a sua sobra média).
- **Dados:** **exportar e importar** tudo em um arquivo `.json`. O arquivo sai em texto simples, ou **protegido com senha** (opcional): preenchendo "Senha do arquivo" no menu, ele é cifrado com AES-256-GCM, com a chave derivada da senha (PBKDF2, 600 mil iterações). Para importar um arquivo protegido, preencha a mesma senha antes. Depois de 30 dias sem exportar, o Início **lembra de fazer uma cópia** (uma linha em Observações; exportar zera a contagem).
- **Contas:** cada pessoa tem seus próprios dados no navegador, protegidos por login.
- **Interface:** abas embaixo no celular, links no topo no computador, modo claro e escuro que seguem o sistema, com um seletor de **Aparência** (Sistema, Claro ou Escuro) no menu.

## Capturas

| Início no computador | Análise no computador | Entrada, com o botão de exemplo |
|---|---|---|
| <img src="docs/screenshots/inicio-desktop.png" width="330" alt="Início no computador"> | <img src="docs/screenshots/analise-desktop.png" width="330" alt="Aba Análise com gráfico de saldo, comparação, horas e notas e meta de reserva"> | <img src="docs/screenshots/entrar-exemplo-celular.png" width="200" alt="Tela de entrada no celular com o botão Ver com dados de exemplo"> |

<details>
<summary>Análise no celular</summary>

<img src="docs/screenshots/analise-celular.png" width="300" alt="Aba Análise no celular">

</details>

## Dados simulados

A pasta [`dados/`](dados/) tem bases **fictícias** (150 estudantes, 6 meses) para o projeto de análise: finanças, estudos, erros plantados de propósito e o gabarito. O formato de cada coluna e as premissas estão no [dicionário de dados](dados/DICIONARIO.md). Nenhuma pessoa real aparece nelas.

```bash
python dados/gerar_bases.py   # regenera as bases (dados/bases, dados/esperado e dados/gabarito_erros.csv)
python dados/gerar_demo.py    # regenera js/demo.js, o estudante do botão "Ver com dados de exemplo"
```

O estudante de exemplo é escolhido por regra a partir de `dados/esperado/` (as bases já tratadas) e convertido para o formato do app. O `js/demo.js` é um arquivo gerado, e um teste falha se ele ficar diferente do que o conversor produz.

## Testes

Precisa de Node 22.12 ou mais novo e, para os dados, Python 3.10 ou mais novo (só a biblioteca padrão). Para a bateria no navegador real, um Edge, Chrome ou Chromium instalado.

```bash
npm ci
npm run test:all
```

| Comando | O que roda |
|---|---|
| `npm test` | Fluxos completos em navegador simulado (jsdom): contas, gastos, importação e exportação, migração de formatos, extrato CSV, gastos fixos, orçamento, análise e conta de exemplo |
| `npm run test:csv` | Leitor de extrato: separadores, aspas, valores, datas, duplicados e sugestão e aprendizado de categorias |
| `npm run test:calc` | Contas da aba Análise: saldo por mês, comparação, horas × nota e prazo da meta |
| `npm run test:design` | Sistema visual: contraste das cores nos dois temas (WCAG 2.2), movimento centralizado e "reduzir movimento", nenhuma cor solta fora dos tokens e `DESIGN.md` em dia com o CSS |
| `npm run test:ui` | Layout, abas, menu, animação, "reduzir movimento", alvos de toque e rolagem lateral em um navegador real |
| `npm run test:dados` | Gerador das bases simuladas e conversor do estudante de exemplo |

O [GitHub Actions](.github/workflows/ci.yml) roda tudo a cada push e a cada pull request. Para refazer as capturas de tela: `npm run screenshots -- <rotulo> <largura> <altura> [light|dark] [cheio|negativo|vazio|exemplo]`.

## Estrutura

```
manifest.webmanifest  nome, cores e ícones para instalar como aplicativo
sw.js                 service worker: guarda os arquivos para abrir sem internet (lista conferida por test:design)
index.html            todas as telas (abas por #hash) e a ordem dos scripts
style.css             estilos, com modo claro e escuro, todos a partir de tokens (cor, espaço, tipo, raio, movimento)
PRODUCT.md            para quem é o app, o que a pessoa quer fazer, tom e princípios
DESIGN.md             o sistema visual: tokens, contraste medido, movimento, componentes e dívida visual
js/                   um arquivo por responsabilidade, carregados como scripts comuns
  util.js state.js    funções pequenas; constantes e estado da tela
  storage.js calc.js  validação e armazenamento; contas (sem mexer na tela)
  auth.js             login, cadastro e senhas com hash
  render.js forms.js  desenho das telas; formulários e botões
  backup.js           exportar e importar JSON
  csv.js extrato.js   leitor de extrato; tela de revisão da importação
  demo.js exemplo.js  estudante simulado (gerado); botão "Ver com dados de exemplo"
  tema.js             seletor de aparência (Sistema, Claro, Escuro)
  nav.js main.js      rotas e menu; inicialização
fonts/                as fontes (Chonburi e IBM Plex Sans) e suas licenças: o site não pede nada a servidores de fora
dados/                bases simuladas, dicionário de dados e geradores (Python)
tests/                testes em Node (jsdom) e em Python
scripts/              capturas de tela, ícones do app (icones.js) e busca do navegador para os testes
docs/screenshots/     imagens do README
```

## Decisões técnicas

- **Sem servidor e sem build.** É HTML, CSS e JavaScript puros, e abre com duplo clique. O JS está em arquivos por responsabilidade, carregados como **scripts comuns** e não como módulos ES, porque o Chrome bloqueia módulos quando a página é aberta por `file://`. Os arquivos se enxergam pelo objeto `Sobrou`, e a ordem dos `<script>` importa. Pelo mesmo motivo o estudante de exemplo vira um `.js` gerado, e não um CSV lido na hora.
- **Senhas com hash.** PBKDF2-SHA-256, sal aleatório e 600.000 iterações, usando a Web Crypto API. Contas criadas com um custo menor são refeitas sozinhas no próximo login correto, e contas antigas que guardavam a senha em texto são convertidas no primeiro acesso.
- **Nada de fora entra sem validação.** Tudo que vem do `localStorage` ou de um arquivo importado passa por validação de tipos, limites, categorias conhecidas e `id`s com caracteres seguros (eles vão para atributos HTML). Textos digitados passam por `esc()` antes de virar HTML, e os gráficos em SVG só recebem números e rótulos fixos.
- **Gravar é tudo ou nada.** Importar arquivo, importar extrato, lançar gastos fixos, salvar orçamento e salvar a meta restauram o estado anterior se o navegador não deixar gravar.
- **Formatos antigos continuam funcionando.** O mês é guardado como `AAAA-MM`, mas `AAAA-M` ainda é lido; a categoria `contas` virou `assinaturas` e é convertida ao carregar. Os campos novos do arquivo exportado (gastos fixos, orçamento, meta) são opcionais, e um arquivo antigo, sem eles, mantém o que já existe.
- **A conta de exemplo não toca em dados reais.** O cadastro só aceita logins com letras minúsculas, números, ponto, hífen e sublinhado, então ninguém tem uma conta chamada `@exemplo`, e o formulário de login não entra nela, só o botão.
- **Nada sai do navegador, nem as fontes.** Chonburi e IBM Plex Sans ficam na pasta `fonts/`, em vez de vir do Google Fonts (que receberia o endereço IP de quem abre o site). Um teste no navegador real confere que o app não faz nenhum pedido a servidores de fora.
- **Gráficos sem biblioteca.** Saldo por mês e horas × nota são SVG montado no código, cada um com uma tabela ou texto equivalente para leitor de tela. O coeficiente de correlação só aparece a partir de 4 meses, sempre com o aviso de que correlação não mostra causa.

## Avisos

- As categorias aprendidas na importação são **descrições de lojas do seu extrato**, guardadas só neste navegador e incluídas no arquivo que você exporta. Elas aparecem no arquivo em texto simples, então não compartilhe o arquivo exportado sem querer. A tela de importação tem o botão para esquecê-las.
- Os seus registros ficam **só neste navegador**. Limpar os dados do navegador apaga tudo, então exporte um arquivo de vez em quando (o Início avisa depois de 30 dias). O app guarda só a data do último backup, não o arquivo.
- **A senha do arquivo não tem recuperação:** esquecê-la significa perder aquele arquivo (os dados no navegador continuam). A criptografia protege **o arquivo que viaja** (Downloads, nuvem, e-mail), não o que fica salvo no navegador.
- O login só separa os dados de cada pessoa **neste navegador**. Quem tiver acesso ao aparelho ainda consegue ler o `localStorage`, então ele **não protege** contra isso. Não use uma senha que você usa em outros lugares.
- O simulador e a meta de reserva usam uma taxa de **exemplo** para estudar. Rendimentos reais mudam e podem ser negativos, e nada aqui é recomendação financeira.
- Os dados de `dados/` e o estudante de exemplo são **fictícios**.

## Licença

[MIT](LICENSE).
