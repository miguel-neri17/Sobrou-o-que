# Produto: Sobrou o Quê?

Contexto durável para qualquer pessoa (ou ferramenta) que mexa no visual. Para o sistema visual em si, veja o [DESIGN.md](DESIGN.md).

## O que é

Um painel pessoal para estudantes. A pessoa anota o que **entra e sai**, as **horas de estudo** e as **notas**, e o app responde a pergunta do nome: **o que sobrou no mês?** É um site estático, sem servidor, que guarda tudo no navegador de quem usa.

## Para quem

- **Estudantes** do ensino médio, técnico e superior, de 15 a 25 anos, com renda pequena e variável (mesada, bolsa, estágio, trabalho informal).
- Usam **no celular, quase sempre**, em sessões curtas: anotar um gasto na fila, olhar o saldo antes de comprar algo.
- Em geral **não são especialistas em finanças**. Termos como "juros compostos" ou "reserva de emergência" precisam vir explicados.
- Há uma segunda audiência, a **banca ou a turma** que avalia o projeto: ela precisa ver rápido que o app funciona e que os dados são tratados com cuidado. Para isso existe a conta de exemplo.

## O que a pessoa quer fazer (em ordem de importância)

1. **Ver o que sobrou** neste mês, de relance.
2. **Registrar** um gasto, a renda, horas de estudo ou uma nota em poucos toques.
3. **Entender** para onde foi o dinheiro e se está dentro do orçamento.
4. **Comparar** o mês com o anterior e ver a evolução.
5. **Planejar** uma reserva e simular quanto rende guardar a sobra.
6. **Trazer dados** de fora (extrato do banco em CSV) sem digitar tudo de novo.

## Modo de design

**Operate:** a pessoa está executando uma tarefa. Vale legibilidade, consistência e padrões que ela já conhece. A marca aparece nos detalhes (a cor, a fonte do valor que sobrou), não em enfeites. Ousadia visual não é o objetivo: **clareza é**.

## Tom

- Português do Brasil, **você**, frases curtas e diretas.
- Amigo, nunca professor nem fiscal. Um mês no vermelho é um **fato**, não uma culpa: "Faltou em outubro", sem alarme e sem moralismo.
- Todo número vem com contexto ("R$ 210 a mais que em outubro").
- Nada é recomendação financeira. Taxas de rendimento são sempre "de exemplo".

## Princípios

1. **Uma pergunta por tela.** O Início responde "sobrou o quê?"; as outras telas ficam em segundo plano.
2. **Cor significa uma coisa só.** Verde é estrutura e gasto, laranja é **só** o que sobrou, vermelho é passou ou faltou. Nunca só a cor: sempre texto, formato ou padrão junto.
3. **Menos caixas, mais ritmo.** Espaço, títulos e linhas finas antes de mais um cartão.
4. **Números sempre legíveis.** Algarismos tabulares, nunca cortados, alinhados à direita nas tabelas.
5. **Movimento só onde informa.** Um momento de destaque (o valor que conta até o saldo); o resto é feedback curto de estado.
6. **Acessível por padrão.** WCAG 2.2 nível AA é requisito, não enfeite: contraste, foco, alvos de toque e "reduzir movimento".

## O que não queremos

- Gamificação, mascote, conquistas, confete.
- Gradientes decorativos, vidro fosco, sombras pesadas, brilho.
- Gráficos demais: cada gráfico responde uma pergunta e tem tabela ou texto equivalente.
- Vermelho como punição ou tela inteira em alerta.
- Qualquer dado saindo do navegador, ou dependência que exija servidor ou build.

## Restrições técnicas que o visual respeita

- **HTML, CSS e JS puros**, sem build, abrindo com duplo clique. Nada de biblioteca de interface.
- Funciona de **320 a 1280 px** sem rolagem lateral, com **modo claro e escuro** automáticos.
- Respeita **"reduzir movimento"** do sistema.
- As fontes vêm do Google Fonts; sem elas o app continua legível com a fonte de reserva do sistema.

## Como saber se está bom

- Em até 2 segundos o Início diz quanto sobrou, e se foi positivo ou negativo.
- `npm run test:design` verde (contraste, movimento, tokens), junto com os demais testes.
- Nenhuma rolagem lateral em 320, 360, 390, 768 e 1280 px.
- Conferido a olho em celular e computador, nos dois temas, antes de cada entrega.
