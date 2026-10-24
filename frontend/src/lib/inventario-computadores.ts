/**
 * Indicadores de inventário de computadores a partir do OCS Inventory e do Active Directory.
 *
 * Módulo puro (sem React, sem banco, sem DOM). Entradas:
 *   - OCS: exportação de "All computers" (CSV separado por ";")
 *   - AD computadores: ad_computadores.csv (Get-ADComputer, separado por ";")
 *   - AD usuários: ad_usuarios.csv (Get-ADUser, separado por ";")  — opcional
 *
 * Uso:
 *   const ocs = lerOCS(textoOcs); const ad = lerADComputadores(textoAd); const us = lerADUsuarios(textoUs);
 *   const r = calcularIndicadores({ ocs, ad, usuarios: us }, { tipo: "" });
 *   statusMeta("cobertura", r.indicadores.cobertura.valor)
 *
 * Colunas opcionais do OCS (usadas quando vierem na exportação): Last contact, versão do agente,
 * RAM (MB) e campos de dados administrativos "Account info : <CAMPO>" (PATRIMONIO, SETOR, RESPONSAVEL, LOCAL).
 * As regras estão em INDICADORES.md.
 */

// ------------------------------------------------------------------ tipos
export type TipoMaquina = "Notebook" | "Desktop" | "Servidor" | "VM";

export interface MaquinaOCS {
  nome: string; tag: string; ultimoInventario: string; ultimoContato: string; usuario: string; so: string;
  cpu: string; fabricante: string; serial: string; modelo: string; ip: string; ramMB: number | null; agente: string;
  admin: Record<string, string>;
}
export interface RelatorioOCS { base: string; maquinas: MaquinaOCS[]; colunas: string[]; camposAdmin: string[]; temContato: boolean; temAgente: boolean; temRam: boolean }
export interface ComputadorAD { nome: string; habilitado: boolean | null; so: string; build: number | null; ultimoLogon: string; criadoEm: string; ip: string; ou: string }
export interface UsuarioAD { login: string; nome: string; habilitado: boolean | null; ultimoLogon: string; senhaNuncaExpira: boolean | null; ou: string; criadoEm: string }

export type Suporte = "suportado" | "vence" | "sem-suporte" | "verificar";
export interface Problema { tipo: string; texto: string }

export interface Maquina {
  chave: string; nome: string; tipo: TipoMaquina; noOCS: boolean; noAD: boolean;
  tag: string; usuario: string; so: string; build: number | null; suporte: Suporte; fimSuporte: string | null;
  fabricante: string; modelo: string; serial: string; serialValido: boolean; ip: string;
  ultimoInventario: string; ultimoContato: string; ultimoLogonAD: string; ou: string;
  ramMB: number | null; agente: string; admin: Record<string, string>; problemas: Problema[];
}

// ------------------------------------------------------------------ CSV
function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ";") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const toISO = (s: string) => clean(s).replace(" ", "T");
const norm = (s: string) => clean(s).toUpperCase();
function tabela(text: string) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("Arquivo vazio.");
  const h = rows[0].map((x) => clean(x));
  return { h, rows: rows.slice(1), col: (re: RegExp) => h.findIndex((x) => re.test(x)) };
}

/** Lê a exportação "All computers" do OCS. */
export function lerOCS(text: string): RelatorioOCS {
  const { h, rows, col } = tabela(text);
  const iNome = col(/^computer$/i);
  if (iNome < 0) throw new Error("Este arquivo não parece a exportação 'All computers' do OCS (falta a coluna Computer).");
  const i = {
    tag: col(/account info\s*:\s*tag/i), inv: col(/last inventory/i), contato: col(/last contact|dernier contact/i),
    usuario: col(/connected user|^user/i), so: col(/^operating system$/i), cpu: col(/cpu type|processor type/i),
    fab: col(/^manufacturer$/i), serial: col(/serial/i), modelo: col(/^model$/i), ip: col(/ip address/i),
    ram: col(/^ram|memory/i), agente: col(/agent/i),
  };
  const adminCols = h.map((x, k) => [x, k] as [string, number]).filter(([x]) => /account info\s*:/i.test(x) && !/:\s*tag$/i.test(x));
  const g = (r: string[], k: number) => (k >= 0 ? clean(r[k]) : "");
  const maquinas = rows.map((r) => ({
    nome: g(r, iNome), tag: g(r, i.tag), ultimoInventario: toISO(g(r, i.inv)), ultimoContato: toISO(g(r, i.contato)),
    usuario: g(r, i.usuario), so: g(r, i.so).replace(/^Microsoft\s+/, ""), cpu: g(r, i.cpu), fabricante: g(r, i.fab),
    serial: g(r, i.serial), modelo: g(r, i.modelo), ip: g(r, i.ip),
    ramMB: i.ram >= 0 && g(r, i.ram) ? Number(g(r, i.ram)) : null, agente: g(r, i.agente),
    admin: Object.fromEntries(adminCols.map(([x, k]) => [x.replace(/account info\s*:\s*/i, "").toUpperCase(), g(r, k)])),
  })).filter((m) => m.nome);
  const datas = maquinas.map((m) => m.ultimoContato || m.ultimoInventario).filter(Boolean).sort();
  return {
    base: datas.at(-1) || "", maquinas, colunas: h,
    camposAdmin: adminCols.map(([x]) => x.replace(/account info\s*:\s*/i, "").toUpperCase()),
    temContato: i.contato >= 0, temAgente: i.agente >= 0, temRam: i.ram >= 0,
  };
}

const bool = (s: string) => (s === "True" ? true : s === "False" ? false : null);

/** Lê ad_computadores.csv. */
export function lerADComputadores(text: string): ComputadorAD[] {
  const { rows, col } = tabela(text);
  const i = { nome: col(/^name$/i), en: col(/^enabled$/i), so: col(/^operatingsystem$/i), ver: col(/operatingsystemversion/i), logon: col(/ultimologon/i), criado: col(/criadoem/i), ip: col(/ipv4/i), ou: col(/^ou$/i) };
  if (i.nome < 0 || i.so < 0) throw new Error("Este arquivo não parece o ad_computadores.csv (faltam Name e OperatingSystem).");
  const g = (r: string[], k: number) => (k >= 0 ? clean(r[k]) : "");
  return rows.map((r) => {
    const m = g(r, i.ver).match(/\((\d+)\)/);
    return { nome: g(r, i.nome), habilitado: bool(g(r, i.en)), so: g(r, i.so), build: m ? Number(m[1]) : null, ultimoLogon: toISO(g(r, i.logon)), criadoEm: g(r, i.criado), ip: g(r, i.ip), ou: g(r, i.ou) };
  }).filter((c) => c.nome);
}

/** Lê ad_usuarios.csv. */
export function lerADUsuarios(text: string): UsuarioAD[] {
  const { rows, col } = tabela(text);
  const i = { login: col(/samaccountname/i), nome: col(/^name$/i), en: col(/^enabled$/i), logon: col(/ultimologon/i), pne: col(/passwordneverexpires/i), ou: col(/^ou$/i), criado: col(/criadoem/i) };
  if (i.login < 0) throw new Error("Este arquivo não parece o ad_usuarios.csv (falta SamAccountName).");
  const g = (r: string[], k: number) => (k >= 0 ? clean(r[k]) : "");
  return rows.map((r) => ({ login: g(r, i.login), nome: g(r, i.nome), habilitado: bool(g(r, i.en)), ultimoLogon: toISO(g(r, i.logon)), senhaNuncaExpira: bool(g(r, i.pne)), ou: g(r, i.ou), criadoEm: g(r, i.criado) })).filter((u) => u.login);
}

// ------------------------------------------------------------------ regras
/**
 * Fim do suporte (datas do ciclo de vida da Microsoft para as edições Pro/Standard).
 * Conferir e atualizar em https://learn.microsoft.com/lifecycle quando sair versão nova.
 */
export const FIM_SUPORTE = {
  win11PorBuild: { 22000: "2023-10-10", 22621: "2024-10-08", 22631: "2025-11-11", 26100: "2026-10-13", 26200: "2027-10-12" } as Record<number, string>,
  "Windows 10": "2025-10-14", "Windows 8": "2023-01-10", "Windows 7": "2020-01-14",
  "Server 2012": "2023-10-10", "Server 2016": "2027-01-12", "Server 2019": "2029-01-09", "Server 2022": "2031-10-14", "Server 2025": "2034-10-10",
};
export const AVISO_DIAS = 180;
export const PADRAO_NOME = { estacao: /^(PC|NB)\d{4}$/, servidor: /^V?SRV-[A-Z0-9]+$/ };
const SERIAL_INVALIDO = /o\.?e\.?m|default string|system serial|^0+$|^f+$|^$|to be filled/i;
const dias = (a: string, b: string) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 864e5 : Infinity);

export function situacaoSuporte(so: string, build: number | null, base: string): { suporte: Suporte; fim: string | null } {
  let fim: string | null = null;
  if (/windows 11/i.test(so)) {
    if (build == null) return { suporte: "verificar", fim: null };
    const known = Object.keys(FIM_SUPORTE.win11PorBuild).map(Number).sort((a, b) => a - b);
    if (FIM_SUPORTE.win11PorBuild[build]) fim = FIM_SUPORTE.win11PorBuild[build];
    else if (build > known.at(-1)!) return { suporte: "suportado", fim: null }; // versão mais nova que a tabela
    else return { suporte: "verificar", fim: null };
  } else if (/windows 10/i.test(so)) fim = FIM_SUPORTE["Windows 10"];
  else if (/windows 8/i.test(so)) fim = FIM_SUPORTE["Windows 8"];
  else if (/windows 7/i.test(so)) fim = FIM_SUPORTE["Windows 7"];
  else { const m = so.match(/server (\d{4})/i); if (m) fim = (FIM_SUPORTE as any)["Server " + m[1]] ?? null; }
  if (!fim) return { suporte: "verificar", fim: null };
  const d = dias(base, fim);
  return { suporte: d < 0 ? "sem-suporte" : d <= AVISO_DIAS ? "vence" : "suportado", fim };
}

function tipoDe(nome: string, so: string, modelo: string, cpu: string, ou: string): TipoMaquina {
  if (/server/i.test(so) || /servidor|domain controllers|hyper-v/i.test(ou)) return "Servidor";
  if (/virtual machine/i.test(modelo)) return "VM";
  if (/^(NB|NOTE)/i.test(nome) || /notebook|laptop/i.test(modelo) || /\d{4,5}[UH]\b|\d[UH] with/i.test(cpu)) return "Notebook";
  return "Desktop";
}

// ------------------------------------------------------------------ cálculo
export interface Entradas { ocs: RelatorioOCS; ad: ComputadorAD[]; usuarios?: UsuarioAD[] }
export interface Ind { valor: number | null; n?: number; de?: number; ids: string[]; nota?: string }
export interface Resultado {
  base: string; maquinas: Maquina[];
  indicadores: {
    cobertura: Ind; foraDominio: Ind; inventarioEmDia: Ind; fantasmas: Ind; cadastroCompleto: Ind; nomePadrao: Ind;
    serialValido: Ind; duplicados: Ind; estacoesSuportadas: Ind; servidoresSuportados: Ind; agenteAtualizado: Ind;
    hardwareAbaixo: Ind; contasSemUso: Ind; senhaNuncaExpira: Ind;
  };
  avisos: string[];
}

export const CAMPOS_CADASTRO = ["PATRIMONIO", "SETOR", "RESPONSAVEL", "LOCAL"];

/** Junta OCS e AD numa lista única de máquinas e calcula os indicadores. `tipo` filtra (ex.: "Notebook"). */
export function calcularIndicadores(e: Entradas, filtro: { tipo?: TipoMaquina | "" } = {}): Resultado {
  const base = e.ocs.base;
  const avisos: string[] = [];
  const ad = new Map(e.ad.map((c) => [norm(c.nome), c]));
  const oc = new Map(e.ocs.maquinas.map((m) => [norm(m.nome), m]));
  const chaves = [...new Set([...ad.keys(), ...oc.keys()])].sort();
  const temCampos = CAMPOS_CADASTRO.filter((c) => e.ocs.camposAdmin.includes(c));
  // agente mais recente
  const versoes = e.ocs.maquinas.map((m) => m.agente).filter(Boolean);
  const ver = (s: string) => (s.match(/(\d+(?:\.\d+)+)/)?.[1] ?? "").split(".").map(Number);
  const cmp = (a: number[], b: number[]) => { for (let k = 0; k < Math.max(a.length, b.length); k++) { const d = (a[k] ?? 0) - (b[k] ?? 0); if (d) return d; } return 0; };
  const maisNova = versoes.length ? versoes.reduce((x, y) => (cmp(ver(x), ver(y)) >= 0 ? x : y)) : "";
  // duplicados por serial válido
  const porSerial: Record<string, string[]> = {};
  e.ocs.maquinas.forEach((m) => { if (!SERIAL_INVALIDO.test(m.serial)) (porSerial[m.serial] = porSerial[m.serial] || []).push(norm(m.nome)); });

  let maquinas: Maquina[] = chaves.map((k) => {
    const o = oc.get(k), a = ad.get(k);
    const so = o?.so || a?.so || "";
    const build = a?.build ?? null;
    const sup = situacaoSuporte(so, build, base);
    const tipo = tipoDe(o?.nome || a?.nome || k, so, o?.modelo || "", o?.cpu || "", a?.ou || "");
    const m: Maquina = {
      chave: k, nome: o?.nome || a!.nome, tipo, noOCS: !!o, noAD: !!a, tag: o?.tag || "", usuario: o?.usuario || "",
      so, build, suporte: sup.suporte, fimSuporte: sup.fim, fabricante: o?.fabricante || "", modelo: o?.modelo || "",
      serial: o?.serial || "", serialValido: !!o && !SERIAL_INVALIDO.test(o.serial), ip: o?.ip || a?.ip || "",
      ultimoInventario: o?.ultimoInventario || "", ultimoContato: o?.ultimoContato || "", ultimoLogonAD: a?.ultimoLogon || "",
      ou: a?.ou || "", ramMB: o?.ramMB ?? null, agente: o?.agente || "", admin: o?.admin || {}, problemas: [],
    };
    const p = m.problemas;
    if (a && a.habilitado !== false && !o) p.push({ tipo: "semAgente", texto: "No AD e sem agente do OCS" });
    if (o && !a) p.push({ tipo: "foraDominio", texto: "No OCS e fora do domínio" });
    if (o) { const d = dias(o.ultimoContato || o.ultimoInventario, base); if (d > 7) p.push({ tipo: "inventario", texto: `Sem inventário no OCS há ${Math.floor(d)} dias` }); }
    if (a && a.habilitado !== false) { const d = dias(a.ultimoLogon, base); if (d > 30) p.push({ tipo: "fantasma", texto: a.ultimoLogon ? `Sem logon no AD há ${Math.floor(d)} dias` : "Nunca logou no AD" }); }
    if (sup.suporte === "sem-suporte") p.push({ tipo: "suporte", texto: `${so}${build ? ` (build ${build})` : ""} sem suporte desde ${sup.fim}` });
    else if (sup.suporte === "vence") p.push({ tipo: "suporte", texto: `Suporte termina em ${sup.fim}` });
    else if (sup.suporte === "verificar") p.push({ tipo: "suporte", texto: "Verificar versão do sistema" });
    if (o && a && a.so && /windows (\d+)/i.test(o.so) && /windows (\d+)/i.test(a.so) && o.so.match(/windows (\d+)/i)![1] !== a.so.match(/windows (\d+)/i)![1])
      p.push({ tipo: "suporte", texto: `Sistema diverge: OCS diz ${o.so}, AD diz ${a.so}` });
    const pad = tipo === "Servidor" || tipo === "VM" && /server/i.test(so) ? PADRAO_NOME.servidor : PADRAO_NOME.estacao;
    if (!pad.test(norm(m.nome))) p.push({ tipo: "nome", texto: "Nome fora do padrão" });
    if (o && o.tag && norm(o.tag) !== k) p.push({ tipo: "cadastro", texto: `TAG “${o.tag}” diferente do nome` });
    if (o && !o.tag) p.push({ tipo: "cadastro", texto: "TAG vazio" });
    if (o && temCampos.length) { const falta = temCampos.filter((c) => !clean(o.admin[c])); if (falta.length) p.push({ tipo: "cadastro", texto: "Falta: " + falta.join(", ").toLowerCase() }); }
    if (o && !m.serialValido && tipo !== "VM") p.push({ tipo: "serial", texto: "Sem número de série (identificar pela etiqueta)" });
    if (o && m.serialValido && porSerial[o.serial]?.length > 1) p.push({ tipo: "duplicado", texto: `Mesmo número de série de ${porSerial[o.serial].filter((x) => x !== k).join(", ")}` });
    if (o && maisNova && o.agente && cmp(ver(o.agente), ver(maisNova)) < 0) p.push({ tipo: "agente", texto: `Agente desatualizado (${o.agente})` });
    if (o && o.ramMB != null && o.ramMB < 8192 && tipo !== "Servidor" && tipo !== "VM") p.push({ tipo: "hardware", texto: `${Math.round(o.ramMB / 1024)} GB de memória` });
    return m;
  });
  if (filtro.tipo) maquinas = maquinas.filter((m) => m.tipo === filtro.tipo);

  const ids = (l: Maquina[]) => l.map((m) => m.nome);
  const pct = (n: number, d: number) => (d ? n / d : null);
  const adHab = maquinas.filter((m) => m.noAD && ad.get(m.chave)!.habilitado !== false);
  const cob = adHab.filter((m) => m.noOCS);
  const noOcs = maquinas.filter((m) => m.noOCS);
  const emDia = noOcs.filter((m) => !m.problemas.some((p) => p.tipo === "inventario"));
  const est = maquinas.filter((m) => m.tipo === "Notebook" || m.tipo === "Desktop" || (m.tipo === "VM" && !/server/i.test(m.so)));
  const srv = maquinas.filter((m) => !est.includes(m));
  const ok = (m: Maquina) => m.suporte === "suportado" || m.suporte === "vence";
  const has = (t: string) => maquinas.filter((m) => m.problemas.some((p) => p.tipo === t));
  const semSerial = noOcs.filter((m) => m.tipo !== "VM");

  if (!e.ocs.temContato) avisos.push("A exportação do OCS não trouxe a coluna Last contact: o inventário em dia usa a data do último inventário.");
  if (!e.ocs.temAgente) avisos.push("A exportação do OCS não trouxe a versão do agente.");
  if (!e.ocs.temRam) avisos.push("A exportação do OCS não trouxe a memória (RAM).");
  if (!temCampos.length) avisos.push("O OCS ainda não tem os campos de dados administrativos (PATRIMONIO, SETOR, RESPONSAVEL, LOCAL).");

  // usuários
  const us = e.usuarios ?? [];
  const usHab = us.filter((u) => u.habilitado === true);
  const semDados = us.filter((u) => u.habilitado == null && !/^defaultaccount$/i.test(u.login));
  if (us.length && semDados.length) avisos.push(`${semDados.length} contas do AD vieram sem Enabled e último logon: rode a exportação de usuários com uma conta de administrador do domínio.`);
  const semUso = usHab.filter((u) => dias(u.ultimoLogon, base) > 90);
  const pne = usHab.filter((u) => u.senhaNuncaExpira === true);

  const I = (valor: number | null, l: Maquina[] | string[], extra: Partial<Ind> = {}): Ind => ({ valor, ids: (l as any[]).map((x) => (typeof x === "string" ? x : x.nome)), ...extra });
  return {
    base, maquinas, avisos,
    indicadores: {
      cobertura: I(pct(cob.length, adHab.length), adHab.filter((m) => !m.noOCS), { n: cob.length, de: adHab.length }),
      foraDominio: I(has("foraDominio").length, has("foraDominio")),
      inventarioEmDia: I(pct(emDia.length, noOcs.length), noOcs.filter((m) => !emDia.includes(m)), { n: emDia.length, de: noOcs.length }),
      fantasmas: I(has("fantasma").length, has("fantasma")),
      cadastroCompleto: temCampos.length === CAMPOS_CADASTRO.length
        ? I(pct(noOcs.filter((m) => !m.problemas.some((p) => p.tipo === "cadastro")).length, noOcs.length), noOcs.filter((m) => m.problemas.some((p) => p.tipo === "cadastro")), { de: noOcs.length })
        : I(null, [], { nota: "Crie no OCS os campos PATRIMONIO, SETOR, RESPONSAVEL e LOCAL" }),
      nomePadrao: I(pct(maquinas.length - has("nome").length, maquinas.length), has("nome"), { n: maquinas.length - has("nome").length, de: maquinas.length }),
      serialValido: I(pct(semSerial.filter((m) => m.serialValido).length, semSerial.length), semSerial.filter((m) => !m.serialValido), { n: semSerial.filter((m) => m.serialValido).length, de: semSerial.length }),
      duplicados: I(has("duplicado").length, has("duplicado")),
      estacoesSuportadas: I(pct(est.filter(ok).length, est.length), est.filter((m) => !ok(m)), { n: est.filter(ok).length, de: est.length }),
      servidoresSuportados: I(pct(srv.filter(ok).length, srv.length), srv.filter((m) => !ok(m) || m.suporte === "vence"), { n: srv.filter(ok).length, de: srv.length }),
      agenteAtualizado: e.ocs.temAgente ? I(pct(noOcs.length - has("agente").length, noOcs.length), has("agente"), { n: noOcs.length - has("agente").length, de: noOcs.length, nota: maisNova ? "Mais recente: " + maisNova : undefined }) : I(null, [], { nota: "Exporte a versão do agente no OCS" }),
      hardwareAbaixo: e.ocs.temRam ? I(has("hardware").length, has("hardware")) : I(null, [], { nota: "Exporte a coluna RAM no OCS" }),
      contasSemUso: us.length ? I(semUso.length, semUso.map((u) => u.login), { de: usHab.length }) : I(null, [], { nota: "Importe o ad_usuarios.csv" }),
      senhaNuncaExpira: us.length ? I(pne.length, pne.map((u) => u.login), { de: usHab.length }) : I(null, [], { nota: "Importe o ad_usuarios.csv" }),
    },
  };
}

// ------------------------------------------------------------------ metas
export type ChaveInd = keyof Resultado["indicadores"];
export const METAS_PADRAO: Record<ChaveInd, { rotulo: string; tipo: "pct" | "n"; direcao: "max" | "min"; meta: number | null; tol: number }> = {
  cobertura: { rotulo: "Cobertura do OCS", tipo: "pct", direcao: "max", meta: 100, tol: 10 },
  foraDominio: { rotulo: "Máquinas fora do domínio", tipo: "n", direcao: "min", meta: 0, tol: 2 },
  inventarioEmDia: { rotulo: "Inventário em dia (7 dias)", tipo: "pct", direcao: "max", meta: 95, tol: 10 },
  fantasmas: { rotulo: "Máquinas fantasmas (AD sem logon há 30 dias)", tipo: "n", direcao: "min", meta: 0, tol: 3 },
  cadastroCompleto: { rotulo: "Cadastro completo", tipo: "pct", direcao: "max", meta: 100, tol: 15 },
  nomePadrao: { rotulo: "Nome no padrão", tipo: "pct", direcao: "max", meta: 100, tol: 15 },
  serialValido: { rotulo: "Identificáveis pelo número de série", tipo: "pct", direcao: "max", meta: null, tol: 0 },
  duplicados: { rotulo: "Duplicados", tipo: "n", direcao: "min", meta: 0, tol: 2 },
  estacoesSuportadas: { rotulo: "Estações com sistema suportado", tipo: "pct", direcao: "max", meta: 100, tol: 15 },
  servidoresSuportados: { rotulo: "Servidores com sistema suportado", tipo: "pct", direcao: "max", meta: 100, tol: 15 },
  agenteAtualizado: { rotulo: "Agente OCS atualizado", tipo: "pct", direcao: "max", meta: 95, tol: 10 },
  hardwareAbaixo: { rotulo: "Estações com menos de 8 GB", tipo: "n", direcao: "min", meta: null, tol: 0 },
  contasSemUso: { rotulo: "Contas ativas sem uso (90 dias)", tipo: "n", direcao: "min", meta: 0, tol: 3 },
  senhaNuncaExpira: { rotulo: "Contas com senha que nunca expira", tipo: "n", direcao: "min", meta: 0, tol: 3 },
};
export type StatusMeta = "ok" | "warn" | "crit" | "na" | "nodata";
export const ROTULO_STATUS: Record<StatusMeta, string> = { ok: "Na meta", warn: "Atenção", crit: "Fora da meta", na: "Informativo", nodata: "Sem dados" };
export function statusMeta(chave: ChaveInd, valor: number | null, metas: Partial<Record<ChaveInd, number | null>> = {}): StatusMeta {
  const d = METAS_PADRAO[chave]; const m = chave in metas ? metas[chave] : d.meta;
  if (valor == null || isNaN(valor)) return "nodata";
  if (m == null) return "na";
  const v = d.tipo === "pct" ? valor * 100 : valor;
  if (d.direcao === "max") return v >= m ? "ok" : v >= m - d.tol ? "warn" : "crit";
  return v <= m ? "ok" : v <= m + d.tol ? "warn" : "crit";
}
