# Dicionário de dados e premissas

> **RASCUNHO para revisão da equipe Saldo Positivo.** O Blueprint pede que o nome e o formato de cada coluna sejam definidos pelos três integrantes juntos, antes do painel, e que cada premissa seja justificada pela equipe. Este documento é a proposta inicial para essa conversa. Nada aqui é definitivo.
>
> **Todos os dados são fictícios.** Foram gerados por `dados/gerar_bases.py` a partir de `dados/premissas.json`. Não existe nenhuma pessoa real nas bases.

## Visão geral

Duas bases, ligadas por **`codigo_estudante`** e **`mes_referencia`**:

- **Finanças:** `renda.csv` e `gastos.csv`
- **Estudos:** `estudos.csv`
- **Dado comum às duas:** `estudantes.csv` (o nível de ensino de cada estudante)

A pasta `dados/` tem:

| Caminho | O que é |
|---|---|
| `bases/` | **O que o painel importa.** Contém erros plantados de propósito (Etapa 7). |
| `esperado/` | O que um tratamento **correto** deve produzir a partir de `bases/`. Serve para conferir o painel. |
| `gabarito_erros.csv` | Lista de cada erro plantado: onde está, qual é e o que fazer com ele. |
| `premissas.json` | Todas as suposições, com justificativa. É a fonte dos números. |
| `gerar_bases.py` | O gerador. |

## Tabelas

Formatos: mês `AAAA-MM`, data `AAAA-MM-DD`, decimal com ponto, texto em minúsculas e sem acento.

### `estudantes.csv`

| Coluna | Tipo | Regra |
|---|---|---|
| `codigo_estudante` | texto | `E001` a `E150`. Chave de ligação. |
| `nivel_ensino` | texto | `universitario`, `tecnico` ou `medio` |

### `renda.csv` (uma linha por estudante e mês)

| Coluna | Tipo | Regra |
|---|---|---|
| `codigo_estudante` | texto | existe em `estudantes.csv` |
| `mes_referencia` | texto | `AAAA-MM` |
| `renda` | número | de 0 a 5000, em reais |

### `gastos.csv` (uma linha por gasto)

| Coluna | Tipo | Regra |
|---|---|---|
| `id_registro` | texto | código único do gasto (`G-E001-2026-05-01`), usado para achar duplicados |
| `codigo_estudante` | texto | existe em `estudantes.csv` |
| `mes_referencia` | texto | `AAAA-MM`, igual ao mês de `data_gasto` |
| `data_gasto` | data | `AAAA-MM-DD`, dentro do mês de referência |
| `categoria` | texto | `alimentacao`, `transporte`, `lazer`, `assinaturas`, `estudos`, `outros` |
| `valor` | número | de 0,01 a 2000,00, em reais |
| `forma_pagamento` | texto | `dinheiro`, `pix`, `debito`, `credito` |
| `tipo_gasto` | texto | `fixo` (todo mês, igual) ou `variavel` |

### `estudos.csv` (uma linha por estudante, mês e matéria)

| Coluna | Tipo | Regra |
|---|---|---|
| `id_registro` | texto | código único (`S-E001-2026-05-01`) |
| `codigo_estudante` | texto | existe em `estudantes.csv` |
| `mes_referencia` | texto | `AAAA-MM` |
| `materia` | texto | lista fixa por nível (ver `premissas.json`) |
| `horas_semana` | número | horas por semana dedicadas àquela matéria, de 0 a 40 |
| `metodo_estudo` | texto | `resumo`, `exercicios`, `videoaula`, `revisao` |
| `nota` | número | de 0 a 10, nota da última avaliação da matéria no mês |

## Regras de tratamento (Etapa 7 do Blueprint)

O painel deve aplicar estas regras ao importar `bases/` e mostrar um **relatório de qualidade** com a contagem de cada caso:

| Problema | Exemplo | O que fazer |
|---|---|---|
| Duplicado | mesmo `id_registro` duas vezes | manter a primeira ocorrência |
| Vazio (categoria) | gasto sem categoria | preencher com `nao_informado` |
| Vazio (valor) | gasto sem valor | remover o registro |
| Vazio (nota) | estudo sem nota | manter o registro e **excluir** do cálculo de médias |
| Valor fora do padrão | R$ 5.000 em um lanche (acima de R$ 2.000) | remover o registro |
| Valor impossível | gasto negativo, nota acima de 10, mais de 40 h por matéria | remover o registro |
| Formato diferente | `05/03/2026` em vez de `2026-03-05`; `R$ 12,50` em vez de `12.50`; mês `2026-5` ou `05/2026` | converter para o formato padrão |
| Nome inconsistente | `Transp.`, `TRANSPORTE`, `Mat.` | padronizar para a lista fixa |
| Chave sem par | código em Finanças que não existe em Estudos (ou o contrário) | avisar e deixar fora do cruzamento entre áreas |

## Erros plantados e gabarito

Para que o tratamento tenha o que tratar, o gerador estraga uma fração pequena e conhecida das linhas. Cada erro vai para `gabarito_erros.csv`, com:

`tabela`, `id_registro`, `codigo_estudante`, `tipo_erro`, `coluna`, `valor_com_erro`, `valor_original`, `acao_esperada` (`corrigir`, `remover`, `preencher`, `sinalizar`), `valor_esperado`.

Com isso dá para conferir **cada erro** (o painel pegou?) e **o resultado** (os números do painel batem com `esperado/`?). Esse é o critério 1 e 2 da Etapa 13.

## Cuidados de interpretação

- **São dados simulados.** Os resultados descrevem o que as premissas produzem, e não estudantes reais.
- **A ligação entre áreas vem desligada** (`cruzado.*` = 0): saldo, lazer, crédito e notas são sorteados de forma independente. Se a análise encontrar relação entre eles, será ruído do sorteio; se não encontrar, é o resultado honesto, e o Blueprint aceita isso. Para a análise de sensibilidade, ligue **um peso por vez**:

  ```bash
  python dados/gerar_bases.py --saida teste --definir cruzado.saldo_na_nota=1
  ```

- **Há uma relação dentro de Estudos** (`efeitos.horas_na_nota`): mais horas elevam a nota de leve. É uma premissa declarada, e não é uma das hipóteses H1 a H4.
- Valores de lazer, gastos e notas variam mês a mês em torno das faixas das premissas, então um mês isolado pode ficar fora delas.
- **Correlação não é causa.** Isso vale para qualquer gráfico de dispersão que sair destas bases.

## Como gerar

```bash
python dados/gerar_bases.py                  # regenera dados/bases, dados/esperado e dados/gabarito_erros.csv
python dados/gerar_bases.py --sem-erros      # sem erros plantados
python dados/gerar_bases.py --documentar     # imprime a tabela de premissas
python dados/gerar_demo.py                   # regenera js/demo.js, o estudante do botão "Ver com dados de exemplo"
python -m unittest discover -s tests -p "test_*.py"    # testes do gerador e do conversor do exemplo
```

Só precisa do Python 3.10 ou mais novo, sem instalar nada.

## Decisões pendentes para a equipe

1. **Nome da categoria:** o Blueprint diz `assinaturas`, e o site hoje usa `contas` ("Contas e assinaturas"). Usei `assinaturas`. Qual vale?
2. **Formato do mês:** `AAAA-MM` aqui (com zero), e `AAAA-M` no site. Padronizar em `AAAA-MM`?
3. **`nao_informado` como categoria** para gastos sem categoria: o painel deve mostrá-la nos gráficos?
4. **Tamanho:** 150 estudantes por 6 meses (`2026-05` a `2026-10`). Está bom?
5. **Cada valor da tabela abaixo** precisa ser confirmado ou corrigido pela equipe com a sua justificativa. Em especial: faixas de renda (e o salário mínimo vigente), proporção de cada nível de ensino e a relação entre horas e nota.
6. **Quantos meses fecham negativos:** hoje cerca de 4% dos meses. Se a equipe achar pouco, ajuste `gastos.propensao_a_gastar_dp`.

## Tabela de premissas

Gerada por `python dados/gerar_bases.py --documentar`. A fonte dos números é `premissas.json`.

| Premissa | Valor padrão | Justificativa | Origem |
|---|---|---|---|
| `geral.semente` | `2026` | Número que fixa o sorteio: com a mesma semente, as bases saem idênticas. Mudar a semente gera outra população fictícia com as mesmas regras. | rascunho (a confirmar pela equipe) |
| `geral.estudantes` | `150` | Tamanho suficiente para gráficos de dispersão legíveis e para filtrar por nível de ensino sem ficar com grupos minúsculos. | rascunho (a confirmar pela equipe) |
| `geral.mes_inicial` | `"2026-05"` | Primeiro mês de referência. Fixo, e não 'hoje', para que as bases não mudem conforme a data em que forem geradas. | rascunho (a confirmar pela equipe) |
| `geral.meses` | `6` | Seis meses dão uma evolução ao longo do tempo (gráfico de linhas) e coincidem com a janela que o site já mostra. | rascunho (a confirmar pela equipe) |
| `geral.nivel_pesos` | `{"universitario": 0.45, "tecnico": 0.3, "medio": 0.25}` | Proporção de cada nível de ensino entre os estudantes. O Blueprint cita os três níveis, mas não diz a proporção; esta é uma suposição. | rascunho (a confirmar pela equipe) |
| `renda.faixa_por_nivel` | `{"medio": [150, 700], "tecnico": [300, 1400], "universitario": [500, 1600]}` | Renda mensal em reais (mínimo e máximo). Sorteada uniformemente dentro da faixa, uma vez por estudante. Blueprint: 'estudantes que trabalham recebem, em geral, até um salário mínimo, e mesada e bolsa seguem valores semelhantes'. Confirmar o salário mínimo vigente e ajustar o teto. | Blueprint (valores a confirmar) |
| `renda.variacao_mensal` | `0.06` | Desvio-padrão relativo da renda de um mês para o outro (6%). Estágio e bolsa variam pouco; trabalho informal varia mais. | rascunho (a confirmar pela equipe) |
| `gastos.parcela_da_renda` | `{"alimentacao": [0.2, 0.35], "transporte": [0.08, 0.18], "lazer": [0.1, 0.2], "assinaturas": [0.03, 0.08], "estudos": [0.02, 0.08], "outros": [0.03, 0.1]}` | Fatia da renda que cada estudante destina a cada categoria (mínimo e máximo), sorteada uma vez por estudante. Lazer de 10% a 20% vem do Blueprint ('gasto comum, mas não essencial'). As demais são suposições de ordem de grandeza. | Blueprint (lazer) e rascunho (demais) |
| `gastos.variacao_mensal` | `0.15` | Desvio-padrão relativo do gasto de cada categoria de um mês para o outro (15%). | rascunho (a confirmar pela equipe) |
| `gastos.propensao_a_gastar_dp` | `0.15` | Há quem gaste mais que o padrão e quem gaste menos. Multiplicador de gasto por estudante, com média 1 e este desvio-padrão. É o que faz alguns meses fecharem no vermelho. | rascunho (a confirmar pela equipe) |
| `gastos.chance_gasto_extra` | `0.08` | Chance, em cada mês, de aparecer um gasto inesperado (conserto, consulta, presente) além do padrão. | rascunho (a confirmar pela equipe) |
| `gastos.gasto_extra_parcela` | `[0.1, 0.3]` | Tamanho do gasto inesperado, como fatia da renda do mês (de 10% a 30%). | rascunho (a confirmar pela equipe) |
| `gastos.transacoes_por_mes` | `{"alimentacao": [6, 12], "transporte": [1, 4], "lazer": [2, 5], "assinaturas": [1, 3], "estudos": [0, 3], "outros": [1, 4]}` | Quantos lançamentos por mês em cada categoria (mínimo e máximo). Em 'assinaturas', é o número de assinaturas que a pessoa tem; elas se repetem todo mês com o mesmo valor (gasto fixo). | rascunho (a confirmar pela equipe) |
| `gastos.chance_passe_transporte` | `0.6` | Parte dos estudantes paga um passe mensal (gasto fixo, 70% do transporte); os outros pagam corridas avulsas (gasto variável). | rascunho (a confirmar pela equipe) |
| `pagamento.credito_chance_por_nivel` | `{"medio": [0.0, 0.1], "tecnico": [0.0, 0.35], "universitario": [0.0, 0.5]}` | Chance de uma compra ser no cartão de crédito, sorteada uma vez por estudante. Menores de idade raramente têm cartão; universitários têm mais acesso. | rascunho (a confirmar pela equipe) |
| `pagamento.pesos_sem_credito` | `{"dinheiro": 0.2, "pix": 0.55, "debito": 0.25}` | Como se divide o que não é cartão de crédito. Pix é o meio mais usado hoje. Assinaturas nunca são pagas em dinheiro. | rascunho (a confirmar pela equipe) |
| `estudos.materias_por_nivel` | `{"medio": ["matematica", "portugues", "historia", "geografia", "biologia", "fisica", "quimica", "ingles"], "tecnico": ["matematica", "portugues", "ingles", "programacao", "banco_de_dados", "redes", "gestao"], "universitario": ["calculo", "estatistica", "programacao", "algoritmos", "banco_de_dados", "ingles", "fisica"]}` | Lista fixa de matérias de cada nível (a Etapa 7 pede listas fixas para evitar 'Mat.' e 'Matemática' como coisas diferentes). Ajustar aos cursos reais da turma. | rascunho (a confirmar pela equipe) |
| `estudos.materias_por_estudante` | `4` | Quantas matérias cada estudante acompanha. Fixo ao longo dos meses. | rascunho (a confirmar pela equipe) |
| `estudos.horas_semana_total` | `{"media": 10, "dp": 3.5, "min": 2, "max": 25}` | Horas de estudo por semana somando todas as matérias, por estudante. Blueprint: 'a maioria estuda entre 5 e 15 horas por semana'. Distribuição normal com esta média e desvio-padrão, limitada entre mínimo e máximo. | Blueprint |
| `estudos.variacao_mensal_horas` | `0.2` | Desvio-padrão relativo das horas de um mês para o outro (20%), pela variação da rotina de trabalho e de provas. | rascunho (a confirmar pela equipe) |
| `estudos.nota_base` | `{"media": 6.5, "dp": 1.4}` | Nota típica de cada estudante em cada matéria, antes de qualquer efeito. Média escolar em torno de 6,5 com variação entre estudantes. | rascunho (a confirmar pela equipe) |
| `estudos.nota_ruido_dp` | `0.8` | Variação aleatória da nota de uma avaliação para outra, mesmo para o mesmo estudante e a mesma matéria. | rascunho (a confirmar pela equipe) |
| `efeitos.horas_na_nota` | `0.15` | PREMISSA INTERNA À ÁREA DE ESTUDOS: cada hora semanal acima do típico da matéria soma 0,15 ponto na nota. Efeito fraco de propósito (10 horas a mais por semana dariam 1,5 ponto), com base na ideia comum de que estudar mais tende a ajudar, sem garantir. Não é testada pelas hipóteses H1 a H4, mas aparece no gráfico de horas por nota. Use 0 para desligar. | rascunho (a confirmar pela equipe) |
| `efeitos.metodo_na_nota` | `{"resumo": 0.0, "exercicios": 0.0, "videoaula": 0.0, "revisao": 0.0}` | Pontos somados à nota conforme o método de estudo. TODOS ZERO por padrão: a hipótese H4 (exercícios e revisão associados a notas maiores) deve ser testada pela análise e não embutida na base. Para a análise de sensibilidade, teste, por exemplo, 'exercicios' com 0.3. | rascunho (a confirmar pela equipe) |
| `cruzado.lazer_nas_horas` | `0` | LIGAÇÃO ENTRE ÁREAS, DESLIGADA POR PADRÃO (hipótese H1). Com peso 1, estudantes com 1 desvio-padrão a mais de lazer estudam 10% menos horas. Com 0, lazer e horas de estudo são sorteados de forma independente. | decisão da equipe: desligada por padrão |
| `cruzado.saldo_na_nota` | `0` | LIGAÇÃO ENTRE ÁREAS, DESLIGADA POR PADRÃO (hipótese H2 e gráfico principal). Com peso 1, estudantes com 1 desvio-padrão a mais de saldo tiram 0,3 ponto a mais. Com 0, saldo e notas são independentes. | decisão da equipe: desligada por padrão |
| `cruzado.credito_no_gasto` | `0` | LIGAÇÃO ENTRE ÁREAS, DESLIGADA POR PADRÃO (hipótese H3). Com peso 1, estudantes com 1 desvio-padrão a mais de uso do crédito gastam 10% a mais. Com 0, o uso do cartão não muda o gasto. | decisão da equipe: desligada por padrão |
| `erros.ativar` | `true` | Planta erros de qualidade de dados nas bases para que as regras de tratamento da Etapa 7 tenham o que tratar. Use --sem-erros para gerar as bases limpas. | Blueprint (Etapa 7) |
| `erros.taxas_gastos` | `{"categoria_vazia": 0.005, "valor_vazio": 0.005, "valor_outlier": 0.002, "valor_negativo": 0.003, "data_formato": 0.02, "valor_formato": 0.01, "categoria_variacao": 0.02, "mes_formato": 0.01, "duplicado": 0.01}` | Fração das linhas de gastos que recebe cada tipo de erro. Os tipos seguem a lista de problemas da Etapa 7 (vazios, incorretos, formatos diferentes, impossíveis, inconsistentes, duplicados). Taxas pequenas, como em dados reais mal digitados. | Blueprint (tipos) e rascunho (taxas) |
| `erros.taxas_estudos` | `{"nota_vazia": 0.01, "nota_invalida": 0.005, "horas_invalida": 0.003, "materia_variacao": 0.02, "mes_formato": 0.01, "duplicado": 0.01}` | Fração das linhas de estudos que recebe cada tipo de erro. | Blueprint (tipos) e rascunho (taxas) |
| `erros.estudantes_sem_estudos` | `3` | Quantos estudantes aparecem em Finanças mas somem da base de Estudos (chave que não bate, Etapa 7). O painel deve avisar e deixá-los fora do cruzamento. | Blueprint (tipo) e rascunho (quantidade) |
| `erros.estudantes_sem_renda` | `2` | Quantos estudantes têm gastos mas nenhuma renda registrada: sem renda não há saldo. | Blueprint (tipo) e rascunho (quantidade) |

