/**
 * Indicadores dos chamados de TI importados do Relatorio_Chamados.xlsx.
 *
 * Módulo puro (sem React, sem banco): recebe a lista de chamados da API (/api/chamados)
 * e devolve os números da página Chamados e os valores mensais do Painel de Metas.
 *
 * Regras:
 * - SLA: usa a coluna SLA do sistema de chamados ("No prazo" / "Fora do Prazo"); chamados sem SLA ficam fora da conta.
 * - Satisfação (CSAT): notas 4 e 5 sobre os chamados avaliados.
 * - Tempos em horas corridas (contam noites e fins de semana), pela mediana — a média é puxada por poucos chamados longos.
 *   Primeira resposta: do registro de abertura até o primeiro trâmite de outra pessoa que não o solicitante.
 *   Resolução: da abertura até a data de encerramento.
 * - Período, mês e comparativos usam a data de abertura do chamado.
 * - Fora do horário: abertos antes das 7h, a partir das 18h ou no fim de semana.
 */

export interface Chamado {
  id: string;
  assunto: string;
  descricao?: string;
  colaborador: string;
  revenda: string;
  tipo: string;
  categoria: string;
  detalhe: string;
  aberto_em: string;               // "AAAA-MM-DD HH:MM:SS" (hora local)
  encerrado_em: string | null;
  prazo_em: string | null;
  sla: string;                     // "No prazo" | "Fora do Prazo" | ""
  responsavel: string;
  status: string;
  avaliacao: number | null;
  primeira_resposta_em: string | null;
  interacoes: number;
}

export interface Filtro { ano?: number | ""; mes?: number | ""; revenda?: string; categoria?: string; responsavel?: string }

export const HORARIO = { inicio: 7, fim: 18 };
export const STATUS_ENCERRADO = ["Fechado", "Resolvido", "Cancelado"];
export const SEM_RESPONSAVEL = "(sem responsável)";

const data = (s: string | null) => (s ? new Date(s.replace(" ", "T")) : null);
export const horasEntre = (a: string | null, b: string | null): number | null => {
  const x = data(a), y = data(b);
  if (!x || !y) return null;
  return Math.max(0, (y.getTime() - x.getTime()) / 36e5);
};
export const emAberto = (c: Chamado) => !STATUS_ENCERRADO.includes(c.status);
export const atrasado = (c: Chamado, agora = new Date()) => emAberto(c) && !!c.prazo_em && data(c.prazo_em)! < agora;
export const foraDoPrazo = (c: Chamado) => /fora/i.test(c.sla);
export const noPrazo = (c: Chamado) => /no prazo/i.test(c.sla);
export const horasResolucao = (c: Chamado) => horasEntre(c.aberto_em, c.encerrado_em);
export const horasPrimeiraResposta = (c: Chamado) => horasEntre(c.aberto_em, c.primeira_resposta_em);

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function percentil(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
}
const razao = (n: number, de: number) => (de ? n / de : null);
const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);

export function aplicarFiltro(lista: Chamado[], f: Filtro = {}): Chamado[] {
  return lista.filter(c =>
    (!f.ano || Number(c.aberto_em.slice(0, 4)) === Number(f.ano)) &&
    (!f.mes || Number(c.aberto_em.slice(5, 7)) === Number(f.mes)) &&
    (!f.revenda || c.revenda === f.revenda) &&
    (!f.categoria || c.categoria === f.categoria) &&
    (!f.responsavel || (c.responsavel || SEM_RESPONSAVEL) === f.responsavel));
}

/** Indicadores com meta (os que vão para o Painel de Metas). */
function indicadoresDe(lista: Chamado[]) {
  const comSla = lista.filter(c => noPrazo(c) || foraDoPrazo(c));
  const avaliados = lista.filter(c => c.avaliacao != null);
  const encerrados = lista.filter(c => !emAberto(c));
  const res = nums(lista.map(horasResolucao));
  const resp = nums(lista.map(horasPrimeiraResposta));
  return {
    volume: { valor: lista.length as number | null },
    sla: { valor: razao(comSla.filter(noPrazo).length, comSla.length), n: comSla.filter(noPrazo).length, de: comSla.length },
    csat: { valor: razao(avaliados.filter(c => c.avaliacao! >= 4).length, avaliados.length), n: avaliados.filter(c => c.avaliacao! >= 4).length, de: avaliados.length },
    primeiraResposta: { valor: mediana(resp), p90: percentil(resp, 0.9), n: resp.length },
    resolucao: { valor: mediana(res), p90: percentil(res, 0.9), n: res.length },
    taxaAvaliacao: { valor: razao(avaliados.length, encerrados.length), n: avaliados.length, de: encerrados.length },
    semResponsavel: { valor: lista.filter(c => !c.responsavel).length as number | null },
  };
}

export type ChaveInd = keyof ReturnType<typeof indicadoresDe>;

function agrupar(lista: Chamado[], chave: (c: Chamado) => string) {
  const m = new Map<string, Chamado[]>();
  lista.forEach(c => { const k = chave(c) || "—"; m.set(k, [...(m.get(k) || []), c]); });
  return m;
}

function resumoGrupo(nome: string, cs: Chamado[]) {
  const k = indicadoresDe(cs);
  const notas = nums(cs.map(c => c.avaliacao));
  return {
    nome, n: cs.length, abertos: cs.filter(emAberto).length,
    sla: k.sla.valor, foraPrazo: cs.filter(foraDoPrazo).length,
    resolucao: k.resolucao.valor, primeiraResposta: k.primeiraResposta.valor,
    nota: notas.length ? notas.reduce((s, x) => s + x, 0) / notas.length : null, avaliados: notas.length,
  };
}

export const FAIXAS = [
  { rotulo: "Até 4 h", ate: 4 }, { rotulo: "4 a 24 h", ate: 24 }, { rotulo: "1 a 3 dias", ate: 72 },
  { rotulo: "3 a 7 dias", ate: 168 }, { rotulo: "Mais de 7 dias", ate: Infinity },
];

export function calcular(todos: Chamado[], filtro: Filtro = {}) {
  const lista = aplicarFiltro(todos, filtro);
  const indicadores = indicadoresDe(lista);
  const notas = nums(lista.map(c => c.avaliacao));

  const meses = [...agrupar(lista, c => c.aberto_em.slice(0, 7))].sort(([a], [b]) => a.localeCompare(b));
  const porMes = meses.map(([mes, cs]) => ({
    mes, abertos: cs.length,
    fechados: lista.filter(c => c.encerrado_em?.slice(0, 7) === mes).length,
    sla: indicadoresDe(cs).sla.valor,
  }));

  const porCategoria = [...agrupar(lista, c => c.categoria)].map(([nome, cs]) => ({
    ...resumoGrupo(nome, cs),
    detalhes: [...agrupar(cs, c => c.detalhe)].map(([d, x]) => ({ nome: d, n: x.length })).sort((a, b) => b.n - a.n),
  })).sort((a, b) => b.n - a.n);

  const porResponsavel = [...agrupar(lista, c => c.responsavel || SEM_RESPONSAVEL)].map(([nome, cs]) => resumoGrupo(nome, cs)).sort((a, b) => b.n - a.n);

  const solicitantes = [...agrupar(lista, c => c.colaborador)].map(([nome, cs]) => ({
    nome, n: cs.length, revenda: cs[0].revenda,
    categorias: [...agrupar(cs, c => c.categoria)].map(([k, x]) => ({ nome: k, n: x.length })).sort((a, b) => b.n - a.n),
  })).sort((a, b) => b.n - a.n);

  // Dia da semana (0 = segunda) × hora
  const calor = Array.from({ length: 7 }, () => Array(24).fill(0));
  let fora = 0;
  lista.forEach(c => {
    const d = data(c.aberto_em)!; const dia = (d.getDay() + 6) % 7; const h = d.getHours();
    calor[dia][h]++;
    if (dia >= 5 || h < HORARIO.inicio || h >= HORARIO.fim) fora++;
  });

  const faixas = FAIXAS.map(f => ({ rotulo: f.rotulo, n: 0 }));
  lista.forEach(c => { const h = horasResolucao(c); if (h != null) faixas[FAIXAS.findIndex(f => h <= f.ate)].n++; });

  return {
    lista, total: lista.length, indicadores,
    notaMedia: notas.length ? notas.reduce((s, x) => s + x, 0) / notas.length : null,
    emAberto: lista.filter(emAberto).length,
    atrasados: lista.filter(c => atrasado(c)).length,
    foraPrazo: lista.filter(foraDoPrazo).length,
    foraHorario: { n: fora, de: lista.length, valor: razao(fora, lista.length) },
    porMes, porCategoria, porResponsavel, solicitantes, calor, faixas,
  };
}

// ------------------------------------------------------------------ metas
export const METAS_PADRAO: Record<ChaveInd, { rotulo: string; tipo: "pct" | "n"; direcao: "max" | "min"; meta: number | null; tol: number; unidade?: string }> = {
  volume: { rotulo: "Chamados abertos", tipo: "n", direcao: "min", meta: null, tol: 0 },
  sla: { rotulo: "SLA cumprido", tipo: "pct", direcao: "max", meta: 90, tol: 5 },
  csat: { rotulo: "Satisfação (notas 4 e 5)", tipo: "pct", direcao: "max", meta: 95, tol: 5 },
  primeiraResposta: { rotulo: "Primeira resposta (mediana, h)", tipo: "n", direcao: "min", meta: 8, tol: 4, unidade: "h" },
  resolucao: { rotulo: "Tempo de resolução (mediana, h)", tipo: "n", direcao: "min", meta: 24, tol: 12, unidade: "h" },
  taxaAvaliacao: { rotulo: "Chamados avaliados", tipo: "pct", direcao: "max", meta: 80, tol: 10 },
  semResponsavel: { rotulo: "Chamados sem responsável", tipo: "n", direcao: "min", meta: 0, tol: 2 },
};
export const CHAVES = Object.keys(METAS_PADRAO) as ChaveInd[];

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

/** Um item por mês de abertura, no formato do Painel de Metas (todas as revendas e categorias). */
export function mesesParaPainel(todos: Chamado[], metas: Partial<Record<ChaveInd, number | null>>) {
  return [...agrupar(todos, c => c.aberto_em.slice(0, 7))].sort(([a], [b]) => a.localeCompare(b)).map(([, cs]) => {
    const k = indicadoresDe(cs);
    const referencia = cs.map(c => c.aberto_em).sort().at(-1)!;
    return {
      referencia,
      indicadores: CHAVES.map(chave => {
        const d = METAS_PADRAO[chave];
        return { chave, rotulo: d.rotulo, tipo: d.tipo, direcao: d.direcao, valor: k[chave].valor, meta: chave in metas ? metas[chave] ?? null : d.meta };
      }),
    };
  });
}
