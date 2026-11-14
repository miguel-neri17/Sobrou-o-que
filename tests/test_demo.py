"""Testes do conversor dos dados de exemplo (dados/gerar_demo.py).

O conversor lê dados/esperado/ (as bases já tratadas) e escreve js/demo.js, o estudante simulado que o botão
"Ver com dados de exemplo" carrega. Rodam com:  python -m unittest discover -s tests -p "test_*.py"
Só usam a biblioteca padrão do Python.
"""
import importlib.util
import re
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_ESPEC = importlib.util.spec_from_file_location("gerar_demo", RAIZ / "dados" / "gerar_demo.py")
gd = importlib.util.module_from_spec(_ESPEC)
_ESPEC.loader.exec_module(gd)

ESPERADO = RAIZ / "dados" / "esperado"
CATEGORIAS = {"alimentacao", "transporte", "lazer", "assinaturas", "estudos", "outros"}
ID_SEGURO = re.compile(r"^[A-Za-z0-9_-]{1,60}$")  # o mesmo que o storage.js aceita


def acima_do_limite(demo, i):
    """Categorias com orçamento que passaram do limite no mês i."""
    gasto = {}
    for it in demo["months"][i]["items"]:
        gasto[it["cat"]] = gasto.get(it["cat"], 0) + it["v"]
    return [c for c, lim in demo["budget"].items() if gasto.get(c, 0) > lim]


class TestDemo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.demo = gd.construir(ESPERADO)

    def test_estrutura(self):
        d = self.demo
        self.assertRegex(d["estudante"], r"^E\d{3}$")
        self.assertIn(d["nivel"], {"universitario", "tecnico", "medio"})
        self.assertEqual(len(d["months"]), 6)
        self.assertTrue(2 <= d["meta"] <= 30)
        self.assertTrue(d["reserva"] > 0)
        self.assertIsInstance(d["budget"], dict)
        self.assertIsInstance(d["recurring"], list)

    def test_meses_completos(self):
        for i, m in enumerate(self.demo["months"]):
            with self.subTest(mes=i):
                self.assertGreater(m["renda"], 0)
                self.assertGreater(len(m["items"]), 0)
                self.assertGreater(len(m["grades"]), 0)
                self.assertEqual(len(m["weeks"]), 4)
                self.assertTrue(all(len(w) == 8 for w in m["weeks"]))

    def test_respeita_os_limites_do_app(self):
        """O storage.js descarta o que passa destes limites ao carregar: o exemplo não pode depender disso."""
        ids = set()
        for m in self.demo["months"]:
            self.assertLessEqual(len(m["items"]), 5000)
            for it in m["items"]:
                self.assertTrue(1 <= it["d"] <= 31 and isinstance(it["d"], int))
                self.assertIn(it["cat"], CATEGORIAS)
                self.assertTrue(1 <= len(it["desc"]) <= 40)
                self.assertTrue(0.01 <= it["v"] <= 1e9)
                self.assertRegex(it["id"], ID_SEGURO)
                self.assertNotIn(it["id"], ids)
                ids.add(it["id"])
            for w in m["weeks"]:
                for h in w:
                    self.assertTrue(0 <= h <= 168 and h * 2 == int(h * 2), h)
            for g in m["grades"]:
                self.assertTrue(0 <= g["v"] <= 10)
                self.assertTrue(1 <= len(g["subj"]) <= 40 and len(g["label"]) <= 30)
        rec = self.demo["recurring"]
        self.assertLessEqual(len(rec), 100)
        for t in rec:
            self.assertRegex(t["id"], ID_SEGURO)
            self.assertIn(t["cat"], CATEGORIAS)
            self.assertTrue(1 <= len(t["desc"]) <= 40 and 1 <= t["d"] <= 31 and 0.01 <= t["v"] <= 1e9)
        rids = {it["rid"] for m in self.demo["months"] for it in m["items"] if "rid" in it}
        self.assertTrue(rids <= {t["id"] for t in rec}, "todo rid aponta para um modelo existente")

    def test_mostra_os_recursos_do_app(self):
        d = self.demo
        sobras = [m["renda"] - sum(it["v"] for it in m["items"]) for m in d["months"]]
        self.assertEqual(sum(1 for s in sobras if s < 0), 1, "exatamente um mês no vermelho")
        self.assertGreater(sum(sobras) / 6, 0, "mas a sobra média é positiva")
        self.assertGreaterEqual(len(d["recurring"]), 2, "gastos fixos para a 2b")
        for t in d["recurring"]:
            n = sum(1 for m in d["months"] for it in m["items"] if it.get("rid") == t["id"])
            self.assertEqual(n, 6, "cada gasto fixo aparece nos 6 meses")
        self.assertTrue(d["budget"], "orçamento definido")
        self.assertTrue(any(acima_do_limite(d, i) for i in range(6)), "ao menos um mês passa do orçamento")
        com_nota = sum(1 for m in d["months"] if m["grades"] and any(any(w) for w in m["weeks"]))
        self.assertGreaterEqual(com_nota, 4, "meses com horas e nota para o gráfico e o coeficiente da Análise")

    def test_horas_e_nota_nao_contradizem_a_premissa(self):
        """As bases simulam que mais horas elevam a nota de leve (efeitos.horas_na_nota > 0). Um exemplo que mostrasse
        "mais horas, notas menores" pareceria defeito do site, então o estudante é escolhido com relação não negativa."""
        horas = [sum(sum(w) for w in m["weeks"]) / 4 for m in self.demo["months"]]
        notas = [sum(g["v"] for g in m["grades"]) / len(m["grades"]) for m in self.demo["months"]]
        mh, mn = sum(horas) / 6, sum(notas) / 6
        cov = sum((h - mh) * (n - mn) for h, n in zip(horas, notas))
        self.assertGreaterEqual(cov, 0)

    def test_bate_com_as_bases(self):
        import csv
        def linhas(nome):
            with open(ESPERADO / f"{nome}.csv", encoding="utf-8", newline="") as f:
                return list(csv.DictReader(f))

        gastos = {}
        for r in linhas("gastos"):
            if r["codigo_estudante"] == self.demo["estudante"]:
                gastos[r["mes_referencia"]] = gastos.get(r["mes_referencia"], 0) + float(r["valor"])
        meses = sorted(gastos)
        for i, m in enumerate(self.demo["months"]):
            self.assertAlmostEqual(sum(it["v"] for it in m["items"]), gastos[meses[i]], places=1)
        horas = {}
        for r in linhas("estudos"):
            if r["codigo_estudante"] == self.demo["estudante"]:
                horas[r["mes_referencia"]] = horas.get(r["mes_referencia"], 0) + float(r["horas_semana"])
        for i, m in enumerate(self.demo["months"]):
            media = sum(sum(w) for w in m["weeks"]) / 4
            self.assertLessEqual(abs(media - horas[meses[i]]), 0.25 + 1e-9, "horas por semana, em meias horas")

    def test_deterministico(self):
        self.assertEqual(gd.construir(ESPERADO), self.demo)

    def test_demo_js_esta_atualizado(self):
        """js/demo.js é gerado: se as bases ou o conversor mudarem, rode  python dados/gerar_demo.py"""
        atual = (RAIZ / "js" / "demo.js").read_text(encoding="utf-8")
        self.assertEqual(atual, gd.para_js(self.demo))


if __name__ == "__main__":
    unittest.main()
