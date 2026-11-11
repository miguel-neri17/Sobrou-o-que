#!/usr/bin/env python3
"""Gerador das bases simuladas do projeto "Sobrou o Quê?" (RASCUNHO para revisão da equipe).

Gera quatro tabelas ligadas pelo código do estudante e pelo mês de referência:
estudantes, renda, gastos (base de Finanças) e estudos (base de Estudos).

Pontos que importam para a honestidade da análise (Blueprint, Etapas 6 e 8):
  * Todas as suposições estão em dados/premissas.json, cada uma com justificativa.
  * A ligação entre Finanças e Estudos vem DESLIGADA: dinheiro e notas são sorteados
    de forma independente. Ela só existe se alguém ligar um peso 'cruzado.*'.
  * Com a mesma semente, as bases saem idênticas. Mudar UMA premissa não muda os
    outros sorteios, então a análise de sensibilidade compara coisas comparáveis.

Uso:
  python dados/gerar_bases.py                          gera tudo com as premissas padrão
  python dados/gerar_bases.py --sem-erros              sem os erros plantados
  python dados/gerar_bases.py --definir cruzado.saldo_na_nota=1     muda UMA premissa
  python dados/gerar_bases.py --saida pasta_de_teste   escreve em outra pasta
  python dados/gerar_bases.py --documentar             imprime a tabela de premissas (Markdown)

Só usa a biblioteca padrão do Python (3.10 ou mais novo). As bases versionadas no
repositório foram geradas com o Python 3.12.
"""
import argparse
import calendar
import copy
import csv
import json
import random
import sys
from pathlib import Path
from statistics import correlation, mean, pstdev

CATEGORIAS = ["alimentacao", "transporte", "lazer", "assinaturas", "estudos", "outros"]
METODOS = ["resumo", "exercicios", "videoaula", "revisao"]

COLUNAS = {
    "estudantes": ["codigo_estudante", "nivel_ensino"],
    "renda": ["codigo_estudante", "mes_referencia", "renda"],
    "gastos": ["id_registro", "codigo_estudante", "mes_referencia", "data_gasto",
               "categoria", "valor", "forma_pagamento", "tipo_gasto"],
    "estudos": ["id_registro", "codigo_estudante", "mes_referencia", "materia",
                "horas_semana", "metodo_estudo", "nota"],
}
COLUNAS_GABARITO = ["tabela", "id_registro", "codigo_estudante", "tipo_erro", "coluna",
                    "valor_com_erro", "valor_original", "acao_esperada", "valor_esperado"]

# escritas "erradas" de cada categoria (só ASCII, para o arquivo abrir igual em qualquer programa)
VARIACOES_CATEGORIA = {
    "alimentacao": ["Alimentacao", "ALIMENTACAO", "alim."],
    "transporte": ["Transporte", "TRANSPORTE", "transp."],
    "lazer": ["Lazer", "LAZER", "laser"],
    "assinaturas": ["Assinaturas", "assinatura", "ASSINATURAS"],
    "estudos": ["Estudos", "estudo", "ESTUDOS"],
    "outros": ["Outros", "OUTROS", "outro"],
}


# ---------------------------------------------------------------- premissas
class Premissas:
    """Lê dados/premissas.json. Chame p("grupo.nome") para obter o valor de uma premissa."""

    def __init__(self, itens):
        self.itens = itens

    @classmethod
    def carregar(cls, caminho, sobrescritas=()):
        with open(caminho, encoding="utf-8") as f:
            itens = copy.deepcopy(json.load(f)["premissas"])
        p = cls(itens)
        for texto in sobrescritas:
            chave, sep, bruto = texto.partition("=")
            if not sep or chave not in itens:
                raise SystemExit(f"Premissa desconhecida em --definir: {texto!r}. Veja --documentar.")
            try:
                itens[chave]["valor"] = json.loads(bruto)
            except json.JSONDecodeError:
                raise SystemExit(f"Valor inválido em --definir {texto!r}: use JSON (números, true, [1,2], \"texto\").")
        return p

    def __call__(self, chave):
        return self.itens[chave]["valor"]

    def documentar(self):
        linhas = ["| Premissa | Valor padrão | Justificativa | Origem |", "|---|---|---|---|"]
        for chave, item in self.itens.items():
            valor = json.dumps(item["valor"], ensure_ascii=False)
            linhas.append(f"| `{chave}` | `{valor}` | {item['justificativa']} | {item['origem']} |")
        return "\n".join(linhas)


# ---------------------------------------------------------------- utilidades
def rng_de(*partes):
    """Um sorteador próprio para cada parte da geração (semente de texto é estável entre execuções)."""
    return random.Random(":".join(str(p) for p in partes))


def limitar(x, lo, hi):
    return max(lo, min(hi, x))


def sortear(rng, pesos):
    total = sum(pesos.values())
    ponto = rng.random() * total
    acumulado = 0.0
    escolhido = None
    for chave, peso in pesos.items():
        escolhido = chave
        acumulado += peso
        if ponto <= acumulado:
            break
    return escolhido


def dividir(rng, total, n, piso=2.0):
    """Reparte 'total' em n valores positivos (em reais, com centavos)."""
    pesos = [rng.expovariate(1.0) + 0.15 for _ in range(n)]
    soma = sum(pesos)
    return [round(max(piso, total * p / soma), 2) for p in pesos]


def lista_meses(inicial, quantidade):
    ano, mes = (int(x) for x in inicial.split("-"))
    saida = []
    for _ in range(quantidade):
        saida.append(f"{ano:04d}-{mes:02d}")
        mes += 1
        if mes == 13:
            ano, mes = ano + 1, 1
    return saida


def dias_no_mes(mes):
    ano, m = (int(x) for x in mes.split("-"))
    return calendar.monthrange(ano, m)[1]


def zscore(valores):
    m = mean(valores)
    dp = pstdev(valores) or 1.0
    return [(v - m) / dp for v in valores]


# ---------------------------------------------------------------- geração (dados limpos)
def gerar_estudantes(p):
    estudantes = []
    h = p("estudos.horas_semana_total")
    nb = p("estudos.nota_base")
    for i in range(1, p("geral.estudantes") + 1):
        cod = f"E{i:03d}"
        rng = rng_de(p("geral.semente"), "estudante", cod)
        nivel = sortear(rng, p("geral.nivel_pesos"))
        lo, hi = p("renda.faixa_por_nivel")[nivel]
        lo_c, hi_c = p("pagamento.credito_chance_por_nivel")[nivel]
        materias = rng.sample(p("estudos.materias_por_nivel")[nivel], p("estudos.materias_por_estudante"))
        e = {
            "codigo": cod,
            "nivel": nivel,
            "renda_base": round(rng.uniform(lo, hi), 2),
            "parcelas": {c: rng.uniform(*p("gastos.parcela_da_renda")[c]) for c in CATEGORIAS},
            "propensao": max(0.4, rng.gauss(1.0, p("gastos.propensao_a_gastar_dp"))),
            "p_credito": rng.uniform(lo_c, hi_c),
            "horas_total": limitar(rng.gauss(h["media"], h["dp"]), h["min"], h["max"]),
            "materias": materias,
            "pesos_horas": [rng.uniform(0.5, 1.5) for _ in materias],
            "mu_nota": {m: limitar(rng.gauss(nb["media"], nb["dp"]), 0, 10) for m in materias},
            "pref_metodo": {m: rng.uniform(0.2, 1.0) for m in METODOS},
            "passe": rng.random() < p("gastos.chance_passe_transporte"),
            "dia_passe": rng.randint(1, 5),
        }
        n_ass = rng.randint(*p("gastos.transacoes_por_mes")["assinaturas"])
        valores = dividir(rng, e["parcelas"]["assinaturas"] * e["renda_base"], n_ass, piso=5.0)
        e["assinaturas"] = [(v, rng.randint(1, 28)) for v in valores]
        estudantes.append(e)

    # ligações entre áreas: o peso padrão é 0, então estas linhas não mudam nada até alguém ligá-las
    z_lazer = zscore([e["parcelas"]["lazer"] for e in estudantes])
    z_cred = zscore([e["p_credito"] for e in estudantes])
    for e, zl, zc in zip(estudantes, z_lazer, z_cred):
        e["prop_eff"] = max(0.4, e["propensao"] * (1 + p("cruzado.credito_no_gasto") * 0.10 * zc))
        e["horas_eff"] = limitar(e["horas_total"] * (1 - p("cruzado.lazer_nas_horas") * 0.10 * zl), h["min"], h["max"])
    return estudantes


def escolher_forma(rng, p_credito, p, categoria):
    if rng.random() < p_credito:
        return "credito"
    pesos = dict(p("pagamento.pesos_sem_credito"))
    if categoria == "assinaturas":
        pesos.pop("dinheiro", None)
    return sortear(rng, pesos)


def gerar_financas(p, estudantes, meses):
    renda, gastos = [], []
    variacao = p("gastos.variacao_mensal")
    transacoes = p("gastos.transacoes_por_mes")
    for e in estudantes:
        for mes in meses:
            rng = rng_de(p("geral.semente"), "fin", e["codigo"], mes)
            renda_mes = max(50.0, round(e["renda_base"] * (1 + rng.gauss(0, p("renda.variacao_mensal"))), 2))
            renda.append({"codigo_estudante": e["codigo"], "mes_referencia": mes, "renda": f"{renda_mes:.2f}"})
            dim = dias_no_mes(mes)
            itens = []  # (categoria, valor, dia, tipo)
            for c in CATEGORIAS:
                if c == "assinaturas":
                    itens += [(c, valor, dia, "fixo") for valor, dia in e["assinaturas"]]
                    continue
                parcela = e["parcelas"][c]
                total = renda_mes * parcela * e["prop_eff"] * max(0.3, 1 + rng.gauss(0, variacao))
                n_lo, n_hi = transacoes[c]
                if c == "transporte" and e["passe"]:
                    itens.append((c, max(2.0, round(parcela * e["renda_base"] * 0.7, 2)), min(e["dia_passe"], dim), "fixo"))
                    total *= 0.3
                    n_lo, n_hi = 0, 2
                n = rng.randint(n_lo, n_hi)
                if n:
                    itens += [(c, valor, rng.randint(1, dim), "variavel") for valor in dividir(rng, total, n)]
            if rng.random() < p("gastos.chance_gasto_extra"):
                lo_x, hi_x = p("gastos.gasto_extra_parcela")
                itens.append(("outros", round(max(2.0, renda_mes * rng.uniform(lo_x, hi_x)), 2), rng.randint(1, dim), "variavel"))
            itens.sort(key=lambda t: (t[2], CATEGORIAS.index(t[0])))
            for k, (c, valor, dia, tipo) in enumerate(itens, 1):
                gastos.append({
                    "id_registro": f"G-{e['codigo']}-{mes}-{k:02d}",
                    "codigo_estudante": e["codigo"],
                    "mes_referencia": mes,
                    "data_gasto": f"{mes}-{dia:02d}",
                    "categoria": c,
                    "valor": f"{valor:.2f}",
                    "forma_pagamento": escolher_forma(rng, e["p_credito"], p, c),
                    "tipo_gasto": tipo,
                })
    return renda, gastos


def razao_saldo(renda, gastos):
    """Saldo médio de cada estudante como fração da renda: (renda - gastos) / renda."""
    total_gasto = {}
    for g in gastos:
        chave = (g["codigo_estudante"], g["mes_referencia"])
        total_gasto[chave] = total_gasto.get(chave, 0.0) + float(g["valor"])
    razoes = {}
    for r in renda:
        v = float(r["renda"])
        gasto = total_gasto.get((r["codigo_estudante"], r["mes_referencia"]), 0.0)
        razoes.setdefault(r["codigo_estudante"], []).append((v - gasto) / v)
    return {cod: mean(lista) for cod, lista in razoes.items()}


def gerar_estudos(p, estudantes, meses, z_saldo):
    estudos = []
    ref = p("estudos.horas_semana_total")["media"] / p("estudos.materias_por_estudante")
    efeito_horas = p("efeitos.horas_na_nota")
    efeito_metodo = p("efeitos.metodo_na_nota")
    peso_saldo = p("cruzado.saldo_na_nota")
    for e in estudantes:
        soma_pesos = sum(e["pesos_horas"])
        for mes in meses:
            rng = rng_de(p("geral.semente"), "est", e["codigo"], mes)
            horas_mes = max(1.0, e["horas_eff"] * (1 + rng.gauss(0, p("estudos.variacao_mensal_horas"))))
            for j, (materia, peso) in enumerate(zip(e["materias"], e["pesos_horas"]), 1):
                horas = max(0.1, round(horas_mes * peso / soma_pesos, 1))
                metodo = sortear(rng, e["pref_metodo"])
                nota = (e["mu_nota"][materia]
                        + efeito_horas * (horas - ref)
                        + efeito_metodo.get(metodo, 0.0)
                        + peso_saldo * 0.3 * z_saldo[e["codigo"]]
                        + rng.gauss(0, p("estudos.nota_ruido_dp")))
                estudos.append({
                    "id_registro": f"S-{e['codigo']}-{mes}-{j:02d}",
                    "codigo_estudante": e["codigo"],
                    "mes_referencia": mes,
                    "materia": materia,
                    "horas_semana": f"{horas:.1f}",
                    "metodo_estudo": metodo,
                    "nota": f"{round(limitar(nota, 0, 10), 1):.1f}",
                })
    return estudos


def gerar(p):
    """Devolve (estudantes_internos, tabelas_limpas)."""
    meses = lista_meses(p("geral.mes_inicial"), p("geral.meses"))
    estudantes = gerar_estudantes(p)
    renda, gastos = gerar_financas(p, estudantes, meses)
    saldo = razao_saldo(renda, gastos)
    z = dict(zip(saldo.keys(), zscore(list(saldo.values()))))
    estudos = gerar_estudos(p, estudantes, meses, z)
    limpas = {
        "estudantes": [{"codigo_estudante": e["codigo"], "nivel_ensino": e["nivel"]} for e in estudantes],
        "renda": renda,
        "gastos": gastos,
        "estudos": estudos,
    }
    return estudantes, limpas


# ---------------------------------------------------------------- erros plantados (Etapa 7)
def _data_formato(l, rng):
    ano, mes, dia = l["data_gasto"].split("-")
    return f"{dia}/{mes}/{ano}", "corrigir", l["data_gasto"]


def _mes_formato(l, rng):
    ano, mes = l["mes_referencia"].split("-")
    return rng.choice([f"{ano}-{int(mes)}", f"{mes}/{ano}"]), "corrigir", l["mes_referencia"]


def _variacao_materia(l, rng):
    m = l["materia"]
    return rng.choice([m.upper(), m.capitalize(), m.replace("_", " "), m[:4] + "."]), "corrigir", m


REGRAS_GASTOS = [
    ("categoria_vazia", "categoria", lambda l, rng: ("", "preencher", "nao_informado")),
    ("valor_vazio", "valor", lambda l, rng: ("", "remover", "")),
    ("valor_outlier", "valor", lambda l, rng: (f"{rng.uniform(3000, 9000):.2f}", "remover", "")),
    ("valor_negativo", "valor", lambda l, rng: ("-" + l["valor"], "remover", "")),
    ("data_formato", "data_gasto", _data_formato),
    ("valor_formato", "valor", lambda l, rng: ("R$ " + l["valor"].replace(".", ","), "corrigir", l["valor"])),
    ("categoria_variacao", "categoria", lambda l, rng: (rng.choice(VARIACOES_CATEGORIA[l["categoria"]]), "corrigir", l["categoria"])),
    ("mes_formato", "mes_referencia", _mes_formato),
]
REGRAS_ESTUDOS = [
    ("nota_vazia", "nota", lambda l, rng: ("", "sinalizar", "")),
    ("nota_invalida", "nota", lambda l, rng: (str(rng.choice([11, 12, 15, 100])), "remover", "")),
    ("horas_invalida", "horas_semana", lambda l, rng: (f"{rng.uniform(200, 400):.1f}", "remover", "")),
    ("materia_variacao", "materia", _variacao_materia),
    ("mes_formato", "mes_referencia", _mes_formato),
]


def plantar(rng, tabela, linhas, regras, taxas, gabarito):
    """Estraga linhas diferentes (nunca duas vezes a mesma) e anota cada erro no gabarito."""
    n = len(linhas)
    livres = list(range(n))
    rng.shuffle(livres)
    marcados = {}
    for tipo, coluna, regra in regras:
        for _ in range(round(taxas[tipo] * n)):
            if not livres:
                break
            linha = linhas[livres.pop()]
            original = linha[coluna]
            novo, acao, esperado = regra(linha, rng)
            linha[coluna] = novo
            marcados[linha["id_registro"]] = (acao, coluna, esperado)
            gabarito.append({"tabela": tabela, "id_registro": linha["id_registro"],
                             "codigo_estudante": linha["codigo_estudante"], "tipo_erro": tipo, "coluna": coluna,
                             "valor_com_erro": novo, "valor_original": original,
                             "acao_esperada": acao, "valor_esperado": esperado})
    copias = []
    for _ in range(round(taxas["duplicado"] * n)):
        if not livres:
            break
        linha = linhas[livres.pop()]
        copias.append(dict(linha))
        gabarito.append({"tabela": tabela, "id_registro": linha["id_registro"],
                         "codigo_estudante": linha["codigo_estudante"], "tipo_erro": "duplicado",
                         "coluna": "id_registro", "valor_com_erro": "", "valor_original": linha["id_registro"],
                         "acao_esperada": "remover", "valor_esperado": ""})
    for copia in copias:
        linhas.insert(rng.randrange(len(linhas) + 1), copia)
    return marcados


def construir_esperado(limpas, marcados):
    """O que um tratamento correto deve entregar a partir da base com erros."""
    saida = []
    for linha in limpas:
        marca = marcados.get(linha["id_registro"])
        if marca:
            acao, coluna, esperado = marca
            if acao == "remover":
                continue
            if acao in ("preencher", "sinalizar"):
                linha = dict(linha)
                linha[coluna] = esperado
        saida.append(linha)
    return saida


def aplicar_erros(p, limpas):
    """Devolve (brutas, esperadas, gabarito). Sem erros ativos, as três coisas coincidem."""
    if not p("erros.ativar"):
        copia = {k: [dict(l) for l in v] for k, v in limpas.items()}
        return copia, {k: [dict(l) for l in v] for k, v in limpas.items()}, []
    rng = rng_de(p("geral.semente"), "erros")
    gabarito = []

    # chaves que não batem: algumas linhas simplesmente não existem em uma das bases
    n_est, n_ren = p("erros.estudantes_sem_estudos"), p("erros.estudantes_sem_renda")
    codigos = [l["codigo_estudante"] for l in limpas["estudantes"]]
    sorteados = rng.sample(codigos, n_est + n_ren)
    grupos = {"estudos": sorteados[:n_est], "renda": sorteados[n_est:]}
    base = {k: [dict(l) for l in v] for k, v in limpas.items()}
    for tabela, grupo in grupos.items():
        base[tabela] = [l for l in base[tabela] if l["codigo_estudante"] not in grupo]
        for cod in grupo:
            gabarito.append({"tabela": tabela, "id_registro": "", "codigo_estudante": cod, "tipo_erro": "chave_sem_par",
                             "coluna": "codigo_estudante", "valor_com_erro": f"ausente em {tabela}",
                             "valor_original": cod, "acao_esperada": "sinalizar", "valor_esperado": ""})

    brutas = {k: [dict(l) for l in v] for k, v in base.items()}
    marcados_g = plantar(rng, "gastos", brutas["gastos"], REGRAS_GASTOS, p("erros.taxas_gastos"), gabarito)
    marcados_e = plantar(rng, "estudos", brutas["estudos"], REGRAS_ESTUDOS, p("erros.taxas_estudos"), gabarito)
    esperadas = {k: [dict(l) for l in v] for k, v in base.items()}
    esperadas["gastos"] = construir_esperado(base["gastos"], marcados_g)
    esperadas["estudos"] = construir_esperado(base["estudos"], marcados_e)
    return brutas, esperadas, gabarito


# ---------------------------------------------------------------- saída e diagnóstico
def escrever_csv(caminho, colunas, linhas):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=colunas, lineterminator="\n")
        w.writeheader()
        w.writerows(linhas)


def escrever_tudo(saida, brutas, esperadas, gabarito):
    for nome, colunas in COLUNAS.items():
        escrever_csv(saida / "bases" / f"{nome}.csv", colunas, brutas[nome])
        escrever_csv(saida / "esperado" / f"{nome}.csv", colunas, esperadas[nome])
    escrever_csv(saida / "gabarito_erros.csv", COLUNAS_GABARITO, gabarito)


def diagnostico(estudantes, limpas):
    """Correlações (r de Pearson) entre estudantes, só para a equipe ver o efeito das premissas."""
    horas, notas = {}, {}
    for l in limpas["estudos"]:
        horas.setdefault(l["codigo_estudante"], []).append(float(l["horas_semana"]))
        notas.setdefault(l["codigo_estudante"], []).append(float(l["nota"]))
    saldo = razao_saldo(limpas["renda"], limpas["gastos"])
    cods = [e["codigo"] for e in estudantes]
    lazer = [e["parcelas"]["lazer"] for e in estudantes]
    credito = [e["p_credito"] for e in estudantes]
    h = [mean(horas[c]) for c in cods]
    n = [mean(notas[c]) for c in cods]
    s = [saldo[c] for c in cods]
    return {
        "H1 lazer x horas de estudo": correlation(lazer, h),
        "H2 saldo x nota media": correlation(s, n),
        "H3 uso do credito x saldo": correlation(credito, s),
        "horas de estudo x nota media": correlation(h, n),
    }


def main(argv=None):
    pasta = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description="Gera as bases simuladas do projeto Sobrou o Quê?")
    ap.add_argument("--premissas", default=str(pasta / "premissas.json"), help="arquivo de premissas")
    ap.add_argument("--saida", default=str(pasta), help="pasta onde criar bases/, esperado/ e gabarito_erros.csv")
    ap.add_argument("--sem-erros", action="store_true", help="gera as bases sem os erros plantados")
    ap.add_argument("--definir", action="append", default=[], metavar="CHAVE=VALOR",
                    help="muda uma premissa (valor em JSON), ex.: cruzado.saldo_na_nota=1")
    ap.add_argument("--documentar", action="store_true", help="imprime a tabela de premissas em Markdown e sai")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # o terminal do Windows usa outra codificação por padrão

    p = Premissas.carregar(args.premissas, args.definir)
    if args.sem_erros:
        p.itens["erros.ativar"]["valor"] = False
    if args.documentar:
        print(p.documentar())
        return 0

    estudantes, limpas = gerar(p)
    brutas, esperadas, gabarito = aplicar_erros(p, limpas)
    saida = Path(args.saida)
    escrever_tudo(saida, brutas, esperadas, gabarito)

    print(f"Bases escritas em {saida}")
    for nome in COLUNAS:
        print(f"  {nome:<11} bruta: {len(brutas[nome]):>6} linhas | esperada: {len(esperadas[nome]):>6} linhas")
    print(f"  erros plantados (gabarito): {len(gabarito)}")
    print("Correlações entre estudantes (informativo; com as ligações desligadas, devem ficar perto de zero):")
    for nome, r in diagnostico(estudantes, limpas).items():
        print(f"  r = {r:+.2f}   {nome}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
