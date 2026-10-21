/**
 * Indicadores de celulares a partir do relatório de dispositivos do Pulsus MDM.
 *
 * Módulo puro (sem React, sem banco, sem DOM): recebe o texto do CSV exportado do
 * Pulsus (devices_report.csv, separado por ";") e devolve os indicadores do painel.
 * Pode rodar no navegador ou no servidor (Node 18+).
 *
 * Uso típico:
 *   const rel = lerRelatorioPulsus(textoDoCsv);        // guarde `rel` no banco (relatório atual)
 *   const k   = calcularIndicadores(rel, grupo?);       // cartões do painel
 *   const st  = statusMeta("sync24", k.sync24.valor);   // "ok" | "warn" | "crit" | "na" | "nodata"
 *
 * As regras estão documentadas em INDICADORES.md. Não altere uma regra sem atualizar
 * o documento e os valores esperados em teste/esperado-21-10-2026.json.
 */

// ---------------------------------------------------------------- tipos

export interface Dispositivo {
  id: string;            // ID Pulsus
  grupo: string;
  status: string;        // "active" | "wiped" | ...
  nome: string;          // Nome + Sobrenome, normalizado
  plat: string;          // "Android" | "Windows"
  cod: string;           // código do modelo (ex.: SM-A066M)
  os: string;            // versão do sistema ("16", "Microsoft Windows 11 Pro")
  pat: string;           // Patrimônio
  frota: string;         // Nº Frota
  setor: string;
  t1: string;            // número lido do chip (slot 1, ou slot 2 se o 1 estiver vazio)
  ts: string;            // número informado por SMS
  n1: string;            // número do slot 1
  n2: string;            // número do slot 2
  iccid: string;         // primeiro ICCID encontrado
  iccid1: string;
  iccid2: string;
  oper: string;
  oper1: string;
  oper2: string;
  dualSim: boolean;      // tem IMEI 2
  imei: string;
  serial: string;
  ativ: string;          // data de ativação (ISO local, sem fuso)
  sync: string;          // última sincronização (ISO local, sem fuso)
  bat: number;           // % bateria
  wifi: boolean;
  ram: number;           // GB
  ramLivre: number | null; // %
  armGB: number;
  armLivre: number | null; // %
}

export interface Relatorio {
  /** Data-base do relatório = a última sincronização mais recente do arquivo. */
  base: string;
  dispositivos: Dispositivo[];
}

export type TipoProblema =
  | "parado" | "usuario" | "patrimonio" | "frota" | "duplicado" | "numero" | "divergencia" | "ciclo" | "status";

export interface Problema { tipo: TipoProblema; texto: string }

export interface Indicadores {
  total: number;
  ativos: number;
  inativos: number;
  sync24: { valor: number | null; n: number; de: number; ids: string[] };
  parados: { valor: number; ids: string[] };
  cadastro: {
    valor: number | null; n: number; de: number; ids: string[];
    partes: { usuario: number; patrimonio: number; numero: number; chips: number; frota: number; exigeFrota: number };
  };
  duplicidades: { valor: number; ids: string[] };
  semNumero: { valor: number; ids: string[] };
  divergencia: { valor: number; ids: string[] };
  fimCiclo: { valor: number | null; n: number; de: number; ids: string[] };
  reserva: { valor: number | null; prontos: number; total: number; ids: string[] };
  problemas: Record<string, Problema[]>;
}

// ---------------------------------------------------------------- leitura do CSV

function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ";") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

export const MODELOS: Record<string, string> = {
  "SM-A066M": "Galaxy A06", "SM-A065M": "Galaxy A06", "SM-A207M": "Galaxy A20", "SM-A055M": "Galaxy A05",
  "SM-A235M": "Galaxy A23", "SM-A115M": "Galaxy A11", "SM-A127M": "Galaxy A12", "SM-A047M": "Galaxy A04",
  "SM-A037M": "Galaxy A03", "SM-T290": 'Tab A 8"', "SM-T220": "Tab A7 Lite", "SM-T225": "Tab A7 Lite", "SM-X115": "Tab A9",
  "IdeaPad 3 15ALC6": "Notebook Lenovo IdeaPad 3", "IdeaPad 3 15IML05": "Notebook Lenovo IdeaPad 3",
  "VJFE52F11X-B2111H": "Notebook Positivo", "Desktop": "Desktop",
};

/** Normaliza telefone para "(19) 99999-9999". Corrige o 55 duplicado que o Pulsus às vezes grava (+5555...). */
export function formatarTelefone(x: string): string {
  let d = (x || "").replace(/\D/g, "");
  while (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : (x || "").trim();
}
const clean = (s: string) => (s || "").replace(/\s+/g, " ").trim();
const nomeFmt = (s: string) => clean(s).toLowerCase().split(" ").filter(Boolean)
  .map((w) => (["da", "de", "do", "dos", "das"].includes(w) ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
const toISO = (s: string) => (s || "").trim().replace(" ", "T");

const COLUNAS_OBRIGATORIAS = ["Grupo", "Status", "ID Pulsus", "Nome", "Modelo", "Última Sincronização"];

/**
 * Lê o CSV do Pulsus. Lança Error com mensagem em português se o arquivo não for o relatório esperado.
 * Dica: se o texto vier com "�", decodifique o arquivo como windows-1252 antes de chamar.
 */
export function lerRelatorioPulsus(text: string): Relatorio {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("Arquivo vazio.");
  const h = rows[0].map((x) => x.trim());
  const ix = (n: string) => h.indexOf(n);
  const faltam = COLUNAS_OBRIGATORIAS.filter((n) => ix(n) < 0);
  if (faltam.length) throw new Error("Este arquivo não parece um relatório de dispositivos do Pulsus (faltam as colunas: " + faltam.join(", ") + ").");
  const g = (r: string[], n: string) => (ix(n) >= 0 ? clean(r[ix(n)] ?? "") : "");
  const num = (r: string[], n: string) => Number(g(r, n)) || 0;
  const dispositivos: Dispositivo[] = rows.slice(1).map((r) => {
    const memT = num(r, "Memória Total"), armT = num(r, "Armazenamento Total");
    return {
      id: g(r, "ID Pulsus"), grupo: g(r, "Grupo"), status: g(r, "Status"),
      nome: nomeFmt(g(r, "Nome") + " " + g(r, "Sobrenome")), plat: g(r, "Plataforma"), cod: g(r, "Modelo"),
      os: g(r, "Versão SO"), pat: g(r, "Patrimônio"), frota: g(r, "Nº Frota"), setor: g(r, "Setor"),
      t1: formatarTelefone(g(r, "Número de Telefone 1") || g(r, "Número de Telefone 2")),
      ts: formatarTelefone(g(r, "Número Telefônico (por SMS)")),
      n1: formatarTelefone(g(r, "Número de Telefone 1")), n2: formatarTelefone(g(r, "Número de Telefone 2")),
      iccid: g(r, "ICCID 1") || g(r, "ICCID 2"), iccid1: g(r, "ICCID 1"), iccid2: g(r, "ICCID 2"),
      oper: g(r, "Operadora 1") || g(r, "Operadora 2"), oper1: g(r, "Operadora 1"), oper2: g(r, "Operadora 2"),
      dualSim: !!g(r, "IMEI 2"), imei: g(r, "IMEI 1"), serial: g(r, "Serial"),
      ativ: toISO(g(r, "Data da Ativação")), sync: toISO(g(r, "Última Sincronização")),
      bat: num(r, "Bateria"), wifi: g(r, "Wifi") === "True",
      ram: Math.round((memT / 2 ** 30) * 10) / 10,
      ramLivre: memT ? Math.round((num(r, "Memória Disponível") / memT) * 100) : null,
      armGB: Math.round(armT / 2 ** 30),
      armLivre: armT ? Math.round((num(r, "Armazenamento Disponível") / armT) * 100) : null,
    };
  }).filter((d) => d.id);
  const base = dispositivos.map((d) => d.sync).filter(Boolean).sort().pop() || "";
  return { base, dispositivos };
}

// ---------------------------------------------------------------- regras

const GENERICO = /\b(vago|reserva|tempor[aá]rio|provis[oó]rio|coringa|teste)\b/i;

export const nomeModelo = (d: Dispositivo) => MODELOS[d.cod] || d.cod;
const ativo = (d: Dispositivo) => d.status === "active";
const android = (d: Dispositivo) => d.plat === "Android";
/** Dias desde a última sincronização, contados a partir da data-base do relatório. */
export const diasSemSync = (d: Dispositivo, base: string) =>
  d.sync ? (new Date(base).getTime() - new Date(d.sync).getTime()) / 864e5 : 9999;
export const usuarioIdentificado = (d: Dispositivo) => {
  const n = d.nome.toLowerCase();
  if (!n || GENERICO.test(n)) return false;
  if (["ti", "ti ti", "manobrista"].includes(n)) return false;
  if (n === d.grupo.toLowerCase() || n.startsWith("tablet")) return false;
  return true;
};
export const patrimonioValido = (d: Dispositivo) => /^\d{3,4}$/.test(d.pat);
export const frotaValida = (d: Dispositivo) => /^\d{3}$/.test(d.frota);
const temChip = (d: Dispositivo) => !!d.iccid;
const temNumero = (d: Dispositivo) => !!(d.t1 || d.ts);
export const exigeFrota = (d: Dispositivo) => /tracking|caminh/i.test(d.grupo);
export const fimDeCiclo = (d: Dispositivo) => android(d) && Number(d.os) > 0 && Number(d.os) <= 12;
export const cadastroCompleto = (d: Dispositivo) =>
  usuarioIdentificado(d) && patrimonioValido(d) && (!temChip(d) || temNumero(d)) && (!exigeFrota(d) || frotaValida(d));
export const quantidadeChips = (d: Dispositivo) =>
  (d.iccid1 || d.oper1 ? 1 : 0) + (d.iccid2 || d.oper2 ? 1 : 0) || (d.iccid ? 1 : 0);

function mapaDuplicados(list: Dispositivo[], key: (d: Dispositivo) => string, escopo?: (d: Dispositivo) => string) {
  const m: Record<string, string[]> = {};
  list.forEach((d) => { const v = key(d); if (!v) return; const k = (escopo ? escopo(d) + "|" : "") + v; (m[k] = m[k] || []).push(d.id); });
  const out: Record<string, string[]> = {};
  Object.values(m).forEach((ids) => { if (ids.length > 1) ids.forEach((id) => (out[id] = ids.filter((x) => x !== id))); });
  return out;
}

/** Problemas por aparelho (ID Pulsus → lista). Considera o relatório inteiro, não só um grupo. */
export function problemasPorAparelho(rel: Relatorio): Record<string, Problema[]> {
  const all = rel.dispositivos, base = rel.base;
  const dPat = mapaDuplicados(all, (d) => (patrimonioValido(d) ? d.pat : ""));
  const dFrota = mapaDuplicados(all, (d) => (frotaValida(d) ? d.frota : ""), (d) => d.grupo);
  const dChip = mapaDuplicados(all, (d) => d.iccid);
  const res: Record<string, Problema[]> = {};
  all.forEach((d) => {
    if (!ativo(d)) { res[d.id] = [{ tipo: "status", texto: "Status " + d.status }]; return; }
    const p: Problema[] = [];
    const dd = diasSemSync(d, base);
    if (dd > 7) p.push({ tipo: "parado", texto: `Parado há ${Math.floor(dd)} dias` });
    if (!usuarioIdentificado(d)) p.push({ tipo: "usuario", texto: d.nome ? `Usuário genérico (${d.nome})` : "Sem usuário" });
    if (!d.pat) p.push({ tipo: "patrimonio", texto: "Sem patrimônio" });
    else if (!patrimonioValido(d)) p.push({ tipo: "patrimonio", texto: `Patrimônio inválido (${d.pat})` });
    if (exigeFrota(d)) {
      if (!d.frota) p.push({ tipo: "frota", texto: "Sem Nº Frota" });
      else if (!frotaValida(d)) p.push({ tipo: "frota", texto: `Nº Frota inválido (${d.frota})` });
    }
    if (dPat[d.id]) p.push({ tipo: "duplicado", texto: `Patrimônio ${d.pat} repetido (#${dPat[d.id].join(", #")})` });
    if (dFrota[d.id]) p.push({ tipo: "duplicado", texto: `Nº Frota ${d.frota} repetido (#${dFrota[d.id].join(", #")})` });
    if (dChip[d.id]) p.push({ tipo: "duplicado", texto: `Chip repetido (#${dChip[d.id].join(", #")})` });
    if (temChip(d) && !temNumero(d)) p.push({ tipo: "numero", texto: "Chip sem número registrado" });
    if (d.t1 && d.ts && d.t1 !== d.ts) p.push({ tipo: "divergencia", texto: `Número do chip ${d.t1} difere do SMS ${d.ts}` });
    if (fimDeCiclo(d)) p.push({ tipo: "ciclo", texto: `Android ${d.os} (fim de ciclo)` });
    res[d.id] = p;
  });
  return res;
}

// ---------------------------------------------------------------- indicadores do parque

/** Os 8 indicadores do painel. `grupo` vazio = todos os grupos. Percentuais vêm como fração (0.839 = 83,9%). */
export function calcularIndicadores(rel: Relatorio, grupo = ""): Indicadores {
  const base = rel.base;
  const problemas = problemasPorAparelho(rel);
  const L = rel.dispositivos.filter((d) => !grupo || d.grupo === grupo);
  const A = L.filter(ativo), AA = A.filter(android);
  const pct = (n: number, t: number) => (t ? n / t : null);
  const ids = (arr: Dispositivo[]) => arr.map((d) => d.id);
  const dup = A.filter((d) => problemas[d.id].some((p) => p.tipo === "duplicado" || /inválido/.test(p.texto)));
  const sync24 = A.filter((d) => diasSemSync(d, base) <= 1);
  const parados = A.filter((d) => diasSemSync(d, base) > 7);
  const cad = A.filter(cadastroCompleto);
  const chip = A.filter(temChip), semNum = chip.filter((d) => !temNumero(d));
  const diverg = A.filter((d) => d.t1 && d.ts && d.t1 !== d.ts);
  const ciclo = AA.filter(fimDeCiclo);
  const reserva = A.filter((d) => GENERICO.test(d.nome));
  const prontos = reserva.filter((d) => diasSemSync(d, base) <= 7 && d.bat >= 50);
  return {
    total: L.length, ativos: A.length, inativos: L.length - A.length,
    sync24: { valor: pct(sync24.length, A.length), n: sync24.length, de: A.length, ids: ids(A.filter((d) => diasSemSync(d, base) > 1)) },
    parados: { valor: parados.length, ids: ids(parados) },
    cadastro: {
      valor: pct(cad.length, A.length), n: cad.length, de: A.length, ids: ids(A.filter((d) => !cadastroCompleto(d))),
      partes: {
        usuario: A.filter(usuarioIdentificado).length, patrimonio: A.filter(patrimonioValido).length,
        numero: chip.filter(temNumero).length, chips: chip.length,
        frota: A.filter(exigeFrota).filter(frotaValida).length, exigeFrota: A.filter(exigeFrota).length,
      },
    },
    duplicidades: { valor: dup.length, ids: ids(dup) },
    semNumero: { valor: semNum.length, ids: ids(semNum) },
    divergencia: { valor: diverg.length, ids: ids(diverg) },
    fimCiclo: { valor: pct(ciclo.length, AA.length), n: ciclo.length, de: AA.length, ids: ids(ciclo) },
    reserva: { valor: reserva.length ? prontos.length / reserva.length : null, prontos: prontos.length, total: reserva.length, ids: ids(reserva) },
    problemas,
  };
}

// ---------------------------------------------------------------- metas

export type ChaveIndicador = "sync24" | "parados" | "cadastro" | "duplicidades" | "semNumero" | "divergencia" | "fimCiclo" | "reserva";

/** meta em % para tipo "pct"; tol = faixa de "Atenção" além da meta (mesma unidade). */
export const METAS_PADRAO: Record<ChaveIndicador, { rotulo: string; tipo: "pct" | "n"; direcao: "max" | "min"; meta: number; tol: number }> = {
  sync24: { rotulo: "Sincronização em 24h", tipo: "pct", direcao: "max", meta: 95, tol: 10 },
  parados: { rotulo: "Parados há mais de 7 dias", tipo: "n", direcao: "min", meta: 3, tol: 7 },
  cadastro: { rotulo: "Cadastro completo", tipo: "pct", direcao: "max", meta: 100, tol: 15 },
  duplicidades: { rotulo: "Duplicidades e valores inválidos", tipo: "n", direcao: "min", meta: 0, tol: 5 },
  semNumero: { rotulo: "Chip sem número registrado", tipo: "n", direcao: "min", meta: 0, tol: 10 },
  divergencia: { rotulo: "Número do chip × SMS divergente", tipo: "n", direcao: "min", meta: 0, tol: 3 },
  fimCiclo: { rotulo: "Frota em fim de ciclo (Android ≤ 12)", tipo: "pct", direcao: "min", meta: 5, tol: 10 },
  reserva: { rotulo: "Estoque reserva pronto para uso", tipo: "pct", direcao: "max", meta: 100, tol: 30 },
};

export type StatusMeta = "ok" | "warn" | "crit" | "na" | "nodata";
export const ROTULO_STATUS: Record<StatusMeta, string> = { ok: "Na meta", warn: "Atenção", crit: "Fora da meta", na: "Sem meta", nodata: "Sem dados" };

/** Compara o valor com a meta. `metas` permite sobrescrever as metas padrão (valores salvos pelo usuário). */
export function statusMeta(chave: ChaveIndicador, valor: number | null, metas: Partial<Record<ChaveIndicador, number | null>> = {}): StatusMeta {
  const d = METAS_PADRAO[chave];
  const m = chave in metas ? metas[chave] : d.meta;
  if (valor == null || isNaN(valor)) return "nodata";
  if (m == null) return "na";
  const v = d.tipo === "pct" ? valor * 100 : valor;
  if (d.direcao === "max") return v >= m ? "ok" : v >= m - d.tol ? "warn" : "crit";
  return v <= m ? "ok" : v <= m + d.tol ? "warn" : "crit";
}

// ---------------------------------------------------------------- análises

const mediana = (arr: (number | null)[]) => {
  const v = arr.filter((x): x is number => x != null && !isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export interface AnaliseModelo {
  nome: string; codigos: string; plataforma: string; qtd: number; pct: number;
  versoes: [string, number][]; grupos: [string, number][];
  ramGB: number | null; armazenamentoGB: number | null; anosNoMDM: number | null;
  fimCiclo: number; sync24: number; parados: number;
  armLivre: number | null; ramLivre: number | null; bateria: number | null; poucoEspaco: number;
}

/** Análise por modelo (só aparelhos ativos), maior quantidade primeiro. */
export function analisarModelos(rel: Relatorio, grupo = ""): AnaliseModelo[] {
  const base = rel.base;
  const L = rel.dispositivos.filter((d) => ativo(d) && (!grupo || d.grupo === grupo));
  const by: Record<string, Dispositivo[]> = {};
  L.forEach((d) => { const m = nomeModelo(d); (by[m] = by[m] || []).push(d); });
  return Object.entries(by).map(([nome, ds]) => {
    const os: Record<string, number> = {}; ds.forEach((d) => (os[d.os] = (os[d.os] || 0) + 1));
    const gr: Record<string, number> = {}; ds.forEach((d) => (gr[d.grupo] = (gr[d.grupo] || 0) + 1));
    return {
      nome, codigos: [...new Set(ds.map((d) => d.cod))].join(", "), plataforma: ds[0].plat, qtd: ds.length, pct: ds.length / L.length,
      versoes: Object.entries(os).sort((a, b) => b[1] - a[1]), grupos: Object.entries(gr).sort((a, b) => b[1] - a[1]),
      ramGB: mediana(ds.map((d) => d.ram || null)), armazenamentoGB: mediana(ds.map((d) => d.armGB || null)),
      anosNoMDM: mediana(ds.map((d) => (d.ativ ? (new Date(base).getTime() - new Date(d.ativ).getTime()) / (365.25 * 864e5) : null))),
      fimCiclo: ds.filter(fimDeCiclo).length, sync24: ds.filter((d) => diasSemSync(d, base) <= 1).length / ds.length,
      parados: ds.filter((d) => diasSemSync(d, base) > 7).length,
      armLivre: mediana(ds.map((d) => d.armLivre)), ramLivre: mediana(ds.map((d) => d.ramLivre)), bateria: mediana(ds.map((d) => d.bat)),
      poucoEspaco: ds.filter((d) => d.armLivre != null && d.armLivre < 15).length,
    };
  }).sort((a, b) => b.qtd - a.qtd);
}

export interface AnaliseVersao {
  nome: string; android: boolean; versao: number | null; qtd: number; pct: number;
  modelos: [string, number][]; sync24: number; parados: number; podeAtualizar: number;
  situacao: "atual" | "anterior" | "fim" | "outro";
}

/** Análise por versão do sistema. "podeAtualizar" = abaixo da maior versão vista no mesmo modelo. */
export function analisarVersoes(rel: Relatorio, grupo = ""): AnaliseVersao[] {
  const base = rel.base;
  const ativos = rel.dispositivos.filter(ativo);
  const L = ativos.filter((d) => !grupo || d.grupo === grupo);
  const nomeOS = (d: Dispositivo) => (android(d) ? "Android " + d.os : d.os.replace("Microsoft ", ""));
  const maxModelo: Record<string, number> = {};
  ativos.filter(android).forEach((d) => { const m = nomeModelo(d); maxModelo[m] = Math.max(maxModelo[m] || 0, Number(d.os) || 0); });
  const maxAndroid = Math.max(0, ...ativos.filter(android).map((d) => Number(d.os) || 0));
  const by: Record<string, Dispositivo[]> = {};
  L.forEach((d) => { const k = nomeOS(d); (by[k] = by[k] || []).push(d); });
  return Object.entries(by).map(([nome, ds]) => {
    const mods: Record<string, number> = {}; ds.forEach((d) => (mods[nomeModelo(d)] = (mods[nomeModelo(d)] || 0) + 1));
    const v = android(ds[0]) ? Number(ds[0].os) : null;
    return {
      nome, android: v != null, versao: v, qtd: ds.length, pct: ds.length / L.length,
      modelos: Object.entries(mods).sort((a, b) => b[1] - a[1]),
      sync24: ds.filter((d) => diasSemSync(d, base) <= 1).length / ds.length,
      parados: ds.filter((d) => diasSemSync(d, base) > 7).length,
      podeAtualizar: ds.filter((d) => android(d) && Number(d.os) < (maxModelo[nomeModelo(d)] || 0)).length,
      situacao: (v == null ? "outro" : v <= 12 ? "fim" : v === maxAndroid ? "atual" : "anterior") as AnaliseVersao["situacao"],
    };
  }).sort((a, b) => Number(b.android) - Number(a.android) || (b.versao || 0) - (a.versao || 0));
}

export interface AnaliseChips {
  ativos: number; comNumero: number; numeroDoChip: number; numeroPorSMS: number; numeroNosDois: number;
  numerosDistintos: number; comChip: number; semChip: number; aceitam2Chips: number; com2Chips: number;
  listaCom2Chips: { id: string; nome: string; grupo: string; operadoras: string }[];
  totalChips: number; operadoras: [string, number][];
}

/** Chips e números cadastrados (só aparelhos ativos). */
export function analisarChips(rel: Relatorio, grupo = ""): AnaliseChips {
  const A = rel.dispositivos.filter((d) => ativo(d) && (!grupo || d.grupo === grupo));
  const comNumero = A.filter(temNumero), dois = A.filter((d) => quantidadeChips(d) >= 2), comChip = A.filter((d) => quantidadeChips(d) >= 1);
  const oper: Record<string, number> = {};
  A.forEach((d) => {
    ([[d.iccid1, d.oper1], [d.iccid2, d.oper2]] as [string, string][]).forEach(([ic, op]) => {
      if (ic || op) { const k = (op || "Não informada").replace(/ BR$/, ""); oper[k] = (oper[k] || 0) + 1; }
    });
  });
  const numeros = new Set<string>();
  A.forEach((d) => [d.n1, d.n2, d.ts].forEach((n) => n && numeros.add(n)));
  return {
    ativos: A.length, comNumero: comNumero.length,
    numeroDoChip: A.filter((d) => d.t1).length, numeroPorSMS: A.filter((d) => d.ts).length, numeroNosDois: A.filter((d) => d.t1 && d.ts).length,
    numerosDistintos: numeros.size, comChip: comChip.length, semChip: A.length - comChip.length,
    aceitam2Chips: A.filter((d) => d.dualSim).length, com2Chips: dois.length,
    listaCom2Chips: dois.map((d) => ({ id: d.id, nome: d.nome, grupo: d.grupo, operadoras: [d.oper1, d.oper2].filter(Boolean).map((o) => o.replace(/ BR$/, "")).join(" + ") })),
    totalChips: A.reduce((s, d) => s + quantidadeChips(d), 0), operadoras: Object.entries(oper).sort((a, b) => b[1] - a[1]),
  };
}
