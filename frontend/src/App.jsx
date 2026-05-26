import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Monitor, FileKey, DollarSign, Menu, X, Plus, Search,
  Trash2, ChevronDown, AlertTriangle, CheckCircle, Clock, Server,
  Smartphone, Printer, Laptop, HardDrive, BarChart3, PieChart,
  TrendingUp, Package, Shield, RefreshCw, Building2, Users, ArrowLeft,
  MessageSquare, Wrench, Send, Eye, ClipboardCheck, CalendarDays,
  MapPin, UserCheck, ChevronRight, CircleDot, Edit3, XCircle, CheckCircle2,
  Camera, Image as ImageIcon, Upload, Download, FileText
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import api from './api';

/* ───────── helpers ───────── */
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const fmtDateTime = d => d ? new Date(d).toLocaleString('pt-BR') : '-';
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STATUS_COLOR = { Ativo: 'bg-emerald-500/20 text-emerald-400', 'Em Manutencao': 'bg-amber-500/20 text-amber-400', Inativo: 'bg-red-500/20 text-red-400', Desativado: 'bg-gray-500/20 text-gray-400' };
const LIC_COLOR = { Ativa: 'bg-emerald-500/20 text-emerald-400', Expirando: 'bg-amber-500/20 text-amber-400', Expirada: 'bg-red-500/20 text-red-400' };
const CAT_ICON = { Computador: Monitor, Notebook: Laptop, Celular: Smartphone, Servidor: Server, Impressora: Printer, Monitor: Monitor, Cameras: Camera, Camera: Camera };
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const HISTORY_ICON = { Cadastro: CheckCircle, 'Mudanca de Status': RefreshCw, Transferencia: Users, 'Mudanca de Local': MapPin, 'Mudanca de Condicao': Edit3, Comentario: MessageSquare, 'Manutencao Aberta': Wrench, 'Manutencao Concluida': CheckCircle2, Atualização: Edit3, Atualizacao: Edit3 };
const HISTORY_COLOR = { Cadastro: 'text-emerald-400', 'Mudanca de Status': 'text-blue-400', Transferencia: 'text-violet-400', 'Mudanca de Local': 'text-cyan-400', 'Mudanca de Condicao': 'text-amber-400', Comentario: 'text-slate-400', 'Manutencao Aberta': 'text-red-400', 'Manutencao Concluida': 'text-emerald-400', Atualização: 'text-sky-400', Atualizacao: 'text-sky-400' };
const INV_STATUS_COLOR = { Pendente: 'bg-slate-500/20 text-slate-400', Encontrado: 'bg-emerald-500/20 text-emerald-400', 'Nao Encontrado': 'bg-red-500/20 text-red-400', Danificado: 'bg-amber-500/20 text-amber-400', Divergente: 'bg-violet-500/20 text-violet-400' };

/* ───────── Shared Components ───────── */
function KpiCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const ring = { blue: 'ring-blue-500/30', emerald: 'ring-emerald-500/30', amber: 'ring-amber-500/30', violet: 'ring-violet-500/30', rose: 'ring-rose-500/30', cyan: 'ring-cyan-500/30' }[color] || 'ring-blue-500/30';
  const iconBg = { blue: 'bg-blue-500/20 text-blue-400', emerald: 'bg-emerald-500/20 text-emerald-400', amber: 'bg-amber-500/20 text-amber-400', violet: 'bg-violet-500/20 text-violet-400', rose: 'bg-rose-500/20 text-rose-400', cyan: 'bg-cyan-500/20 text-cyan-400' }[color] || 'bg-blue-500/20 text-blue-400';
  return (
    <div className={`bg-slate-800/50 rounded-xl p-5 ring-1 ${ring} hover:bg-slate-800/80 transition`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-lg ${iconBg}`}><Icon size={20} /></div>
        <span className="text-slate-400 text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-slate-800 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} mx-4 max-h-[90vh] overflow-y-auto ring-1 ring-slate-700`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block mb-3">
      <span className="text-sm text-slate-400 mb-1 block">{label}</span>
      <input className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" {...props} />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label className="block mb-3">
      <span className="text-sm text-slate-400 mb-1 block">{label}</span>
      <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" {...props}>
        <option value="">Todos</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, ...props }) {
  return (
    <label className="block mb-3">
      <span className="text-sm text-slate-400 mb-1 block">{label}</span>
      <textarea className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} {...props} />
    </label>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="text-blue-400 animate-spin" /></div>;
}

function ErrorMsg({ msg }) {
  return <div className="flex items-center justify-center py-20 text-red-400 gap-2"><AlertTriangle size={20} /><span>{msg}</span></div>;
}

function ImageUpload({ value, onChange, label = 'Foto' }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const resp = await api.uploadImage(file);
      onChange(resp.url);
    } catch (err) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="mb-4">
      <span className="text-sm text-slate-400 mb-2 block">{label}</span>
      <div className="flex items-center gap-4">
        <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition cursor-pointer overflow-hidden group">
          {value ? (
            <img src={value} alt="Upload" className="w-full h-full object-cover" />
          ) : (
            <>
              {uploading ? <RefreshCw className="text-blue-400 animate-spin" size={24} /> : <Camera className="text-slate-500 group-hover:text-blue-400" size={24} />}
              <span className="text-xs text-slate-500 mt-2">{uploading ? 'Enviando...' : 'Clique para subir foto'}</span>
            </>
          )}
          <input type="file" className="hidden" accept="image/*" onChange={handleFile} disabled={uploading} />
        </label>
        {value && <button onClick={() => onChange('')} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition"><Trash2 size={16} /></button>}
      </div>
    </div>
  );
}

/* ═══════════ DASHBOARD ═══════════ */
function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.dashboard().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  if (!data) return <ErrorMsg msg="Erro ao carregar dashboard" />;
  const { kpis, charts } = data;
  const budgetPct = kpis.budget_planned > 0 ? ((kpis.budget_actual / kpis.budget_planned) * 100).toFixed(1) : 0;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Dashboard</h1><p className="text-slate-400 text-sm mt-1">Visao geral do ambiente de TI</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Package} label="Total de Ativos" value={kpis.total_assets} sub={`${kpis.active} ativos`} color="blue" />
        <KpiCard icon={DollarSign} label="Valor Total" value={fmt(kpis.value)} color="emerald" />
        <KpiCard icon={FileKey} label="Licencas" value={kpis.licenses} sub={kpis.expiring > 0 ? `${kpis.expiring} expirando` : 'Todas em dia'} color={kpis.expiring > 0 ? 'amber' : 'violet'} />
        <KpiCard icon={BarChart3} label="Orcamento" value={`${budgetPct}%`} sub={`${fmt(kpis.budget_actual)} de ${fmt(kpis.budget_planned)}`} color="cyan" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><PieChart size={18} className="text-blue-400" /> Ativos por Categoria</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RePieChart><Pie data={charts.by_category} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, count }) => `${category}: ${count}`}>{charts.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} /></RePieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-emerald-400" /> Ativos por Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.by_status}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} /><Bar dataKey="count" name="Quantidade" fill="#3b82f6" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-amber-400" /> Valor por Categoria</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.by_category}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} formatter={v => fmt(v)} /><Bar dataKey="total_cost" name="Valor Total" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ ASSET DETAIL (HISTORICO) ═══════════ */
function AssetDetail({ assetId, onBack }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState('');
  const [tab, setTab] = useState('timeline');
  const [showMaint, setShowMaint] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [maintForm, setMaintForm] = useState({ type: 'Corretiva', description: '', vendor: '', cost: '', performed_by: '' });
  const [statusForm, setStatusForm] = useState({ status: '', performed_by: '', status_notes: '' });

  const load = () => { setLoading(true); api.getAsset(assetId).then(setAsset).finally(() => setLoading(false)); };
  useEffect(load, [assetId]);

  const handleComment = async () => {
    if (!comment.trim()) return;
    await api.addComment(assetId, { text: comment, author: author || 'Anonimo' });
    setComment(''); load();
  };

  const handleMaint = async () => {
    await api.createMaintenance(assetId, { ...maintForm, cost: Number(maintForm.cost) || 0 });
    setShowMaint(false); setMaintForm({ type: 'Corretiva', description: '', vendor: '', cost: '', performed_by: '' }); load();
  };

  const handleCloseMaint = async (mid) => {
    await api.updateMaintenance(mid, { status: 'Concluida', end_date: new Date().toISOString().slice(0, 10), performed_by: 'Sistema' });
    load();
  };

  const handleStatus = async () => {
    if (!statusForm.status) return;
    await api.updateAsset(assetId, statusForm);
    setShowStatus(false); setStatusForm({ status: '', performed_by: '', status_notes: '' }); load();
  };

  if (loading) return <Loading />;
  if (!asset) return <ErrorMsg msg="Ativo nao encontrado" />;

  const Icon = CAT_ICON[asset.category] || HardDrive;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/20"><Icon size={22} className="text-blue-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-white">{asset.name}</h1>
              <p className="text-slate-400 text-sm">{asset.brand} {asset.model} &middot; {asset.asset_tag || asset.serial_number}</p>
            </div>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLOR[asset.status] || 'bg-slate-600 text-slate-300'}`}>{asset.status}</span>
      </div>

      {/* Hero Image */}
      {asset.image_url && (
        <div className="w-full h-64 rounded-2xl overflow-hidden ring-1 ring-slate-700/50 mb-6">
          <img src={asset.image_url} alt={asset.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Categoria</p><p className="text-white font-medium text-sm">{asset.category}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Responsavel</p><p className="text-white font-medium text-sm">{asset.assigned_to || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Departamento</p><p className="text-white font-medium text-sm">{asset.dept || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Localizacao</p><p className="text-white font-medium text-sm">{asset.location || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Valor Original</p><p className="text-white font-medium text-sm">{fmt(asset.cost)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Valor Atual</p><p className="text-emerald-400 font-medium text-sm">{fmt(asset.dep?.current_value)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Compra</p><p className="text-white font-medium text-sm">{fmtDate(asset.purchase_date)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Garantia</p><p className="text-white font-medium text-sm">{fmtDate(asset.warranty_end)}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowStatus(true)} className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-4 py-2 rounded-lg text-sm font-medium transition">
          <RefreshCw size={16} /> Alterar Status
        </button>
        <button onClick={() => setShowMaint(true)} className="flex items-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 px-4 py-2 rounded-lg text-sm font-medium transition">
          <Wrench size={16} /> Abrir Manutencao
        </button>
        {!asset.image_url && (
          <div className="flex-1 min-w-[200px]">
            <ImageUpload label="Adicionar Foto" value={asset.image_url} onChange={async (val) => {
              await api.updateAsset(assetId, { image_url: val });
              load();
            }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
        {[['timeline', 'Timeline'], ['maintenance', 'Manutencoes']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
        ))}
      </div>

      {tab === 'timeline' && (
        <div className="space-y-4">
          {/* Comment Box */}
          <div className="bg-slate-800/50 rounded-xl p-4 ring-1 ring-slate-700/50">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><MessageSquare size={16} /> Adicionar Comentario</h3>
            <div className="flex gap-3 mb-3">
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Seu nome" className="w-40 bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Escreva um comentario sobre este ativo..." className="flex-1 bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleComment()} />
              <button onClick={handleComment} disabled={!comment.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm transition"><Send size={16} /></button>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-700" />
            <div className="space-y-4">
              {(asset.history || []).map(h => {
                const HIcon = HISTORY_ICON[h.action] || CircleDot;
                const hColor = HISTORY_COLOR[h.action] || 'text-slate-400';
                return (
                  <div key={h.id} className="relative flex gap-4 pl-2">
                    <div className={`relative z-10 p-2 rounded-full bg-slate-800 ring-2 ring-slate-700 ${hColor}`}><HIcon size={14} /></div>
                    <div className="flex-1 bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="text-white font-medium text-sm">{h.action}</span>
                          {h.from_value && h.to_value && (
                            <span className="text-slate-400 text-sm ml-2">
                              <span className="text-red-400/70">{h.from_value}</span>
                              <ChevronRight size={12} className="inline mx-1" />
                              <span className="text-emerald-400/70">{h.to_value}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(h.created_at)}</span>
                      </div>
                      {h.notes && <p className="text-slate-300 text-sm mt-1">{h.notes}</p>}
                      {h.performed_by && <p className="text-xs text-slate-500 mt-1">por {h.performed_by}</p>}
                    </div>
                  </div>
                );
              })}
              {(!asset.history || asset.history.length === 0) && (
                <p className="text-slate-500 text-sm text-center py-8">Nenhum registro no historico</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-3">
          {(asset.maintenance || []).map(m => (
            <div key={m.id} className="bg-slate-800/50 rounded-xl p-4 ring-1 ring-slate-700/50">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Wrench size={16} className={m.status === 'Concluida' ? 'text-emerald-400' : 'text-amber-400'} />
                    <span className="text-white font-semibold text-sm">{m.type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === 'Concluida' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{m.status}</span>
                  </div>
                  <p className="text-slate-300 text-sm mt-1">{m.description}</p>
                </div>
                {m.status !== 'Concluida' && (
                  <button onClick={() => handleCloseMaint(m.id)} className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-medium transition">Concluir</button>
                )}
              </div>
              <div className="flex gap-4 text-xs text-slate-500 mt-2">
                <span>Fornecedor: {m.vendor || '-'}</span>
                <span>Custo: {fmt(m.cost)}</span>
                <span>Inicio: {fmtDate(m.start_date)}</span>
                {m.end_date && <span>Fim: {fmtDate(m.end_date)}</span>}
              </div>
              {m.notes && <p className="text-slate-400 text-xs mt-2 italic">{m.notes}</p>}
            </div>
          ))}
          {(!asset.maintenance || asset.maintenance.length === 0) && (
            <p className="text-slate-500 text-sm text-center py-8">Nenhuma manutencao registrada</p>
          )}
        </div>
      )}

      {/* Modal Alterar Status */}
      <Modal open={showStatus} onClose={() => setShowStatus(false)} title="Alterar Status">
        <Select label="Novo Status *" options={['Ativo', 'Em Manutencao', 'Inativo', 'Desativado']} value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })} />
        <Input label="Responsavel pela alteracao" value={statusForm.performed_by} onChange={e => setStatusForm({ ...statusForm, performed_by: e.target.value })} />
        <TextArea label="Motivo / Observacao" value={statusForm.status_notes} onChange={e => setStatusForm({ ...statusForm, status_notes: e.target.value })} placeholder="Descreva o motivo da alteracao..." />
        <div className="flex justify-end gap-3 mt-2">
          <button onClick={() => setShowStatus(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleStatus} disabled={!statusForm.status} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Confirmar</button>
        </div>
      </Modal>

      {/* Modal Manutencao */}
      <Modal open={showMaint} onClose={() => setShowMaint(false)} title="Abrir Manutencao">
        <Select label="Tipo" options={['Corretiva', 'Preventiva', 'Evolutiva']} value={maintForm.type} onChange={e => setMaintForm({ ...maintForm, type: e.target.value })} />
        <TextArea label="Descricao *" value={maintForm.description} onChange={e => setMaintForm({ ...maintForm, description: e.target.value })} placeholder="Descreva o problema ou servico..." />
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Fornecedor / Prestador" value={maintForm.vendor} onChange={e => setMaintForm({ ...maintForm, vendor: e.target.value })} />
          <Input label="Custo Estimado (R$)" type="number" value={maintForm.cost} onChange={e => setMaintForm({ ...maintForm, cost: e.target.value })} />
          <Input label="Responsavel" value={maintForm.performed_by} onChange={e => setMaintForm({ ...maintForm, performed_by: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button onClick={() => setShowMaint(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleMaint} disabled={!maintForm.description} className="px-4 py-2 rounded-lg text-sm bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-medium transition">Abrir Manutencao</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ ASSETS ═══════════ */
function Assets({ user }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [stFilter, setStFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [depts, setDepts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importRes, setImportRes] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'Computador', brand: '', model: '', serial_number: '', asset_tag: '', cost: '', status: 'Ativo', assigned_to: '', department_id: '', location: '', purchase_date: '', warranty_end: '', image_url: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: 'Computador', brand: '', model: '', serial_number: '', asset_tag: '', cost: '', status: 'Ativo', assigned_to: '', department_id: '', location: '', purchase_date: '', warranty_end: '', image_url: '', residual_value: '', useful_life_months: 60, vendor_id: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.listAssets({ search, category: catFilter, status: stFilter }).then(setAssets).finally(() => setLoading(false));
  }, [search, catFilter, stFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { 
    api.departments().then(setDepts); 
    api.vendors().then(setVendors).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      await api.createAsset({ ...form, cost: Number(form.cost) || 0 });
      setShowModal(false); setForm({ name: '', category: 'Computador', brand: '', model: '', serial_number: '', asset_tag: '', cost: '', status: 'Ativo', assigned_to: '', department_id: '', location: '', purchase_date: '', warranty_end: '', image_url: '' }); load();
    } catch (err) {
      alert('Erro ao salvar ativo: ' + err.message);
    }
  };

  const handleOpenEdit = (asset) => {
    setEditForm({
      id: asset.id,
      name: asset.name || '',
      category: asset.category || 'Computador',
      brand: asset.brand || '',
      model: asset.model || '',
      serial_number: asset.serial_number || '',
      asset_tag: asset.asset_tag || '',
      cost: asset.cost || 0,
      status: asset.status || 'Ativo',
      assigned_to: asset.assigned_to || '',
      department_id: asset.department_id || '',
      location: asset.location || '',
      purchase_date: asset.purchase_date || '',
      warranty_end: asset.warranty_end || '',
      useful_life_months: asset.useful_life_months || 60,
      residual_value: asset.residual_value || 0,
      image_url: asset.image_url || '',
      vendor_id: asset.vendor_id || ''
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    try {
      await api.updateAsset(editForm.id, {
        ...editForm,
        cost: Number(editForm.cost) || 0,
        useful_life_months: Number(editForm.useful_life_months) || 60,
        residual_value: Number(editForm.residual_value) || 0,
        performed_by: user ? user.username : 'Sistema'
      });
      setShowEditModal(false);
      load();
    } catch (err) {
      alert('Erro ao atualizar ativo: ' + err.message);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Deseja realmente remover este ativo?')) return;
    try {
      await api.deleteAsset(id);
      load();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  if (selectedAsset) return <AssetDetail assetId={selectedAsset} onBack={() => { setSelectedAsset(null); load(); }} />;

  const categories = ['Computador', 'Notebook', 'Celular', 'Monitor', 'Impressora', 'Servidor', 'Cameras', 'Acessorio', 'Rede'];
  const statuses = ['Ativo', 'Em Manutencao', 'Inativo', 'Desativado'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Ativos de TI</h1><p className="text-slate-400 text-sm mt-1">{assets.length} ativos encontrados</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"><Upload size={16} /> Importar CSV</button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"><Plus size={16} /> Novo Ativo</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, serial, marca..." className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
          <option value="">Categoria</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={stFilter} onChange={e => setStFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
          <option value="">Status</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : (
        <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Ativo</th><th className="px-4 py-3 font-medium">Categoria</th><th className="px-4 py-3 font-medium">Marca/Modelo</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Responsavel</th><th className="px-4 py-3 font-medium">Depto</th><th className="px-4 py-3 font-medium text-right">Valor</th><th className="px-4 py-3 font-medium text-right">Valor Atual</th><th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => {
                  const AIcon = CAT_ICON[a.category] || HardDrive;
                  return (
                    <tr key={a.id} onClick={() => setSelectedAsset(a.id)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="p-2 rounded-lg bg-slate-700/50 w-10 h-10 flex items-center justify-center overflow-hidden">
                              {a.image_url ? <img src={a.image_url} className="w-full h-full object-cover" /> : <AIcon size={16} className="text-blue-400" />}
                            </div>
                          </div>
                          <div><p className="text-white font-medium">{a.name}</p><p className="text-slate-500 text-xs">{a.asset_tag || a.serial_number || ''}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{a.category}</td>
                      <td className="px-4 py-3 text-slate-300">{[a.brand, a.model].filter(Boolean).join(' ') || '-'}</td>
                      <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] || 'bg-slate-600 text-slate-300'}`}>{a.status}</span></td>
                      <td className="px-4 py-3 text-slate-300">{a.assigned_to || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">{a.dept || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{fmt(a.cost)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">{fmt(a.dep?.current_value)}</td>
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedAsset(a.id); }} title="Visualizar" className="text-slate-500 hover:text-blue-400 transition"><Eye size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(a); }} title="Editar" className="text-slate-500 hover:text-amber-400 transition"><Edit3 size={16} /></button>
                        <button onClick={(e) => handleDelete(e, a.id)} title="Excluir" className="text-slate-500 hover:text-red-400 transition"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {assets.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Nenhum ativo encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Ativo">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nome *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dell Optiplex 7090" />
          <Select label="Categoria *" options={categories} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <Input label="Marca" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Dell" />
          <Input label="Modelo" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Optiplex 7090" />
          <Input label="Numero de Serie" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
          <Input label="Patrimonio" value={form.asset_tag} onChange={e => setForm({ ...form, asset_tag: e.target.value })} placeholder="PAT-009" />
          <Input label="Custo (R$)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
          <Select label="Status" options={statuses} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} />
          <Input label="Responsavel" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} />
          <label className="block mb-3"><span className="text-sm text-slate-400 mb-1 block">Departamento</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Selecione</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <Input label="Localizacao" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Sala TI" />
          <Input label="Data Compra" type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
          <div className="col-span-2">
            <ImageUpload label="Foto do Equipamento" value={form.image_url} onChange={val => setForm({ ...form, image_url: val })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!form.name || !form.category} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Criar Ativo</button>
        </div>
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Ativo">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nome *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Dell Optiplex 7090" />
          <Select label="Categoria *" options={categories} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
          <Input label="Marca" value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} placeholder="Dell" />
          <Input label="Modelo" value={editForm.model} onChange={e => setEditForm({ ...editForm, model: e.target.value })} placeholder="Optiplex 7090" />
          <Input label="Numero de Serie" value={editForm.serial_number} onChange={e => setEditForm({ ...editForm, serial_number: e.target.value })} />
          <Input label="Patrimonio" value={editForm.asset_tag} onChange={e => setEditForm({ ...editForm, asset_tag: e.target.value })} placeholder="PAT-009" />
          <Input label="Custo (R$)" type="number" value={editForm.cost} onChange={e => setEditForm({ ...editForm, cost: e.target.value })} />
          <Select label="Status" options={statuses} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} />
          <label className="block mb-3"><span className="text-sm text-slate-400 mb-1 block">Condicao</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={editForm.condition} onChange={e => setEditForm({ ...editForm, condition: e.target.value })}>
              {['Novo', 'Bom', 'Regular', 'Ruim', 'Defeituoso'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <Input label="Responsavel" value={editForm.assigned_to} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })} />
          <label className="block mb-3"><span className="text-sm text-slate-400 mb-1 block">Departamento</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={editForm.department_id} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}>
              <option value="">Nenhum</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block mb-3"><span className="text-sm text-slate-400 mb-1 block">Fornecedor</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={editForm.vendor_id} onChange={e => setEditForm({ ...editForm, vendor_id: e.target.value })}>
              <option value="">Nenhum</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <Input label="Localizacao" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} placeholder="Sala TI" />
          <Input label="Data Compra" type="date" value={editForm.purchase_date} onChange={e => setEditForm({ ...editForm, purchase_date: e.target.value })} />
          <Input label="Fim Garantia" type="date" value={editForm.warranty_end} onChange={e => setEditForm({ ...editForm, warranty_end: e.target.value })} />
          <Input label="Vida Util (meses)" type="number" value={editForm.useful_life_months} onChange={e => setEditForm({ ...editForm, useful_life_months: e.target.value })} />
          <Input label="Valor Residual (R$)" type="number" value={editForm.residual_value} onChange={e => setEditForm({ ...editForm, residual_value: e.target.value })} />
          <div className="col-span-2">
            <TextArea label="Observacoes / Notas" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notas explicativas sobre o ativo..." />
          </div>
          <div className="col-span-2">
            <ImageUpload label="Foto do Equipamento" value={editForm.image_url} onChange={val => setEditForm({ ...editForm, image_url: val })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleEditSave} disabled={!editForm.name || !editForm.category} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Salvar Alteracoes</button>
        </div>
      </Modal>

      <Modal open={showImport} onClose={() => { setShowImport(false); setImportRes(null); }} title="Importar Ativos via CSV">
        <div className="space-y-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <h4 className="text-blue-400 font-medium text-sm mb-2 flex items-center gap-2"><FileText size={16} /> Instrucoes do CSV</h4>
            <p className="text-slate-400 text-xs leading-relaxed">O arquivo deve conter os cabecalhos: <code className="text-blue-300">nome, categoria, n_serie, patrimonio, marca, modelo, status, condicao, responsavel, localizacao, custo, notas</code></p>
            <a href="/api/assets/template" download className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs font-medium mt-3 transition"><Download size={14} /> Baixar Modelo Exemplo</a>
          </div>

          {!importRes ? (
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-blue-500/50 transition cursor-pointer relative">
              <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                  const res = await api.importAssets(file);
                  setImportRes(res);
                  load();
                } catch (err) { alert(err.message); }
              }} />
              <Upload className="mx-auto text-slate-500 mb-3" size={32} />
              <p className="text-white text-sm font-medium">Clique para selecionar ou arraste o CSV</p>
              <p className="text-slate-500 text-xs mt-1">Apenas arquivos .csv permitidos</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 className="text-emerald-500" size={20} />
                <p className="text-emerald-400 text-sm font-medium">{importRes.count} ativos importados com sucesso!</p>
              </div>
              {importRes.errors && importRes.errors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg max-h-40 overflow-y-auto">
                  <p className="text-red-400 text-xs font-bold mb-1">Erros encontrados:</p>
                  {importRes.errors.map((err, i) => <p key={i} className="text-red-400/80 text-[10px]">{err}</p>)}
                </div>
              )}
              <button onClick={() => { setShowImport(false); setImportRes(null); }} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition">Fechar</button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ LICENSES ═══════════ */
function Licenses() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', vendor_name: '', license_type: 'Assinatura', category: '', total_seats: 1, used_seats: 0, cost_per_seat: 0, total_cost: 0, billing_cycle: 'Mensal', start_date: '', end_date: '', status: 'Ativa' });

  const load = () => { setLoading(true); api.listLicenses().then(setLicenses).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleCreate = async () => {
    await api.createLicense({ ...form, total_seats: Number(form.total_seats), used_seats: Number(form.used_seats), cost_per_seat: Number(form.cost_per_seat), total_cost: Number(form.total_cost) });
    setShowModal(false); load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente remover esta licenca?')) return;
    try {
      await api.deleteLicense(id);
      load();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const totalCost = licenses.reduce((s, l) => s + (l.total_cost || 0), 0);
  const totalSeats = licenses.reduce((s, l) => s + (l.total_seats || 0), 0);
  const usedSeats = licenses.reduce((s, l) => s + (l.used_seats || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Licencas de Software</h1><p className="text-slate-400 text-sm mt-1">{licenses.length} licencas cadastradas</p></div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"><Plus size={16} /> Nova Licenca</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Shield} label="Custo Mensal Total" value={fmt(totalCost)} color="violet" />
        <KpiCard icon={Users} label="Licencas em Uso" value={`${usedSeats} / ${totalSeats}`} sub={`${totalSeats > 0 ? ((usedSeats / totalSeats) * 100).toFixed(0) : 0}% utilizado`} color="blue" />
        <KpiCard icon={AlertTriangle} label="Expirando" value={licenses.filter(l => l.status === 'Expirando').length} color="amber" />
      </div>
      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {licenses.map(l => (
            <div key={l.id} className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 hover:bg-slate-800/80 transition">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="text-white font-semibold">{l.name}</h3><p className="text-slate-500 text-xs mt-0.5">{l.vendor_name || 'Sem fornecedor'} &middot; {l.license_type}</p></div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${LIC_COLOR[l.status] || 'bg-slate-600 text-slate-300'}`}>{l.status}</span>
                  <button onClick={() => handleDelete(l.id)} className="text-slate-500 hover:text-red-400 transition"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{l.used_seats} de {l.total_seats} licencas</span><span>{l.util}%</span></div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${l.util > 90 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(l.util, 100)}%` }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/40 rounded-lg p-2"><span className="text-slate-500">Custo/Licenca</span><p className="text-white font-medium">{fmt(l.cost_per_seat)}</p></div>
                <div className="bg-slate-900/40 rounded-lg p-2"><span className="text-slate-500">Total</span><p className="text-white font-medium">{fmt(l.total_cost)}/{l.billing_cycle?.toLowerCase()}</p></div>
              </div>
              {l.end_date && <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500"><Clock size={12} /><span>Expira em {new Date(l.end_date).toLocaleDateString('pt-BR')}</span></div>}
            </div>
          ))}
          {licenses.length === 0 && <div className="col-span-full text-center py-12 text-slate-500">Nenhuma licenca cadastrada</div>}
        </div>
      )}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Licenca">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nome *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Microsoft 365" />
          <Input label="Fornecedor" value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} />
          <Select label="Tipo" options={['Assinatura', 'OEM', 'SaaS', 'Perpetua']} value={form.license_type} onChange={e => setForm({ ...form, license_type: e.target.value })} />
          <Select label="Categoria" options={['Produtividade', 'Seguranca', 'Design', 'Comunicacao', 'Gestao', 'SO']} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <Input label="Total de Licencas" type="number" value={form.total_seats} onChange={e => setForm({ ...form, total_seats: e.target.value })} />
          <Input label="Em Uso" type="number" value={form.used_seats} onChange={e => setForm({ ...form, used_seats: e.target.value })} />
          <Input label="Custo/Licenca" type="number" value={form.cost_per_seat} onChange={e => setForm({ ...form, cost_per_seat: e.target.value })} />
          <Input label="Custo Total" type="number" value={form.total_cost} onChange={e => setForm({ ...form, total_cost: e.target.value })} />
          <Select label="Ciclo" options={['Mensal', 'Anual', 'Unica']} value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value })} />
          <Select label="Status" options={['Ativa', 'Expirando', 'Expirada']} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} />
          <Input label="Inicio" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          <Input label="Fim" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!form.name} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Criar Licenca</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ BUDGET ═══════════ */
function Budget() {
  const [data, setData] = useState({ items: [], totals: { planned: 0, actual: 0 } });
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ month: 1, category: 'Hardware', planned: '', actual: '' });

  const load = () => { setLoading(true); api.listBudget(year).then(setData).finally(() => setLoading(false)); };
  useEffect(load, [year]);

  const handleCreate = async () => {
    await api.createBudget({ ...form, year, planned: Number(form.planned) || 0, actual: Number(form.actual) || 0 });
    setShowModal(false); load();
  };

  const monthlyData = MONTHS.map((name, i) => {
    const month = i + 1;
    const items = data.items.filter(it => it.month === month);
    return { name, planejado: items.reduce((s, it) => s + (it.planned || 0), 0), realizado: items.reduce((s, it) => s + (it.actual || 0), 0) };
  }).filter(m => m.planejado > 0 || m.realizado > 0);

  const catData = {};
  data.items.forEach(it => { if (!catData[it.category]) catData[it.category] = { category: it.category, planejado: 0, realizado: 0 }; catData[it.category].planejado += it.planned || 0; catData[it.category].realizado += it.actual || 0; });
  const catArr = Object.values(catData);
  const variance = data.totals.planned - data.totals.actual;
  const varPct = data.totals.planned > 0 ? ((data.totals.actual / data.totals.planned) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Orcamento de TI</h1><p className="text-slate-400 text-sm mt-1">Planejamento e acompanhamento financeiro</p></div>
        <div className="flex gap-3">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"><Plus size={16} /> Nova Entrada</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} label="Planejado" value={fmt(data.totals.planned)} color="blue" />
        <KpiCard icon={TrendingUp} label="Realizado" value={fmt(data.totals.actual)} sub={`${varPct}% do planejado`} color="emerald" />
        <KpiCard icon={BarChart3} label="Saldo" value={fmt(variance)} sub={variance >= 0 ? 'Dentro do orcamento' : 'Acima do orcamento'} color={variance >= 0 ? 'cyan' : 'rose'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4">Planejado vs Realizado (Mensal)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} formatter={v => fmt(v)} /><Legend /><Bar dataKey="planejado" name="Planejado" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="realizado" name="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4">Orcamento por Categoria</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={catArr} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><YAxis type="category" dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} formatter={v => fmt(v)} /><Legend /><Bar dataKey="planejado" name="Planejado" fill="#3b82f6" radius={[0, 4, 4, 0]} /><Bar dataKey="realizado" name="Realizado" fill="#10b981" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {!loading && data.items.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-left"><th className="px-4 py-3 font-medium">Mes</th><th className="px-4 py-3 font-medium">Categoria</th><th className="px-4 py-3 font-medium text-right">Planejado</th><th className="px-4 py-3 font-medium text-right">Realizado</th><th className="px-4 py-3 font-medium text-right">Variacao</th></tr></thead><tbody>{data.items.map(it => { const v = it.planned - it.actual; return (<tr key={it.id} className="border-b border-slate-700/50 hover:bg-slate-700/30"><td className="px-4 py-3 text-white">{MONTHS[it.month - 1]}</td><td className="px-4 py-3 text-slate-300">{it.category}</td><td className="px-4 py-3 text-right text-slate-300">{fmt(it.planned)}</td><td className="px-4 py-3 text-right text-slate-300">{fmt(it.actual)}</td><td className={`px-4 py-3 text-right font-medium ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(v)}</td></tr>); })}</tbody></table></div></div>
      )}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Entrada de Orcamento">
        <div className="grid grid-cols-2 gap-x-3">
          <label className="block mb-3"><span className="text-sm text-slate-400 mb-1 block">Mes *</span><select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></label>
          <Select label="Categoria *" options={['Hardware', 'Licencas', 'Infraestrutura', 'Servicos', 'Treinamento']} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <Input label="Planejado (R$)" type="number" value={form.planned} onChange={e => setForm({ ...form, planned: e.target.value })} />
          <Input label="Realizado (R$)" type="number" value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!form.category} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Criar</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ INVENTORY DETAIL ═══════════ */
function InventoryDetail({ inventoryId, onBack }) {
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [checkModal, setCheckModal] = useState(null);
  const [checkForm, setCheckForm] = useState({ status: 'Encontrado', checked_by: '', location_found: '', condition_found: '', notes: '', image_url: '' });

  const load = () => { setLoading(true); api.getInventory(inventoryId).then(setInv).finally(() => setLoading(false)); };
  useEffect(load, [inventoryId]);

  const handleCheck = async () => {
    await api.checkInventoryItem(inventoryId, checkModal.id, checkForm);
    setCheckModal(null); setCheckForm({ status: 'Encontrado', checked_by: '', location_found: '', condition_found: '', notes: '', image_url: '' }); load();
  };

  const handleClose = async () => {
    if (!confirm('Fechar este inventario? Itens pendentes serao marcados como Nao Encontrado.')) return;
    await api.closeInventory(inventoryId, {}); load();
  };

  if (loading) return <Loading />;
  if (!inv) return <ErrorMsg msg="Inventario nao encontrado" />;

  const items = (inv.items || []).filter(i => !filter || i.status === filter);
  const pct = inv.total_items > 0 ? ((inv.checked / inv.total_items) * 100).toFixed(0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{inv.name}</h1>
          <p className="text-slate-400 text-sm">{MONTHS[inv.month - 1]}/{inv.year} &middot; Responsavel: {inv.responsible || 'N/A'}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${inv.status === 'Fechado' ? 'bg-slate-500/20 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{inv.status}</span>
      </div>

      {/* Progress */}
      <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Progresso da Verificacao</h3>
          <span className="text-2xl font-bold text-white">{pct}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(inv.stats || {}).map(([st, cnt]) => (
            <div key={st} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${INV_STATUS_COLOR[st] || 'bg-slate-600 text-slate-300'}`}>
              {st}: {cnt}
            </div>
          ))}
          <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400">Total: {inv.total_items}</div>
        </div>
      </div>

      {/* Actions */}
      {inv.status === 'Aberto' && (
        <div className="flex gap-2">
          <button onClick={handleClose} className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition">
            <XCircle size={16} /> Fechar Inventario
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filter ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>Todos</button>
        {['Pendente', 'Encontrado', 'Nao Encontrado', 'Danificado', 'Divergente'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === s ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>{s}</button>
        ))}
      </div>

      {/* Items Table */}
      <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Ativo</th>
                <th className="px-4 py-3 font-medium">Patrimonio</th>
                <th className="px-4 py-3 font-medium">Local Esperado</th>
                <th className="px-4 py-3 font-medium">Responsavel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Verificado por</th>
                <th className="px-4 py-3 font-medium">Obs</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const IIcon = CAT_ICON[item.category] || HardDrive;
                return (
                  <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center overflow-hidden">
                          {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <IIcon size={12} className="text-blue-400" />}
                        </div>
                        <div><p className="text-white font-medium text-sm">{item.asset_name}</p><p className="text-slate-500 text-xs">{item.category} &middot; {item.dept || '-'}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{item.asset_tag || item.serial_number || '-'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{item.expected_location || '-'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{item.assigned_to || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INV_STATUS_COLOR[item.status] || 'bg-slate-600 text-slate-300'}`}>{item.status}</span></td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{item.checked_by || '-'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[150px] truncate">{item.notes || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.status === 'Aberto' && (
                        <button onClick={() => { setCheckModal(item); setCheckForm({ status: 'Encontrado', checked_by: '', location_found: item.expected_location || '', condition_found: item.expected_condition || '', notes: '' }); }}
                          className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-medium transition">
                          <UserCheck size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Nenhum item encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Check Modal */}
      <Modal open={!!checkModal} onClose={() => setCheckModal(null)} title={`Verificar: ${checkModal?.asset_name || ''}`}>
        <div className="mb-4 p-3 bg-slate-900/40 rounded-lg text-xs text-slate-400">
          <p>Patrimonio: <span className="text-white">{checkModal?.asset_tag || checkModal?.serial_number || '-'}</span></p>
          <p>Local esperado: <span className="text-white">{checkModal?.expected_location || '-'}</span></p>
          <p>Condicao esperada: <span className="text-white">{checkModal?.expected_condition || '-'}</span></p>
        </div>
        <Select label="Resultado da Verificacao *" options={['Encontrado', 'Nao Encontrado', 'Danificado', 'Divergente']} value={checkForm.status} onChange={e => setCheckForm({ ...checkForm, status: e.target.value })} />
        <Input label="Verificado por" value={checkForm.checked_by} onChange={e => setCheckForm({ ...checkForm, checked_by: e.target.value })} placeholder="Seu nome" />
        <Input label="Local onde foi encontrado" value={checkForm.location_found} onChange={e => setCheckForm({ ...checkForm, location_found: e.target.value })} />
        <Select label="Condicao encontrada" options={['Novo', 'Bom', 'Regular', 'Ruim', 'Defeituoso']} value={checkForm.condition_found} onChange={e => setCheckForm({ ...checkForm, condition_found: e.target.value })} />
        <TextArea label="Observacoes" value={checkForm.notes} onChange={e => setCheckForm({ ...checkForm, notes: e.target.value })} placeholder="Alguma observacao sobre o ativo..." />
        <ImageUpload label="Foto da Verificacao" value={checkForm.image_url} onChange={val => setCheckForm({ ...checkForm, image_url: val })} />
        <div className="flex justify-end gap-3 mt-2">
          <button onClick={() => setCheckModal(null)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCheck} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium transition">Confirmar Verificacao</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ INVENTORIES (GESTAO) ═══════════ */
function Inventories() {
  const [invs, setInvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, responsible: '', notes: '' });

  const load = () => { setLoading(true); api.listInventories().then(setInvs).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleCreate = async () => {
    await api.createInventory(form);
    setShowModal(false); load();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Remover este inventario? Todos os dados vinculados serao perdidos.')) return;
    try {
      await api.deleteInventory(id);
      load();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  if (selected) return <InventoryDetail inventoryId={selected} onBack={() => { setSelected(null); load(); }} />;

  const open = invs.filter(i => i.status === 'Aberto').length;
  const closed = invs.filter(i => i.status === 'Fechado').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Gestao de Inventarios</h1><p className="text-slate-400 text-sm mt-1">Controle e verificacao periodica de ativos</p></div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"><Plus size={16} /> Novo Inventario</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={ClipboardCheck} label="Total de Inventarios" value={invs.length} color="blue" />
        <KpiCard icon={CalendarDays} label="Em Andamento" value={open} color="amber" />
        <KpiCard icon={CheckCircle} label="Finalizados" value={closed} color="emerald" />
      </div>

      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {invs.map(inv => {
            const pct = inv.total_items > 0 ? ((inv.checked / inv.total_items) * 100).toFixed(0) : 0;
            return (
              <div key={inv.id} onClick={() => setSelected(inv.id)} className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 hover:bg-slate-800/80 transition cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{inv.name}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">{MONTHS[inv.month - 1]}/{inv.year} &middot; {inv.responsible || 'Sem responsavel'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${inv.status === 'Fechado' ? 'bg-slate-500/20 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{inv.status}</span>
                    <button onClick={(e) => handleDelete(e, inv.id)} className="text-slate-500 hover:text-red-400 transition"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{inv.checked} de {inv.total_items} verificados</span><span>{pct}%</span></div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${Number(pct) === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} /></div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(inv.stats || {}).map(([st, cnt]) => (
                    <span key={st} className={`px-2 py-0.5 rounded text-xs ${INV_STATUS_COLOR[st] || 'bg-slate-600 text-slate-300'}`}>{st}: {cnt}</span>
                  ))}
                </div>

                {inv.closed_at && <p className="text-xs text-slate-500 mt-2">Fechado em {fmtDateTime(inv.closed_at)}</p>}
              </div>
            );
          })}
          {invs.length === 0 && <div className="col-span-full text-center py-12 text-slate-500">Nenhum inventario criado. Crie o primeiro!</div>}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Inventario">
        <p className="text-sm text-slate-400 mb-4">O inventario sera criado com todos os ativos ativos e em manutencao. Voce podera verificar cada um individualmente.</p>
        <div className="grid grid-cols-2 gap-x-3">
          <label className="block mb-3"><span className="text-sm text-slate-400 mb-1 block">Ano</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="block mb-3"><span className="text-sm text-slate-400 mb-1 block">Mes</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
        <Input label="Responsavel" value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} placeholder="Nome do responsavel" />
        <TextArea label="Observacoes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observacoes sobre este inventario..." />
        <div className="flex justify-end gap-3 mt-2">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium transition">Criar Inventario</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ INVENTORY SUMMARY (old) ═══════════ */
function InventorySummary() {
  const [data, setData] = useState(null);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api.inventorySummary(), api.departments()]).then(([inv, dep]) => { setData(inv); setDepts(dep); }).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  const cats = data?.by_category || [];
  const totalAssets = cats.reduce((s, c) => s + c.total, 0);
  const totalActive = cats.reduce((s, c) => s + c.active, 0);
  const totalCost = cats.reduce((s, c) => s + (c.total_cost || 0), 0);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Resumo de Ativos</h1><p className="text-slate-400 text-sm mt-1">Visao consolidada por categoria e departamento</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Package} label="Total de Ativos" value={totalAssets} color="blue" />
        <KpiCard icon={CheckCircle} label="Ativos Ativos" value={totalActive} sub={`${totalAssets > 0 ? ((totalActive / totalAssets) * 100).toFixed(0) : 0}% operacional`} color="emerald" />
        <KpiCard icon={DollarSign} label="Valor Total" value={fmt(totalCost)} color="violet" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4">Ativos por Categoria</h3>
          <div className="space-y-3">{cats.map((c, i) => { const pct = totalAssets > 0 ? (c.total / totalAssets * 100) : 0; return (<div key={c.category}><div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{c.category}</span><span className="text-slate-400">{c.total} ({pct.toFixed(0)}%)</span></div><div className="h-2.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} /></div><p className="text-xs text-slate-500 mt-0.5">{c.active} ativos &middot; {fmt(c.total_cost)}</p></div>); })}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Building2 size={18} className="text-blue-400" /> Departamentos</h3>
          <div className="space-y-2">{depts.map(d => (<div key={d.id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-3"><div><p className="text-white font-medium text-sm">{d.name}</p><p className="text-slate-500 text-xs">{d.manager || 'Sem gerente'} &middot; {d.cost_center}</p></div><div className="text-right"><p className="text-white font-semibold text-sm">{d.cnt}</p><p className="text-slate-500 text-xs">ativos</p></div></div>))}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ APP ═══════════ */
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'assets', label: 'Ativos', icon: Monitor },
  { key: 'licenses', label: 'Licencas', icon: FileKey },
  { key: 'budget', label: 'Orcamento', icon: DollarSign },
  { key: 'inventories', label: 'Inventarios', icon: ClipboardCheck },
  { key: 'summary', label: 'Resumo', icon: Package },
  { key: 'users', label: 'Usuários', icon: Users },
];

function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.login(user, pwd);
      localStorage.setItem('it_manager_token', res.token);
      onLogin(res);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
            <LayoutDashboard size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">IT Manager</h1>
          <p className="text-slate-400 text-sm">Entre com suas credenciais</p>
        </div>
        
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Usuario</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-500"><Users size={18} /></span>
              <input value={user} onChange={e => setUser(e.target.value)} required className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="Ex: admin" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Senha</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-500"><Shield size={18} /></span>
              <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="••••••••" />
            </div>
          </div>
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs flex items-center gap-2"><AlertTriangle size={14} /> {error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition">
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">ISO 27001 &middot; ITIL 4 CERTIFIED</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ USER MANAGEMENT (ADMIN) ═══════════ */
function UsersPage() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'admin' });

  const load = () => {
    setLoading(true);
    api.listUsers().then(setUsersList).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    try {
      await api.createUser(form);
      setShowModal(false);
      setForm({ username: '', password: '', role: 'admin' });
      load();
    } catch (err) {
      alert('Erro ao criar usuário: ' + err.message);
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Deseja realmente remover o usuário "${username}"?`)) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert('Erro ao remover usuário: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Controle de Usuários</h1>
          <p className="text-slate-400 text-sm mt-1">Gerenciamento de acessos de administradores e operadores</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      {loading ? <Loading /> : (
        <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Nome de Usuário</th>
                  <th className="px-4 py-3 font-medium">Nível de Acesso</th>
                  <th className="px-4 py-3 font-medium">Data de Cadastro</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase">
                          {u.username.slice(0, 2)}
                        </div>
                        <span className="text-white font-medium">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {u.role === 'admin' ? 'Administrador' : 'Operador'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{fmtDateTime(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(u.id, u.username)} className="text-slate-500 hover:text-red-400 transition">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {usersList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500">Nenhum usuário cadastrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Usuário">
        <Input label="Nome de Usuário *" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Ex: rafael.souza" />
        <Input label="Senha *" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
        <label className="block mb-3">
          <span className="text-sm text-slate-400 mb-1 block">Nível de Acesso *</span>
          <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Administrador</option>
            <option value="operator">Operador</option>
          </select>
        </label>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!form.username || !form.password} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Criar Usuário</button>
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('it_manager_token');
    if (token) {
      api.me().then(setUser).catch(() => localStorage.removeItem('it_manager_token')).finally(() => setAuthLoading(false));
    } else { setAuthLoading(false); }
  }, []);

  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div></div>;
  if (!user) return <Login onLogin={setUser} />;

  const handleLogout = () => { if (window.confirm("Deseja sair do sistema?")) { localStorage.removeItem('it_manager_token'); setUser(null); } };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'assets': return <Assets user={user} />;
      case 'licenses': return <Licenses />;
      case 'budget': return <Budget />;
      case 'inventories': return <Inventories />;
      case 'summary': return <InventorySummary />;
      case 'users': return user && user.role === 'admin' ? <UsersPage /> : <Dashboard />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-800/80 backdrop-blur-xl border-r border-slate-700/50 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg"><Server size={20} className="text-white" /></div>
            <div><h1 className="text-white font-bold text-lg">IT Manager</h1><p className="text-slate-500 text-xs">Gestao de TI v2.0</p></div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.filter(item => item.key !== 'users' || (user && user.role === 'admin')).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setPage(key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${page === key ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}>
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-3 px-1">
             <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase">{user.username.slice(0,2)}</div>
                <div className="text-[10px] text-white font-medium truncate max-w-[80px]">{user.username}</div>
             </div>
             <button onClick={handleLogout} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"><XCircle size={16} /></button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><Shield size={14} /><span>ITIL 4 &middot; ISO 27001 &middot; Desenvolvido por Brapira</span></div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 px-4 lg:px-6 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white"><Menu size={22} /></button>
          <div className="flex items-center gap-2 text-sm text-slate-400"><LayoutDashboard size={16} /><span>{NAV.find(n => n.key === page)?.label || 'Dashboard'}</span></div>
        </header>
        <div className="p-4 lg:p-6">{renderPage()}</div>
      </main>
    </div>
  );
}
