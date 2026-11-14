#!/usr/bin/env python3
"""Converte um estudante simulado das bases tratadas (dados/esperado/) para o formato do app e escreve js/demo.js.

É o que o botão "Ver com dados de exemplo" carrega. O arquivo js/demo.js existe porque o site abre com duplo clique
(file://), e o navegador não deixa um site assim ler os CSVs.

Uso:
    python dados/gerar_demo.py              # regenera js/demo.js
    python dados/gerar_demo.py --estudante E023   # força outro estudante (padrão: escolhido por regra)

O estudante padrão é escolhido por uma regra, e não à mão, para o exemplo mostrar os recursos do app:
6 meses completos, exatamente 1 mês no vermelho, sobra média positiva, 5 a 12 horas de estudo por semana,
pelo menos 2 gastos fixos e relação entre horas e nota que não seja negativa (as bases simulam que mais horas
elevam a nota de leve, premissa efeitos.horas_na_nota; um exemplo que mostrasse "mais horas, notas menores"
pareceria defeito do site, e com 6 meses isso é só acaso do sorteio). Entre os que cumprem, vale a maior sobra
média (desempate: menor código).

Só usa a biblioteca padrão do Python. Os dados são fictícios.
"""
import argparse
import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ESPERADO = RAIZ / "dados" / "esperado"
SAIDA = RAIZ / "js" / "demo.js"

ROTULO = {"alimentacao": "Alimentação", "transporte": "Transporte", "lazer": "Lazer",
          "assinaturas": "Assinatura", "estudos": "Material de estudo", "outros": "Outros",
          "nao_informado": "Sem categoria"}  # nao_informado: o tratamento das bases preenche assim a categoria vazia


def _cat(c):
    """Categoria no app: o app não tem "nao_informado", o lugar dele é "outros"."""
    return "outros" if c == "nao_informado" else c
PAGAMENTO = {"dinheiro": "dinheiro", "pix": "pix", "debito": "débito", "credito": "crédito"}
# as bases guardam as matérias em minúsculas e sem acento (listas fixas, para o tratamento não confundir "Mat." com
# "Matemática"); no app elas aparecem para a pessoa, então o exemplo usa o nome escrito direito
MATERIAS = {"matematica": "Matemática", "portugues": "Português", "historia": "História", "geografia": "Geografia",
            "biologia": "Biologia", "fisica": "Física", "quimica": "Química", "ingles": "Inglês",
            "programacao": "Programação", "banco_de_dados": "Banco de dados", "redes": "Redes", "gestao": "Gestão",
            "calculo": "Cálculo", "estatistica": "Estatística", "algoritmos": "Algoritmos"}
HORAS_TIPICAS = (5, 12)  # horas de estudo por semana: "a maioria estuda entre 5 e 15" (Blueprint), sem os extremos


def _ler(pasta, nome):
    with open(Path(pasta) / f"{nome}.csv", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _brl(v):
    return f"{v:.2f}".replace(".", ",")


def _modelos(gastos, meses):
    """Gastos fixos que se repetem todo mês: mesma categoria, mesmo valor, mesmo dia, uma vez por mês."""
    grupos = defaultdict(list)
    for g in gastos:
        if g["tipo_gasto"] == "fixo":
            grupos[(g["categoria"], round(float(g["valor"]), 2), int(g["data_gasto"][-2:]))].append(g["mes_referencia"])
    return [k for k, ms in sorted(grupos.items()) if sorted(ms) == list(meses)]


def _semanas(total):
    """Horas por semana do mês em 4 semanas de 8 posições (o app usa 7 dias + 1 posição sem dia), em meias horas,
    de segunda a sexta. A média das 4 semanas é o total arredondado para meia hora."""
    unidades = int(round(total * 2))
    out = []
    for deslocamento in (0, 1, -1, 0):  # as semanas variam um pouco, sem mudar a média
        base, resto = divmod(max(0, unidades + deslocamento), 5)
        dias = [0] * 8
        for k in range(5):
            dias[1 + k] = (base + (1 if k < resto else 0)) / 2
        out.append(dias)
    return out


def _escolher(pasta, meses):
    renda = defaultdict(dict)
    for r in _ler(pasta, "renda"):
        renda[r["codigo_estudante"]][r["mes_referencia"]] = float(r["renda"])
    gastos, estudos = defaultdict(list), defaultdict(list)
    for g in _ler(pasta, "gastos"):
        gastos[g["codigo_estudante"]].append(g)
    for e in _ler(pasta, "estudos"):
        estudos[e["codigo_estudante"]].append(e)
    melhor = None
    for cod in sorted(renda):
        if sorted(renda[cod]) != list(meses):
            continue
        gasto_mes = {m: sum(float(g["valor"]) for g in gastos[cod] if g["mes_referencia"] == m) for m in meses}
        horas_mes = {m: sum(float(e["horas_semana"]) for e in estudos[cod] if e["mes_referencia"] == m) for m in meses}
        if any(gasto_mes[m] <= 0 or horas_mes[m] <= 0 for m in meses):
            continue
        sobras = [renda[cod][m] - gasto_mes[m] for m in meses]
        media_h = sum(horas_mes.values()) / len(meses)
        if sum(1 for s in sobras if s < 0) != 1 or sum(sobras) <= 0 or not HORAS_TIPICAS[0] <= media_h <= HORAS_TIPICAS[1]:
            continue
        if len(_modelos(gastos[cod], meses)) < 2:
            continue
        # horas x nota não negativa, com as mesmas horas (em meias horas) que o exemplo mostra
        notas_mes = {m: [float(e["nota"]) for e in estudos[cod] if e["mes_referencia"] == m and e["nota"] != ""] for m in meses}
        if any(not notas_mes[m] for m in meses):
            continue
        horas = [int(round(horas_mes[m] * 2)) / 2 for m in meses]
        notas = [sum(notas_mes[m]) / len(notas_mes[m]) for m in meses]
        mh, mn = sum(horas) / len(meses), sum(notas) / len(meses)
        if sum((h - mh) * (n - mn) for h, n in zip(horas, notas)) < 0:
            continue
        media_s = sum(sobras) / len(meses)
        if melhor is None or media_s > melhor[0]:
            melhor = (media_s, cod)
    if melhor is None:
        raise SystemExit("Nenhum estudante cumpre a regra do exemplo. Confira dados/esperado/.")
    return melhor[1]


def construir(pasta=ESPERADO, estudante=None):
    """Devolve o estudante de exemplo no formato do app: renda, gastos, horas e notas dos 6 meses,
    gastos fixos (modelos), orçamento e meta de reserva."""
    meses = sorted({r["mes_referencia"] for r in _ler(pasta, "renda")})
    cod = estudante or _escolher(pasta, meses)
    nivel = next(e["nivel_ensino"] for e in _ler(pasta, "estudantes") if e["codigo_estudante"] == cod)
    renda = {r["mes_referencia"]: float(r["renda"]) for r in _ler(pasta, "renda") if r["codigo_estudante"] == cod}
    gastos = sorted((g for g in _ler(pasta, "gastos") if g["codigo_estudante"] == cod),
                    key=lambda g: (g["data_gasto"], g["id_registro"]))
    estudos = [e for e in _ler(pasta, "estudos") if e["codigo_estudante"] == cod]

    modelos = _modelos(gastos, meses)
    recorrentes = [{"id": f"f{n}", "desc": f"Fixo: {ROTULO[cat].lower()} R$ {_brl(v)}", "v": v, "d": dia, "cat": _cat(cat)}
                   for n, (cat, v, dia) in enumerate(modelos, 1)]
    id_modelo = {k: f"f{n}" for n, k in enumerate(modelos, 1)}

    months, gasto_cat_mes, horas_totais = [], defaultdict(lambda: defaultdict(float)), []
    for i, mes in enumerate(meses):
        itens = []
        for g in (x for x in gastos if x["mes_referencia"] == mes):
            cat, v, dia = g["categoria"], round(float(g["valor"]), 2), int(g["data_gasto"][-2:])
            chave = (cat, v, dia)
            it = {"id": f"g{i}-{len(itens) + 1:03d}", "d": dia, "cat": _cat(cat), "v": v}
            if g["tipo_gasto"] == "fixo" and chave in id_modelo:
                it["desc"] = next(t["desc"] for t in recorrentes if t["id"] == id_modelo[chave])
                it["rid"] = id_modelo[chave]
            else:
                it["desc"] = f"{ROTULO[cat]} ({PAGAMENTO[g['forma_pagamento']]})"
            itens.append(it)
            gasto_cat_mes[_cat(cat)][mes] += v
        est_mes = [e for e in estudos if e["mes_referencia"] == mes]
        horas = sum(float(e["horas_semana"]) for e in est_mes)
        horas_totais.append(horas)
        notas = [{"id": f"n{i}-{k + 1}", "subj": MATERIAS.get(e["materia"], e["materia"].replace("_", " ").capitalize()), "v": float(e["nota"]),
                  "label": "Avaliação do mês"} for k, e in enumerate(est_mes) if e["nota"] != ""]
        months.append({"renda": renda[mes], "items": itens, "weeks": _semanas(horas), "grades": notas})

    def pico(cat):
        return max(gasto_cat_mes[cat].values(), default=0)

    orcamento = {}
    if pico("lazer") > 0:  # limite logo abaixo do pico: pelo menos um mês passa, para o exemplo mostrar o aviso
        orcamento["lazer"] = max(5, math.floor(0.9 * pico("lazer") / 5) * 5)
    if pico("alimentacao") > 0:  # folga de 10% acima do pico: fica "perto", mas não passa
        orcamento["alimentacao"] = math.ceil(1.1 * pico("alimentacao") / 5) * 5
    media_gastos = sum(sum(it["v"] for it in m["items"]) for m in months) / len(months)
    return {
        "estudante": cod, "nivel": nivel,
        "meta": min(30, max(2, round(sum(horas_totais) / len(horas_totais)))),
        "reserva": max(50, round(3 * media_gastos / 50) * 50),
        "budget": orcamento, "recurring": recorrentes, "months": months,
    }


def para_js(demo):
    """Texto de js/demo.js: um mês por linha, para o diff no git ficar legível."""
    topo = {k: demo[k] for k in ("estudante", "nivel", "meta", "reserva", "budget", "recurring")}
    cabeca = json.dumps(topo, ensure_ascii=False, separators=(",", ":"))[:-1]
    meses = ",\n".join(json.dumps(m, ensure_ascii=False, separators=(",", ":")) for m in demo["months"])
    return (f"/* GERADO por dados/gerar_demo.py a partir de dados/esperado/ (estudante simulado {demo['estudante']}).\n"
            "   Não edite à mão: rode  python dados/gerar_demo.py\n"
            "   Os 6 meses estão em ordem: o primeiro vai para o mês mais antigo da janela do site, o último para o mês atual. */\n"
            f"(function(){{window.Sobrou=window.Sobrou||{{}};window.Sobrou.DEMO={cabeca},\"months\":[\n{meses}\n]}};}})();\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Gera js/demo.js (estudante de exemplo) a partir de dados/esperado/.")
    ap.add_argument("--esperado", default=str(ESPERADO), help="pasta com as bases tratadas")
    ap.add_argument("--saida", default=str(SAIDA), help="arquivo js a escrever")
    ap.add_argument("--estudante", help="código do estudante (padrão: escolhido pela regra do exemplo)")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # o console do Windows usa outra codificação e estragaria os acentos
    demo = construir(args.esperado, args.estudante)
    Path(args.saida).write_text(para_js(demo), encoding="utf-8", newline="\n")
    sobras = [m["renda"] - sum(it["v"] for it in m["items"]) for m in demo["months"]]
    print(f"{args.saida}: estudante {demo['estudante']} ({demo['nivel']}), {sum(len(m['items']) for m in demo['months'])} gastos, "
          f"{len(demo['recurring'])} fixos, sobra média R$ {sum(sobras) / 6:.2f}")


if __name__ == "__main__":
    main()
