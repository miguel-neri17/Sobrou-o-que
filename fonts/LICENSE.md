# Fontes do projeto

As fontes ficam **dentro do repositório**, e não carregadas do Google Fonts, por dois motivos:

- **Privacidade:** pedir uma fonte ao Google envia o endereço IP de quem abre o site a um servidor de fora, e o projeto promete que nenhum dado sai do navegador.
- **Funciona offline e sem variação:** o site abre com duplo clique, sem internet, com a mesma aparência de sempre.

| Arquivo | Fonte | Autoria | Licença |
|---|---|---|---|
| `chonburi-latin.woff2` | Chonburi (400) | Copyright (c) 2015, Cadson Demak | SIL Open Font License 1.1 ([texto](OFL-chonburi.txt)) |
| `ibm-plex-sans-latin.woff2` | IBM Plex Sans (variável, pesos 100 a 700; o site usa 400, 500 e 600) | Copyright (c) 2017 IBM Corp., nome reservado "Plex" | SIL Open Font License 1.1 ([texto](OFL-ibmplexsans.txt)) |

Ambas são **livres para uso, cópia e redistribuição**, inclusive junto com este projeto, desde que a licença (os arquivos `OFL-*.txt`) acompanhe as fontes. Os arquivos `.woff2` são exatamente os que o Google Fonts distribui, sem nenhuma alteração.

## O que tem dentro

Só o recorte **latin** de cada fonte: o alfabeto com todos os acentos do português, a pontuação tipográfica, o sinal de menos (U+2212) e o euro. É o suficiente para todo texto que o app mostra, e cada fonte fica com cerca de 19 KB (Chonburi) e 46 KB (IBM Plex Sans).

Se um dia o app precisar de outro alfabeto, é preciso baixar o recorte correspondente (por exemplo, `latin-ext`) e acrescentar um `@font-face` no `style.css`.

## Como atualizar

1. Abra `https://fonts.googleapis.com/css2?family=Chonburi&family=IBM+Plex+Sans:wght@400;500;600&display=swap` com um navegador moderno e copie os endereços `.woff2` do bloco `/* latin */` de cada fonte.
2. Baixe os arquivos para esta pasta, mantendo os nomes.
3. Rode `npm run test:design`: o teste confere que os arquivos são `woff2` de verdade e que o `style.css` não aponta para nada de fora.
