"use strict";
const C = window.CATALOGO;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ICON_PLAY = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
const ICON_SETA = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6l5 5 5-5"/></svg>';
const LIMITE_BUSCA = 300;
const PENDRIVES = [4, 8, 16, 32, 64, 128, 256]; // GB anunciados; uso real ~93% (formatação)

// ---------- dados ----------
// Cada pasta tem uma chave "ci/pi"; cada faixa usa o caminho no pendrive como id estável.
const PASTAS = [];
const FAIXAS = [];
C.categorias.forEach((cat, ci) => cat.pastas.forEach((p, pi) => {
  p.k = `${ci}/${pi}`; p.ci = ci; p.cat = cat.nome;
  p.dir = p.faixas[0].f.slice(0, p.faixas[0].f.lastIndexOf("/"));
  p.capa = (p.faixas.find(f => f.c) || {}).c;
  PASTAS.push(p);
  p.faixas.forEach(f => { f.p = p; f.busca = semAcento(f.t + " " + f.a); FAIXAS.push(f); });
}));
const POR_ID = new Map(FAIXAS.map(f => [f.f, f]));
const POR_PASTA = new Map(PASTAS.map(p => [p.k, p]));

// ---------- estado (fica salvo no navegador) ----------
const sel = new Set(JSON.parse(localStorage.getItem("selecao-nov26") || "[]").filter(id => POR_ID.has(id)));
let modo = localStorage.getItem("modo-nov26") === "nao" ? "nao" : "quero";
let atual = 0;
const abertas = new Set();
const salvar = () => localStorage.setItem("selecao-nov26", JSON.stringify([...sel]));

const qtdSel = faixas => faixas.reduce((n, f) => n + sel.has(f.f), 0);
const faixasCat = ci => C.categorias[ci].pastas.flatMap(p => p.faixas);
// tamanho no padrão de pendrive (GB = 10^9 bytes); abaixo de 1 GB mostra em MB
function gb(mb) {
  const bytes = mb * 1048576;
  return bytes < 1e9 ? Math.round(bytes / 1e6) + " MB"
    : (bytes / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " GB";
}

// ---------- desenho ----------
function menu() {
  $("menu").innerHTML = C.categorias.map((c, i) => {
    const fx = faixasCat(i), m = qtdSel(fx);
    return `<button data-cat="${i}" aria-current="${i === atual && !$("busca").value}">
      <span>${esc(c.nome)}</span><span class="cont${m ? " tem" : ""}">${m ? m + "/" : ""}${fx.length}</span></button>`;
  }).join("");
}

function linha(f) {
  const on = sel.has(f.f);
  const capa = f.c ? `<img class="capa" src="${esc(f.c)}" alt="" loading="lazy">`
                   : `<div class="capa">${esc((f.a || f.t).trim().charAt(0).toUpperCase())}</div>`;
  const tocando = tocandoId === f.f;
  const play = `<button class="play${tocando ? " tocando" : ""}" aria-label="Ouvir prévia de ${esc(f.t)}">${tocando && !audio.paused ? ICON_PAUSE : ICON_PLAY}</button>`;
  const info = `<div class="info"><b>${esc(f.t)}</b><span>${esc(f.a || "Artista desconhecido")}</span></div>`;
  if (modo === "nao") {
    const btn = on ? `<button class="descartar sim" aria-label="Não quero ${esc(f.t)}">✕ Não quero</button>`
                   : `<button class="descartar inc" aria-label="Incluir ${esc(f.t)}">↺ Incluir</button>`;
    return `<div class="faixa${on ? " marcada" : " fora"}" data-id="${esc(f.f)}">${capa}${info}${play}${btn}</div>`;
  }
  return `<div class="faixa${on ? " marcada" : ""}" data-id="${esc(f.f)}">
    <input type="checkbox" ${on ? "checked" : ""} aria-label="Quero ${esc(f.t)}">${capa}${info}${play}</div>`;
}

function cartao(p, faixas, forcarAberta) {
  const m = qtdSel(faixas), aberta = forcarAberta || abertas.has(p.k);
  const capa = p.capa ? `<img class="capa" src="${esc(p.capa)}" alt="" loading="lazy">` : `<div class="capa">♪</div>`;
  const mb = faixas.reduce((s, f) => s + f.s, 0);
  const meta = m ? `<b>${m} de ${faixas.length} escolhidas</b> · ${gb(mb)}` : `${faixas.length} músicas · ${gb(mb)}`;
  return `<section class="pasta${m ? " tem" : ""}${aberta ? " aberta" : ""}" data-k="${p.k}">
    <div class="pasta-cab">
      <input type="checkbox" class="chk-pasta" data-tudo="${m === faixas.length ? 1 : 0}" data-parcial="${m && m < faixas.length ? 1 : 0}"
        ${m === faixas.length ? "checked" : ""} aria-label="Pasta inteira: ${esc(p.nome)}">
      ${capa}
      <div class="info"><h3>${esc(p.nome)}</h3><span class="meta">${meta}</span></div>
      <span class="seta" aria-hidden="true">${ICON_SETA}</span>
    </div>
    ${aberta ? `<div class="faixas">${faixas.map(linha).join("")}</div>` : ""}
  </section>`;
}

let visiveis = new Map(); // chave da pasta -> faixas mostradas (na busca, só as encontradas)
function render() {
  document.body.classList.toggle("modo-nao", modo === "nao");
  document.querySelectorAll(".modo button").forEach(b => b.setAttribute("aria-pressed", b.dataset.modo === modo));
  $("dica").innerHTML = modo === "nao"
    ? `<p class="dica"><b>Modo “não quero”:</b> marque a pasta (ou “Incluir categoria toda”) e depois toque em <b>✕ Não quero</b> nas músicas que você dispensa.</p>`
    : "";
  const q = semAcento($("busca").value.trim());
  visiveis = new Map();
  let html;
  if (q) {
    const achadas = FAIXAS.filter(f => f.busca.includes(q));
    $("cab-titulo").textContent = `Resultados para “${$("busca").value.trim()}”`;
    $("cab-sub").textContent = achadas.length > LIMITE_BUSCA
      ? `${achadas.length} músicas — mostrando as ${LIMITE_BUSCA} primeiras` : `${achadas.length} músicas`;
    $("cab-acoes").innerHTML = "";
    achadas.slice(0, LIMITE_BUSCA).forEach(f => {
      visiveis.has(f.p.k) || visiveis.set(f.p.k, []);
      visiveis.get(f.p.k).push(f);
    });
    html = achadas.length
      ? [...visiveis].map(([k, fx]) => { const p = POR_PASTA.get(k); return cartao({ ...p, nome: `${p.cat} › ${p.nome}` }, fx, true); }).join("")
      : `<p class="vazio">Nenhuma música encontrada.</p>`;
  } else {
    const cat = C.categorias[atual], fx = faixasCat(atual), m = qtdSel(fx);
    $("cab-titulo").textContent = cat.nome;
    $("cab-sub").textContent = `${cat.pastas.length > 1 ? cat.pastas.length + " pastas · " : ""}${fx.length} músicas · ${gb(fx.reduce((s, f) => s + f.s, 0))}`;
    $("cab-acoes").innerHTML =
      (m < fx.length ? `<button class="pilula forte" data-cat-acao="tudo">Incluir categoria toda</button>` : "") +
      (m ? `<button class="pilula" data-cat-acao="nada">Limpar categoria</button>` : "") +
      (cat.pastas.length > 1 ? `<button class="pilula" data-cat-acao="abrir">${cat.pastas.every(p => abertas.has(p.k)) ? "Recolher pastas" : "Abrir todas as pastas"}</button>` : "");
    cat.pastas.forEach(p => visiveis.set(p.k, p.faixas));
    html = cat.pastas.map(p => cartao(p, p.faixas, cat.pastas.length === 1)).join("");
  }
  $("lista").innerHTML = html;
  // estado "parcial" da caixa da pasta só existe via JS
  document.querySelectorAll(".chk-pasta").forEach(c => { c.indeterminate = c.dataset.parcial === "1"; });
  menu();
  rodape();
}

function rodape() {
  const mb = [...sel].reduce((s, id) => s + POR_ID.get(id).s, 0);
  const bytes = mb * 1048576;
  $("qtd").textContent = sel.size.toLocaleString("pt-BR");
  $("tam").textContent = gb(mb);
  const cabe = PENDRIVES.find(g => bytes <= g * 1e9 * 0.93);
  $("cabe").textContent = !sel.size ? "" : cabe ? `cabe em pendrive de ${cabe} GB` : "passa de 256 GB";
  $("gerar").disabled = !sel.size;
}

// ---------- interação ----------
function alternarFaixa(id, quer) {
  quer ? sel.add(id) : sel.delete(id);
  salvar();
  render();
}

$("lista").addEventListener("click", e => {
  const play = e.target.closest(".play");
  if (play) { tocar(POR_ID.get(play.closest(".faixa").dataset.id)); return; }
  const desc = e.target.closest(".descartar");
  if (desc) { alternarFaixa(desc.closest(".faixa").dataset.id, desc.classList.contains("inc")); return; }
  const chkPasta = e.target.closest(".chk-pasta");
  if (chkPasta) {
    const fx = visiveis.get(chkPasta.closest(".pasta").dataset.k) || [];
    const tudo = chkPasta.dataset.tudo === "1";
    fx.forEach(f => tudo ? sel.delete(f.f) : sel.add(f.f));
    salvar(); render();
    return;
  }
  const chk = e.target.closest(".faixa input[type=checkbox]");
  if (chk) { alternarFaixa(chk.closest(".faixa").dataset.id, chk.checked); return; }
  const cab = e.target.closest(".pasta-cab");
  if (cab) {
    const k = cab.closest(".pasta").dataset.k;
    abertas.has(k) ? abertas.delete(k) : abertas.add(k);
    render();
  }
});

$("cab-acoes").addEventListener("click", e => {
  const b = e.target.closest("[data-cat-acao]");
  if (!b) return;
  const cat = C.categorias[atual], fx = faixasCat(atual);
  if (b.dataset.catAcao === "tudo") fx.forEach(f => sel.add(f.f));
  if (b.dataset.catAcao === "nada") fx.forEach(f => sel.delete(f.f));
  if (b.dataset.catAcao === "abrir") {
    const todas = cat.pastas.every(p => abertas.has(p.k));
    cat.pastas.forEach(p => todas ? abertas.delete(p.k) : abertas.add(p.k));
  }
  salvar(); render();
});

document.querySelector(".modo").addEventListener("click", e => {
  const b = e.target.closest("[data-modo]");
  if (!b || b.dataset.modo === modo) return;
  modo = b.dataset.modo;
  localStorage.setItem("modo-nov26", modo);
  render();
});

$("menu").addEventListener("click", e => {
  const b = e.target.closest("button[data-cat]");
  if (!b) return;
  atual = +b.dataset.cat; $("busca").value = ""; render(); $("main").scrollTop = 0;
});
let tBusca;
$("busca").addEventListener("input", () => { clearTimeout(tBusca); tBusca = setTimeout(render, 160); });
$("limpar").addEventListener("click", () => {
  if (sel.size && confirm(`Tirar todas as ${sel.size} músicas escolhidas?`)) { sel.clear(); salvar(); render(); }
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
  for (const q of [`artist:"${artista}" track:"${titulo}"`, `${artista} ${titulo}`, titulo]) {
    try {
      const r = await jsonp(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`);
      const x = r && r.data && r.data[0];
      if (x && x.preview) { cachePrev.set(f.f, x.preview); return x.preview; }
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
  const url = await previa(f);
  if (tocandoId !== f.f) return; // a pessoa já clicou em outra
  if (!url) { $("p-artista").textContent = "Prévia indisponível para esta música"; audio.removeAttribute("src"); marcarBotoes(); return; }
  $("p-artista").textContent = f.a;
  audio.src = url;
  audio.play().catch(() => { $("p-artista").textContent = "Toque de novo para ouvir"; });
}
function marcarBotoes() {
  document.querySelectorAll(".faixa").forEach(r => {
    const b = r.querySelector(".play"), on = r.dataset.id === tocandoId;
    b.classList.toggle("tocando", on);
    b.innerHTML = on && !audio.paused ? ICON_PAUSE : ICON_PLAY;
  });
}
["play", "pause", "ended"].forEach(ev => audio.addEventListener(ev, marcarBotoes));
audio.addEventListener("timeupdate", () => {
  $("p-barra").style.width = audio.duration ? (audio.currentTime / audio.duration * 100) + "%" : "0";
});

// ---------- gerar .md / .txt ----------
// Pasta inteira vira 1 linha; quase inteira vira "copiar e apagar estas"; poucas viram a lista das escolhidas.
function resumoPastas() {
  return PASTAS.map(p => {
    const quer = p.faixas.filter(f => sel.has(f.f));
    if (!quer.length) return null;
    const nao = p.faixas.filter(f => !sel.has(f.f));
    const tipo = !nao.length ? "inteira" : nao.length < quer.length ? "menos" : "so";
    return { p, quer, nao, tipo };
  }).filter(Boolean);
}
$("gerar").addEventListener("click", () => {
  const mb = [...sel].reduce((s, id) => s + POR_ID.get(id).s, 0);
  $("dlg-sub").textContent = `${sel.size} músicas · ${gb(mb)}.`;
  $("dlg").showModal();
});
$("dlg").addEventListener("close", () => {
  if ($("dlg").returnValue !== "ok") return;
  const fmt = document.querySelector('input[name="fmt"]:checked').value;
  const nome = $("nome").value.trim();
  const data = new Date().toLocaleDateString("pt-BR");
  const blocos = resumoPastas();
  const mb = [...sel].reduce((s, id) => s + POR_ID.get(id).s, 0);
  const md = fmt === "md";
  const L = [];
  L.push(md ? `# ${C.titulo} — Minha seleção` : `${C.titulo.toUpperCase()} - MINHA SELEÇÃO`, "");
  if (nome) L.push(md ? `- **Nome:** ${nome}` : `Nome: ${nome}`);
  L.push(md ? `- **Data:** ${data}` : `Data: ${data}`);
  L.push(md ? `- **Total:** ${sel.size} músicas (${gb(mb)})` : `Total: ${sel.size} músicas (${gb(mb)})`, "");
  let cat = null;
  for (const { p, quer, nao, tipo } of blocos) {
    if (p.cat !== cat) { cat = p.cat; L.push(md ? `## ${cat}` : `==== ${cat.toUpperCase()} ====`, ""); }
    const pasta = md ? `\`${p.dir}\`` : p.dir;
    if (tipo === "inteira") {
      L.push(md ? `- ✅ **${p.nome}** — pasta completa (${quer.length})  \n  ${pasta}` : `[PASTA COMPLETA] ${p.nome} (${quer.length})\n  ${pasta}`, "");
    } else if (tipo === "menos") {
      L.push(md ? `### ${p.nome} — ${quer.length} de ${p.faixas.length}: copiar a pasta e **apagar** estas ${nao.length}`
                : `[PASTA MENOS ${nao.length}] ${p.nome} - copiar a pasta e APAGAR:`);
      L.push(md ? pasta : `  ${pasta}`);
      nao.forEach(f => L.push(md ? `- ~~${f.t}~~ — ${f.a}` : `   x ${f.a} - ${f.t}`));
      L.push("");
    } else {
      L.push(md ? `### ${p.nome} — só estas ${quer.length} de ${p.faixas.length}` : `[SÓ ESTAS ${quer.length}] ${p.nome}`);
      L.push(md ? pasta : `  ${pasta}`);
      quer.forEach((f, i) => L.push(md ? `${i + 1}. **${f.t}** — ${f.a}` : `  ${String(i + 1).padStart(3, " ")}. ${f.a} - ${f.t}`));
      L.push("");
    }
  }
  const slug = nome ? "-" + semAcento(nome).replace(/[^a-z0-9]+/g, "-") : "";
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([L.join("\n")], { type: md ? "text/markdown" : "text/plain" })),
    download: `selecao-musicas${slug}.${fmt}`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("resumo").textContent = `${C.total.toLocaleString("pt-BR")} músicas em ${C.categorias.length} categorias`;
render();
