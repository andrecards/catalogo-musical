"use strict";
const C = window.CATALOGO;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ICON_PLAY = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
const LIMITE_BUSCA = 300;

// índice plano: cada faixa ganha um id estável (o caminho no pendrive)
const FAIXAS = [];
C.categorias.forEach((cat, ci) => cat.pastas.forEach(p => p.faixas.forEach(f => {
  f.cat = cat.nome; f.pasta = p.nome; f.ci = ci;
  f.busca = (f.t + " " + f.a).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  FAIXAS.push(f);
})));
const POR_ID = new Map(FAIXAS.map(f => [f.f, f]));

const sel = new Set(JSON.parse(localStorage.getItem("selecao-nov26") || "[]").filter(id => POR_ID.has(id)));
const salvar = () => localStorage.setItem("selecao-nov26", JSON.stringify([...sel]));
let atual = 0;

$("resumo").textContent = `${C.total.toLocaleString("pt-BR")} músicas em ${C.categorias.length} categorias`;

function menu() {
  $("menu").innerHTML = C.categorias.map((c, i) => {
    const n = c.pastas.reduce((s, p) => s + p.faixas.length, 0);
    const m = c.pastas.reduce((s, p) => s + p.faixas.filter(f => sel.has(f.f)).length, 0);
    return `<button data-cat="${i}" aria-current="${i === atual && !$("busca").value}">
      <span>${esc(c.nome)}</span><span class="${m ? "sel" : ""}">${m ? m + "/" : ""}${n}</span></button>`;
  }).join("");
}

function linha(f) {
  const ini = esc((f.a || f.t).trim().charAt(0).toUpperCase());
  const capa = f.c ? `<img class="capa" src="${esc(f.c)}" alt="" loading="lazy">` : `<div class="capa">${ini}</div>`;
  const on = sel.has(f.f);
  return `<div class="faixa${on ? " marcada" : ""}" data-id="${esc(f.f)}">
    <input type="checkbox" ${on ? "checked" : ""} aria-label="Selecionar ${esc(f.t)}">
    ${capa}
    <div class="info"><b>${esc(f.t)}</b><span>${esc(f.a || "Artista desconhecido")}</span></div>
    <button class="play${tocandoId === f.f ? " tocando" : ""}" aria-label="Ouvir prévia de ${esc(f.t)}">${tocandoId === f.f && !audio.paused ? ICON_PAUSE : ICON_PLAY}</button>
  </div>`;
}

function blocoPasta(nome, faixas, sub = "") {
  const todas = faixas.length && faixas.every(f => sel.has(f.f));
  return `<section class="pasta">
    <div class="pasta-cab"><h3>${esc(nome)}</h3><span class="n">${sub || faixas.length + " músicas"}</span>
      <button class="btn-pasta${todas ? " on" : ""}" data-pasta="${esc(nome)}">${todas ? "✓ Pasta selecionada" : "Selecionar pasta"}</button></div>
    ${faixas.map(linha).join("")}
  </section>`;
}

let visiveis = new Map(); // nome da pasta -> faixas (para o botão "Selecionar pasta")
function render() {
  const q = $("busca").value.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  visiveis = new Map();
  if (q) {
    const achadas = FAIXAS.filter(f => f.busca.includes(q));
    $("cab-titulo").textContent = `Resultados para “${$("busca").value.trim()}”`;
    $("cab-sub").textContent = achadas.length > LIMITE_BUSCA
      ? `${achadas.length} músicas — mostrando as ${LIMITE_BUSCA} primeiras` : `${achadas.length} músicas`;
    const grupos = new Map();
    achadas.slice(0, LIMITE_BUSCA).forEach(f => {
      const k = `${f.cat} › ${f.pasta}`;
      grupos.has(k) || grupos.set(k, []); grupos.get(k).push(f);
    });
    grupos.forEach((v, k) => visiveis.set(k, v));
    $("lista").innerHTML = achadas.length ? [...grupos].map(([k, v]) => blocoPasta(k, v)).join("")
      : `<p class="vazio">Nenhuma música encontrada.</p>`;
  } else {
    const cat = C.categorias[atual];
    const n = cat.pastas.reduce((s, p) => s + p.faixas.length, 0);
    $("cab-titulo").textContent = cat.nome;
    $("cab-sub").textContent = `${cat.pastas.length > 1 ? cat.pastas.length + " pastas · " : ""}${n} músicas`;
    cat.pastas.forEach(p => visiveis.set(p.nome, p.faixas));
    $("lista").innerHTML = cat.pastas.map(p => blocoPasta(p.nome, p.faixas)).join("");
  }
  menu();
  contador();
}

function contador() {
  $("qtd").textContent = sel.size.toLocaleString("pt-BR");
  $("gerar").disabled = !sel.size;
}

// ---------- seleção ----------
$("lista").addEventListener("change", e => {
  if (e.target.type !== "checkbox") return;
  const row = e.target.closest(".faixa"), id = row.dataset.id;
  e.target.checked ? sel.add(id) : sel.delete(id);
  row.classList.toggle("marcada", e.target.checked);
  salvar(); menu(); contador();
  const sec = row.closest(".pasta"), btn = sec.querySelector(".btn-pasta");
  const todas = [...sec.querySelectorAll(".faixa")].every(r => sel.has(r.dataset.id));
  btn.classList.toggle("on", todas); btn.textContent = todas ? "✓ Pasta selecionada" : "Selecionar pasta";
});
$("lista").addEventListener("click", e => {
  const bp = e.target.closest(".btn-pasta");
  if (bp) {
    const faixas = visiveis.get(bp.dataset.pasta) || [];
    const todas = faixas.every(f => sel.has(f.f));
    faixas.forEach(f => todas ? sel.delete(f.f) : sel.add(f.f));
    salvar(); render(); return;
  }
  const pl = e.target.closest(".play");
  if (pl) tocar(POR_ID.get(pl.closest(".faixa").dataset.id));
});
$("menu").addEventListener("click", e => {
  const b = e.target.closest("button[data-cat]");
  if (!b) return;
  atual = +b.dataset.cat; $("busca").value = ""; render(); $("main").scrollTop = 0;
});
let tBusca;
$("busca").addEventListener("input", () => { clearTimeout(tBusca); tBusca = setTimeout(render, 160); });
$("limpar").addEventListener("click", () => {
  if (sel.size && confirm(`Remover as ${sel.size} músicas selecionadas?`)) { sel.clear(); salvar(); render(); }
});

// ---------- prévia de 30 s (API pública do Deezer via JSONP; nenhum áudio fica hospedado aqui) ----------
const audio = $("audio");
let tocandoId = null, jsonpN = 0;
const cachePrev = new Map();
function jsonp(url) {
  return new Promise((ok, erro) => {
    const cb = "dz" + (++jsonpN), s = document.createElement("script");
    const fim = () => { delete window[cb]; s.remove(); clearTimeout(t); };
    const t = setTimeout(() => { fim(); erro(new Error("tempo esgotado")); }, 8000);
    window[cb] = d => { fim(); ok(d); };
    s.onerror = () => { fim(); erro(new Error("falha de rede")); };
    s.src = `${url}&output=jsonp&callback=${cb}`;
    document.head.appendChild(s);
  });
}
async function previa(f) {
  if (cachePrev.has(f.f)) return cachePrev.get(f.f);
  const artista = f.a.split(",")[0].trim();
  const titulo = f.t.replace(/\(.*?\)|\[.*?\]/g, "").trim();
  const tentativas = [`artist:"${artista}" track:"${titulo}"`, `${artista} ${titulo}`, titulo];
  for (const q of tentativas) {
    try {
      const r = await jsonp(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`);
      const x = r && r.data && r.data[0];
      if (x && x.preview) { const v = { url: x.preview, capa: x.album && x.album.cover_medium }; cachePrev.set(f.f, v); return v; }
    } catch (_) { /* tenta a próxima forma de busca */ }
  }
  cachePrev.set(f.f, null);
  return null;
}
async function tocar(f) {
  if (tocandoId === f.f && !audio.paused) { audio.pause(); return; }
  if (tocandoId === f.f && audio.src) { audio.play(); return; }
  tocandoId = f.f;
  $("p-titulo").textContent = f.t;
  $("p-artista").textContent = "Carregando prévia…";
  $("p-capa").outerHTML = f.c ? `<img class="capa" id="p-capa" src="${esc(f.c)}" alt="">` : `<div class="capa" id="p-capa">♪</div>`;
  marcarBotoes();
  const p = await previa(f);
  if (tocandoId !== f.f) return; // usuário já clicou em outra
  if (!p) { $("p-artista").textContent = "Prévia indisponível para esta música"; audio.removeAttribute("src"); marcarBotoes(); return; }
  $("p-artista").textContent = f.a;
  audio.src = p.url;
  audio.play().catch(() => { $("p-artista").textContent = "Toque de novo para ouvir"; });
}
function marcarBotoes() {
  document.querySelectorAll(".faixa").forEach(r => {
    const b = r.querySelector(".play"), on = r.dataset.id === tocandoId;
    b.classList.toggle("tocando", on);
    b.innerHTML = on && !audio.paused ? ICON_PAUSE : ICON_PLAY;
  });
}
audio.addEventListener("play", marcarBotoes);
audio.addEventListener("pause", marcarBotoes);
audio.addEventListener("ended", marcarBotoes);
audio.addEventListener("timeupdate", () => {
  $("p-barra").style.width = audio.duration ? (audio.currentTime / audio.duration * 100) + "%" : "0";
});

// ---------- gerar .md / .txt ----------
$("gerar").addEventListener("click", () => {
  $("dlg-sub").textContent = `${sel.size} músicas selecionadas.`;
  $("dlg").showModal();
});
$("dlg").addEventListener("close", () => {
  if ($("dlg").returnValue !== "ok") return;
  const fmt = document.querySelector('input[name="fmt"]:checked').value;
  const nome = $("nome").value.trim();
  const data = new Date().toLocaleDateString("pt-BR");
  const escolhidas = FAIXAS.filter(f => sel.has(f.f)); // mantém a ordem do catálogo
  const grupos = new Map();
  escolhidas.forEach(f => { const k = `${f.cat} › ${f.pasta}`; grupos.has(k) || grupos.set(k, []); grupos.get(k).push(f); });
  let out;
  if (fmt === "md") {
    out = `# ${C.titulo} — Minha seleção\n\n` +
      (nome ? `- **Nome:** ${nome}\n` : "") + `- **Data:** ${data}\n- **Total:** ${escolhidas.length} músicas\n\n` +
      [...grupos].map(([k, v]) => `## ${k} (${v.length})\n\n` +
        v.map((f, i) => `${i + 1}. **${f.t}** — ${f.a}  \n   \`${f.f}\``).join("\n") + "\n").join("\n");
  } else {
    out = `${C.titulo.toUpperCase()} - MINHA SELEÇÃO\n` + (nome ? `Nome: ${nome}\n` : "") +
      `Data: ${data}\nTotal: ${escolhidas.length} músicas\n\n` +
      [...grupos].map(([k, v]) => `== ${k} (${v.length}) ==\n` +
        v.map((f, i) => `${String(i + 1).padStart(3, " ")}. ${f.a} - ${f.t}\n     ${f.f}`).join("\n") + "\n").join("\n");
  }
  const arq = `selecao-musicas${nome ? "-" + nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-") : ""}.${fmt}`;
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([out], { type: fmt === "md" ? "text/markdown" : "text/plain" })),
    download: arq,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

render();
