"""Leitura do "Relatorio_Chamados.xlsx" exportado pelo sistema de chamados.

So biblioteca padrao (zipfile + xml): o servidor nao precisa de openpyxl.
As colunas sao reconhecidas pelo nome do cabecalho, nao pela posicao.
O texto dos tramites passa por mascarar_senhas antes de ser guardado: o sistema de
chamados registra senhas temporarias em texto aberto.
"""
import re, zipfile, unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# cabecalho normalizado -> campo
COLUNAS = {
    "id": "id", "assunto": "assunto", "descricao": "descricao", "colaborador": "colaborador",
    "revenda": "revenda", "tipo": "tipo", "categoria": "categoria", "detalhes": "detalhe",
    "data criado": "data_criado", "horario criado": "hora_criado",
    "data encerrado": "data_encerrado", "horario finalizado": "hora_encerrado",
    "data prazo": "prazo", "sla": "sla", "responsavel": "responsavel", "status": "status",
    "avaliacao": "avaliacao", "tramites": "tramites",
}
OBRIGATORIAS = ["id", "data_criado", "hora_criado", "categoria", "status"]


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


def _limpo(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def _col(ref):
    return re.match(r"[A-Z]+", ref).group()


def _ler_planilha(caminho_ou_arquivo):
    z = zipfile.ZipFile(caminho_ou_arquivo)
    nomes = set(z.namelist())
    ss = []
    if "xl/sharedStrings.xml" in nomes:
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(NS + "si"):
            ss.append("".join(t.text or "" for t in si.iter(NS + "t")))
    # Primeira aba do arquivo, pelo relacionamento do workbook
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    aba = wb.find(NS + "sheets")[0]
    rid = aba.get(NS_REL + "id")
    alvo = "worksheets/sheet1.xml"
    if "xl/_rels/workbook.xml.rels" in nomes:
        for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")):
            if rel.get("Id") == rid: alvo = rel.get("Target").lstrip("/").replace("xl/", "", 1)
    root = ET.fromstring(z.read("xl/" + alvo))
    linhas = []
    for r in root.iter(NS + "row"):
        linha = {}
        for c in r.findall(NS + "c"):
            v = c.find(NS + "v"); t = c.get("t")
            if t == "s": val = ss[int(v.text)] if v is not None else ""
            elif t == "inlineStr": val = "".join(x.text or "" for x in c.iter(NS + "t"))
            else: val = v.text if v is not None else ""
            linha[_col(c.get("r"))] = val
        linhas.append(linha)
    return linhas


def _data(valor, hora=""):
    """dd/mm/aaaa [HH:MM] em texto, ou numero de serie do Excel -> 'AAAA-MM-DD HH:MM:SS' (hora local)."""
    valor = str(valor or "").strip(); hora = str(hora or "").strip()
    if not valor: return None
    try:
        n = float(valor)
        d = datetime(1899, 12, 30) + timedelta(days=n)
        if hora:
            try:
                h = float(hora); d = d.replace(hour=0, minute=0, second=0) + timedelta(days=h)
            except ValueError:
                hh, mm = hora.split(":")[:2]; d = d.replace(hour=int(hh), minute=int(mm), second=0)
        return d.replace(microsecond=0).strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        pass
    texto = (valor + " " + hora).strip() if hora and ":" not in valor else valor
    for f in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try: return datetime.strptime(texto, f).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError: pass
    return None


MASCARA = "******"
# Palavra seguinte a "senha" que nao e a senha em si ("a senha foi resetada")
NAO_SENHA = {"foi", "ja", "já", "de", "do", "da", "dos", "das", "que", "e", "é", "para", "precisa", "ainda", "tinha", "estava",
             "com", "no", "na", "nao", "não", "salvas", "salva", "redefinida", "resetada", "alterada", "temporaria", "temporária",
             "nova", "novo", "atual", "rede", "deve", "sera", "será", "esta", "está", "um", "uma", "o", "a", "por", "pois", "tem",
             "se", "ficou", "errada", "incorreta", "bloqueada", "expirou", "expirada", "em", "ao", "mas", "e-mail", "email", "trocada"}
RE_DEPOIS_SENHA = re.compile(r"(senha\s*(?:tempor[aá]ria\s*)?(?:(?:é|e|eh)(?=[\s:=])\s*)?[:=\-–]?\s*)([^\s,;]+)", re.I)
RE_CPF = re.compile(r"(CPF\W{0,8})\d[\d.\-\s]{8,14}\d", re.I)
RE_MISTO = re.compile(r"(?<![\w@/.])(?=[^\s,;()]*[A-Za-z])(?=[^\s,;()]*\d)[^\s,;()]{5,}")
RE_DOCUMENTO = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{9,}\b")  # CPF e numeros longos


def mascarar_senhas(texto):
    """Esconde senhas, logins e CPFs dos tramites. Prefere mascarar demais a deixar passar uma senha."""
    def depois_senha(m):
        alvo = m.group(2)
        if alvo.lower().strip(".:") in NAO_SENHA: return m.group(0)
        return m.group(1) + MASCARA

    def misto(m):
        t = m.group(0)
        if "@" in t and "." in t or t.lower().startswith(("http", "www.")): return t  # e-mail ou link
        return MASCARA

    texto = texto or ""
    texto = RE_CPF.sub(lambda m: m.group(1) + MASCARA, texto)
    texto = RE_DEPOIS_SENHA.sub(depois_senha, texto)
    texto = RE_MISTO.sub(misto, texto)
    return RE_DOCUMENTO.sub(MASCARA, texto)


RE_EVENTO = re.compile(r"\[\d+\]\s+(.+?)\s+\((\d\d/\d\d/\d{4} \d\d:\d\d)\)\s*\n(.*?)(?=\n\s*\n\s*\[\d+\]|\Z)", re.S)


def _eventos(texto):
    out = []
    for autor, quando, msg in RE_EVENTO.findall(texto or ""):
        # tira restos de CSS que o sistema de chamados cola no texto
        msg = re.sub(r"\s*a \{ text-decoration.*$", "", msg.strip(), flags=re.S)
        out.append({"autor": _limpo(autor), "em": _data(quando), "texto": mascarar_senhas(msg.strip())})
    out.sort(key=lambda e: e["em"] or "")
    return out


def ler_relatorio(arquivo):
    """Devolve (chamados, avisos). Levanta ValueError se o arquivo nao for o relatorio esperado."""
    try:
        linhas = _ler_planilha(arquivo)
    except (zipfile.BadZipFile, KeyError, ET.ParseError):
        raise ValueError("Arquivo invalido: envie o Relatorio_Chamados.xlsx exportado do sistema de chamados")
    if not linhas: raise ValueError("Planilha vazia")
    mapa = {}
    for col, nome in linhas[0].items():
        campo = COLUNAS.get(_norm(nome))
        if campo: mapa[campo] = col
    faltam = [c for c in OBRIGATORIAS if c not in mapa]
    if faltam: raise ValueError("Colunas nao encontradas no relatorio: " + ", ".join(faltam))

    chamados, avisos, ignorados = [], [], 0
    for ln in linhas[1:]:
        g = lambda campo: (ln.get(mapa[campo]) or "") if campo in mapa else ""
        cid = _limpo(g("id"))
        if cid.endswith(".0"): cid = cid[:-2]
        aberto = _data(g("data_criado"), g("hora_criado"))
        if not cid or not aberto:
            if any(_limpo(v) for v in ln.values()): ignorados += 1
            continue
        colaborador = _limpo(g("colaborador"))
        eventos = _eventos(g("tramites"))
        # Primeira resposta: primeiro registro de outra pessoa que nao o solicitante
        resposta = next((e["em"] for e in eventos if e["em"] and e["autor"].upper() != colaborador.upper()
                         and not re.search(r"chamado (criado|avaliado)", e["texto"], re.I)), None)
        aval = _limpo(g("avaliacao"))
        try: aval = int(float(aval)) if aval else None
        except ValueError: aval = None
        chamados.append({
            "id": cid, "assunto": _limpo(g("assunto")), "descricao": mascarar_senhas((g("descricao") or "").strip()),
            "colaborador": colaborador, "revenda": _limpo(g("revenda")), "tipo": _limpo(g("tipo")),
            "categoria": _limpo(g("categoria")), "detalhe": _limpo(g("detalhe")),
            "aberto_em": aberto, "encerrado_em": _data(g("data_encerrado"), g("hora_encerrado")),
            "prazo_em": _data(g("prazo")), "sla": _limpo(g("sla")), "responsavel": _limpo(g("responsavel")),
            "status": _limpo(g("status")), "avaliacao": aval, "primeira_resposta_em": resposta,
            "interacoes": len(eventos), "tramites": eventos,
        })
    if ignorados: avisos.append(f"{ignorados} linha(s) sem ID ou sem data de abertura foram ignoradas")
    vistos = set(); dup = 0
    for c in chamados:
        if c["id"] in vistos: dup += 1
        vistos.add(c["id"])
    if dup: avisos.append(f"{dup} chamado(s) repetido(s) no arquivo: vale a ultima linha de cada ID")
    return chamados, avisos
