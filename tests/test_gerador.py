"""Testes do gerador de bases simuladas (dados/gerar_bases.py).

Rodam com:  python -m unittest discover -s tests -p "test_*.py"
Só usam a biblioteca padrão do Python.
"""
import csv
import importlib.util
import tempfile
import unittest
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_ESPEC = importlib.util.spec_from_file_location("gerar_bases", RAIZ / "dados" / "gerar_bases.py")
gb = importlib.util.module_from_spec(_ESPEC)
_ESPEC.loader.exec_module(gb)
PREMISSAS = RAIZ / "dados" / "premissas.json"
DICIONARIO = RAIZ / "dados" / "DICIONARIO.md"


def premissas(*definir):
    return gb.Premissas.carregar(PREMISSAS, definir)


def gerar_tudo(*definir):
    p = premissas(*definir)
    estudantes, limpas = gb.gerar(p)
    brutas, esperadas, gabarito = gb.aplicar_erros(p, limpas)
    return p, estudantes, limpas, brutas, esperadas, gabarito


class TestBasesPadrao(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p, cls.est, cls.limpas, cls.brutas, cls.esperadas, cls.gab = gerar_tudo()
        cls.niveis = {l["codigo_estudante"]: l["nivel_ensino"] for l in cls.limpas["estudantes"]}

    # ---- tamanho e validade dos dados limpos
    def test_tamanhos(self):
        n, meses = self.p("geral.estudantes"), self.p("geral.meses")
        self.assertEqual(len(self.limpas["estudantes"]), n)
        self.assertEqual(len(self.limpas["renda"]), n * meses)
        self.assertEqual(len(self.limpas["estudos"]), n * meses * self.p("estudos.materias_por_estudante"))
        self.assertGreater(len(self.limpas["gastos"]), 10000)

    def test_codigos_de_registro_sao_unicos(self):
        for tabela in ("gastos", "estudos"):
            ids = [l["id_registro"] for l in self.limpas[tabela]]
            self.assertEqual(len(ids), len(set(ids)), tabela)

    def test_dados_limpos_dentro_das_faixas(self):
        for g in self.limpas["gastos"]:
            self.assertIn(g["categoria"], gb.CATEGORIAS)
            self.assertIn(g["forma_pagamento"], ("dinheiro", "pix", "debito", "credito"))
            self.assertIn(g["tipo_gasto"], ("fixo", "variavel"))
            self.assertTrue(0.01 <= float(g["valor"]) <= 2000, g)
            self.assertTrue(g["data_gasto"].startswith(g["mes_referencia"] + "-"), g)
            if g["categoria"] == "assinaturas":
                self.assertNotEqual(g["forma_pagamento"], "dinheiro")
        for r in self.limpas["renda"]:
            self.assertTrue(0 <= float(r["renda"]) <= 5000, r)
        permitidas = self.p("estudos.materias_por_nivel")
        for e in self.limpas["estudos"]:
            self.assertTrue(0 <= float(e["nota"]) <= 10, e)
            self.assertTrue(0 <= float(e["horas_semana"]) <= 40, e)
            self.assertIn(e["metodo_estudo"], gb.METODOS)
            self.assertIn(e["materia"], permitidas[self.niveis[e["codigo_estudante"]]])

    def test_so_ascii_nos_arquivos_com_erros(self):
        for tabela, linhas in self.brutas.items():
            for l in linhas:
                for v in l.values():
                    self.assertTrue(v.isascii(), (tabela, v))

    # ---- erros plantados
    def test_quantidade_de_erros_segue_as_taxas(self):
        orfaos = {g["codigo_estudante"] for g in self.gab if g["tipo_erro"] == "chave_sem_par" and g["tabela"] == "estudos"}
        n_base = {
            "gastos": len(self.limpas["gastos"]),
            "estudos": len([l for l in self.limpas["estudos"] if l["codigo_estudante"] not in orfaos]),
        }
        taxas = {"gastos": self.p("erros.taxas_gastos"), "estudos": self.p("erros.taxas_estudos")}
        for tabela in ("gastos", "estudos"):
            contagem = Counter(g["tipo_erro"] for g in self.gab if g["tabela"] == tabela)
            for tipo, taxa in taxas[tabela].items():
                self.assertEqual(contagem[tipo], round(taxa * n_base[tabela]), f"{tabela}/{tipo}")

    def test_cada_erro_do_gabarito_existe_no_arquivo_bruto(self):
        for tabela in ("gastos", "estudos"):
            por_id = {}
            for l in self.brutas[tabela]:
                por_id.setdefault(l["id_registro"], []).append(l)
            # chave_sem_par não tem linha para procurar (a linha não existe): é conferida em test_chaves_sem_par
            for g in (x for x in self.gab if x["tabela"] == tabela and x["tipo_erro"] != "chave_sem_par"):
                linhas = por_id[g["id_registro"]]
                if g["tipo_erro"] == "duplicado":
                    self.assertEqual(len(linhas), 2, g)
                else:
                    self.assertEqual(linhas[0][g["coluna"]], g["valor_com_erro"], g)

    def test_chaves_sem_par(self):
        com_gasto = {l["codigo_estudante"] for l in self.brutas["gastos"]}
        com_estudo = {l["codigo_estudante"] for l in self.brutas["estudos"]}
        com_renda = {l["codigo_estudante"] for l in self.brutas["renda"]}
        self.assertEqual(len(com_gasto - com_estudo), self.p("erros.estudantes_sem_estudos"))
        self.assertEqual(len(com_gasto - com_renda), self.p("erros.estudantes_sem_renda"))
        registrados = {(g["tabela"], g["codigo_estudante"]) for g in self.gab if g["tipo_erro"] == "chave_sem_par"}
        self.assertEqual(registrados, {("estudos", c) for c in com_gasto - com_estudo} | {("renda", c) for c in com_gasto - com_renda})

    # ---- o que um tratamento correto deve entregar
    def test_esperado_nao_tem_o_que_deveria_ser_removido(self):
        for tabela in ("gastos", "estudos"):
            a_remover = {g["id_registro"] for g in self.gab
                         if g["tabela"] == tabela and g["acao_esperada"] == "remover" and g["tipo_erro"] != "duplicado"}
            ids = [l["id_registro"] for l in self.esperadas[tabela]]
            self.assertFalse(a_remover & set(ids))
            self.assertEqual(len(ids), len(set(ids)), "esperado sem duplicados")

    def test_esperado_tem_os_valores_corrigidos(self):
        nao_informado = sum(1 for l in self.esperadas["gastos"] if l["categoria"] == "nao_informado")
        self.assertEqual(nao_informado, sum(1 for g in self.gab if g["tipo_erro"] == "categoria_vazia"))
        sem_nota = sum(1 for l in self.esperadas["estudos"] if l["nota"] == "")
        self.assertEqual(sem_nota, sum(1 for g in self.gab if g["tipo_erro"] == "nota_vazia"))
        for l in self.esperadas["gastos"]:
            self.assertIn(l["categoria"], gb.CATEGORIAS + ["nao_informado"])
            self.assertTrue(0.01 <= float(l["valor"]) <= 2000, l)
            self.assertRegex(l["data_gasto"], r"^\d{4}-\d{2}-\d{2}$")
            self.assertRegex(l["mes_referencia"], r"^\d{4}-\d{2}$")

    # ---- honestidade da base: sem ligação embutida entre dinheiro e notas
    def test_ligacao_entre_areas_vem_desligada(self):
        r = gb.diagnostico(self.est, self.limpas)
        for nome in ("H1 lazer x horas de estudo", "H2 saldo x nota media", "H3 uso do credito x saldo"):
            self.assertLess(abs(r[nome]), 0.25, f"{nome}: r={r[nome]:+.2f}")
        self.assertGreater(r["horas de estudo x nota media"], 0.0, "a relação interna a Estudos é uma premissa declarada")


class TestSensibilidade(unittest.TestCase):
    def test_ligar_um_peso_cria_a_relacao_correspondente(self):
        casos = [
            ("cruzado.saldo_na_nota=3", "H2 saldo x nota media", 1),
            ("cruzado.lazer_nas_horas=3", "H1 lazer x horas de estudo", -1),
            ("cruzado.credito_no_gasto=3", "H3 uso do credito x saldo", -1),
        ]
        for definir, nome, sinal in casos:
            _, est, limpas, *_ = gerar_tudo(definir)
            r = gb.diagnostico(est, limpas)[nome]
            self.assertGreater(sinal * r, 0.3, f"{definir}: r={r:+.2f}")

    def test_mudar_uma_premissa_nao_muda_os_outros_sorteios(self):
        _, _, base, *_ = gerar_tudo()
        _, _, mudada, *_ = gerar_tudo("cruzado.saldo_na_nota=1")
        self.assertEqual(base["renda"], mudada["renda"])
        self.assertEqual(base["gastos"], mudada["gastos"])
        self.assertNotEqual(base["estudos"], mudada["estudos"])

    def test_mesma_semente_gera_as_mesmas_bases(self):
        a = gerar_tudo()
        b = gerar_tudo()
        self.assertEqual(a[2], b[2])
        self.assertEqual(a[3], b[3])
        self.assertEqual(a[5], b[5])

    def test_outra_semente_gera_outra_populacao(self):
        _, _, a, *_ = gerar_tudo()
        _, _, b, *_ = gerar_tudo("geral.semente=7")
        self.assertNotEqual(a["gastos"], b["gastos"])

    def test_sem_erros_as_tres_versoes_coincidem(self):
        p = premissas()
        p.itens["erros.ativar"]["valor"] = False
        _, limpas = gb.gerar(p)
        brutas, esperadas, gabarito = gb.aplicar_erros(p, limpas)
        self.assertEqual(brutas, limpas)
        self.assertEqual(esperadas, limpas)
        self.assertEqual(gabarito, [])

    def test_premissa_desconhecida_e_recusada(self):
        with self.assertRaises(SystemExit):
            premissas("nao.existe=1")
        with self.assertRaises(SystemExit):
            premissas("geral.semente=abc")


class TestArquivos(unittest.TestCase):
    def test_escreve_e_le_de_volta(self):
        _, _, limpas, brutas, esperadas, gabarito = gerar_tudo()
        with tempfile.TemporaryDirectory() as pasta:
            saida = Path(pasta)
            gb.escrever_tudo(saida, brutas, esperadas, gabarito)
            for nome, colunas in gb.COLUNAS.items():
                for sub, tabelas in (("bases", brutas), ("esperado", esperadas)):
                    caminho = saida / sub / f"{nome}.csv"
                    bruto = caminho.read_bytes()
                    self.assertNotIn(b"\r", bruto, "quebras de linha só com LF")
                    with open(caminho, newline="", encoding="utf-8") as f:
                        linhas = list(csv.DictReader(f))
                    self.assertEqual(list(linhas[0].keys()), colunas)
                    self.assertEqual(len(linhas), len(tabelas[nome]))
            with open(saida / "gabarito_erros.csv", newline="", encoding="utf-8") as f:
                self.assertEqual(len(list(csv.DictReader(f))), len(gabarito))

    def test_documentacao_cita_todas_as_premissas(self):
        texto = DICIONARIO.read_text(encoding="utf-8")
        faltando = [k for k in premissas().itens if f"`{k}`" not in texto]
        self.assertEqual(faltando, [], "premissas que faltam no DICIONARIO.md (rode --documentar)")

    def test_bases_versionadas_tem_as_colunas_do_dicionario(self):
        for nome, colunas in gb.COLUNAS.items():
            for sub in ("bases", "esperado"):
                caminho = RAIZ / "dados" / sub / f"{nome}.csv"
                self.assertTrue(caminho.exists(), caminho)
                with open(caminho, newline="", encoding="utf-8") as f:
                    self.assertEqual(next(csv.reader(f)), colunas, caminho)


if __name__ == "__main__":
    unittest.main()
