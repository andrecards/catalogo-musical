"""Gera catalogo.js (window.CATALOGO) a partir das tags dos MP3 da coleção.
Uso: <python-com-mutagen> scripts/gerar_catalogo.py <pasta-da-colecao> <artistas.json do Deezer>
Não copia nenhum áudio: o site toca prévias de 30 s da API pública do Deezer."""
import json
import re
import sys
import unicodedata
from pathlib import Path

from mutagen.id3 import ID3

NUM = re.compile(r"^\d{1,3}\.\s*")
MES = re.compile(r"\s*-\s*(JANEIRO|FEVEREIRO|MAR[ÇC]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|"
                 r"NOVEMBRO|DEZEMBRO)\s*\d{4}\s*$", re.I)
NOMES = {"PLAYLISTS SPOTIFY": "Spotify"}  # nome exibido para pastas especiais


def norm(s: str) -> str:
    s = s.replace("&", " e ")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return "".join(c for c in s if c.isalnum())


def bonito(pasta: str) -> str:
    n = MES.sub("", NUM.sub("", pasta)).strip()
    if n in NOMES:
        return NOMES[n]
    siglas = {"MPB", "TBT", "DJ", "MC"}
    minusc = {"e", "do", "da", "de", "dos", "das", "no", "na", "nas", "nos", "as", "os"}
    return " ".join(w if w in siglas else
                    (w.lower() if i and w.lower() in minusc else w.capitalize())
                    for i, w in enumerate(n.split()))


def tag(t, k):
    v = t.get(k)
    return str(v.text[0]).strip() if v and v.text else ""


def main():
    raiz, artistas_json = Path(sys.argv[1]), Path(sys.argv[2])
    fotos = {k: v["url"].replace("500x500", "250x250") for k, v in
             json.loads(artistas_json.read_text(encoding="utf-8")).items() if v}
    categorias = []
    for gen in sorted(p for p in raiz.iterdir() if p.is_dir()):
        grupos = {}
        for f in sorted(gen.rglob("*.mp3")):
            t = ID3(f)
            artista, titulo = tag(t, "TPE1"), tag(t, "TIT2") or f.stem
            sub = f.parent.name if f.parent != gen else ""
            principal = artista.split(",")[0].strip()
            grupos.setdefault(sub, []).append({
                "t": titulo, "a": artista,
                "c": fotos.get(norm(principal)),  # capa = foto do cantor (CDN do Deezer)
                "f": str(f.relative_to(raiz)),   # caminho no pendrive, vai para a lista gerada
                "s": round(f.stat().st_size / 1048576, 1),  # MB, para somar e ver se cabe no pendrive
            })
        pastas = [{"nome": bonito(s) if s else bonito(gen.name), "orig": s, "faixas": fx} for s, fx in grupos.items()]
        repetidos = {p["nome"] for p in pastas if [q["nome"] for q in pastas].count(p["nome"]) > 1}
        for p in pastas:  # "Reggae Remix" x2 -> mantém o mês para diferenciar
            if p["nome"] in repetidos:
                p["nome"] = NUM.sub("", p.pop("orig")).title()
            else:
                del p["orig"]
        categorias.append({"nome": bonito(gen.name), "pastas": pastas})
    total = sum(len(p["faixas"]) for c in categorias for p in c["pastas"])
    dados = {"titulo": "Atualização Novembro 2026", "total": total, "categorias": categorias}
    saida = Path(__file__).resolve().parent.parent / "catalogo.js"
    saida.write_text("window.CATALOGO = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                     encoding="utf-8")
    print(f"{len(categorias)} categorias, {total} faixas -> {saida} ({saida.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
