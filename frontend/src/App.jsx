import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Monitor, FileKey, DollarSign, Menu, X, Plus, Search,
  Trash2, ChevronDown, AlertTriangle, CheckCircle, Clock, Server,
  Smartphone, Printer, Laptop, HardDrive, BarChart3, PieChart,
  TrendingUp, Package, Shield, RefreshCw, Building2, Users, ArrowLeft,
  MessageSquare, Wrench, Send, Eye, ClipboardCheck, CalendarDays,
  MapPin, UserCheck, ChevronRight, CircleDot, Edit3, XCircle, CheckCircle2,
  Camera, Image as ImageIcon, Upload, Download, FileText, Briefcase, BookOpen, TabletSmartphone
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import api from './api';
import {
  lerRelatorioPulsus, calcularIndicadores, statusMeta, analisarChips, analisarModelos, analisarVersoes,
  METAS_PADRAO, ROTULO_STATUS, nomeModelo, diasSemSync, quantidadeChips
} from './lib/pulsus-indicadores';

/* ───────── helpers ───────── */
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const fmtDateTime = d => d ? new Date(d).toLocaleString('pt-BR') : '-';
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STATUS_COLOR = { Ativo: 'bg-emerald-500/20 text-emerald-400', 'Em Manutencao': 'bg-amber-500/20 text-amber-400', Inativo: 'bg-red-500/20 text-red-400', Desativado: 'bg-gray-500/20 text-gray-400' };
const LIC_COLOR = { Ativa: 'bg-emerald-500/20 text-emerald-400', Expirando: 'bg-amber-500/20 text-amber-400', Expirada: 'bg-red-500/20 text-red-400' };
const CAT_ICON = { Computador: Monitor, Notebook: Laptop, Celular: Smartphone, Servidor: Server, Impressora: Printer, Monitor: Monitor, Cameras: Camera, Camera: Camera };
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const HISTORY_ICON = { Cadastro: CheckCircle, 'Mudanca de Status': RefreshCw, Transferencia: Users, 'Mudanca de Local': MapPin, 'Mudanca de Condicao': Edit3, Comentario: MessageSquare, 'Manutencao Aberta': Wrench, 'Manutencao Concluida': CheckCircle2, Atualização: Edit3, Atualizacao: Edit3, Auditoria: ClipboardCheck, 'Pulsus Alterado': Smartphone };
const HISTORY_COLOR = { Cadastro: 'text-emerald-400', 'Mudanca de Status': 'text-blue-400', Transferencia: 'text-violet-400', 'Mudanca de Local': 'text-cyan-400', 'Mudanca de Condicao': 'text-amber-400', Comentario: 'text-slate-400', 'Manutencao Aberta': 'text-red-400', 'Manutencao Concluida': 'text-emerald-400', Atualização: 'text-sky-400', Atualizacao: 'text-sky-400', Auditoria: 'text-indigo-400', 'Pulsus Alterado': 'text-amber-400' };
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
            <RePieChart><Pie data={charts.by_category} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, count }) => `${category}: ${count}`}>{charts.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#e2e8f0' }} /></RePieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-emerald-400" /> Ativos por Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.by_status}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#e2e8f0' }} /><Bar dataKey="count" name="Quantidade" fill="#3b82f6" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-amber-400" /> Valor por Categoria</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.by_category}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#e2e8f0' }} formatter={v => fmt(v)} /><Bar dataKey="total_cost" name="Valor Total" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Building2 size={18} className="text-blue-400" /> Equipamentos por Departamento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.by_department || []}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="department" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#e2e8f0' }} /><Bar dataKey="count" name="Quantidade" fill="#6366f1" radius={[6, 6, 0, 0]} /></BarChart>
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
  const [showTermPrintModal, setShowTermPrintModal] = useState(false);
  const [maintForm, setMaintForm] = useState({ type: 'Corretiva', description: '', vendor: '', cost: '', performed_by: '', image_url: '' });
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
    setShowMaint(false); setMaintForm({ type: 'Corretiva', description: '', vendor: '', cost: '', performed_by: '', image_url: '' }); load();
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
        {asset.category === 'Celular' && (
          <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
            <p className="text-xs text-slate-500">Nº do Pulsus</p><p className="text-amber-400 font-semibold text-sm">{asset.pulsus_number || '-'}</p>
          </div>
        )}
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

      {/* Conformidade pós-desativação (Visualização de Detalhes) */}
      {(asset.status === 'Desativado' || asset.status === 'Inativo') && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <h3 className="text-amber-400 font-bold text-sm flex items-center gap-1.5"><Shield size={16} /> Conformidade Pós-Desativação (LGPD & Ambiental)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${asset.deactivation_wiped ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-slate-400">Sanitização de Dados (LGPD Data Wiping):</span>
              <strong className="text-white">{asset.deactivation_wiped ? 'Efetuada' : 'Pendente'}</strong>
            </div>
            <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${asset.deactivation_eco_recycle ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-slate-400">Descarte Ecológico Certificado:</span>
              <strong className="text-white">{asset.deactivation_eco_recycle ? 'Efetuado' : 'Pendente'}</strong>
            </div>
          </div>
          {asset.deactivation_notes && (
            <div className="bg-slate-900/30 p-3 border border-slate-800 rounded-lg text-xs">
              <p className="text-slate-500 font-semibold mb-1">Justificativa:</p>
              <p className="text-slate-300 italic">"{asset.deactivation_notes}"</p>
            </div>
          )}
          {asset.deactivation_document_url && (
            <div className="pt-1">
              <a href={asset.deactivation_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition">
                <FileText size={14} /> Baixar/Visualizar Laudo de Descarte
              </a>
            </div>
          )}
        </div>
      )}

      {/* Termo de Responsabilidade */}
      {asset.assigned_to && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-1.5"><FileText size={16} className="text-blue-400" /> Termo de Responsabilidade</h3>
            <button onClick={() => setShowTermPrintModal(true)} className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0">
              <Download size={14} /> Gerar Termo de Responsabilidade
            </button>
          </div>
          <div className="text-slate-400 text-xs leading-relaxed">
            {asset.responsibility_term_url ? (
              <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-lg border border-slate-800 gap-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle size={16} />
                  <span>Termo assinado anexado e verificado!</span>
                </div>
                <a href={asset.responsibility_term_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition" title="Visualizar Termo Anexo">
                  <Eye size={14} /> Visualizar Documento
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="italic text-slate-500">Nenhum termo assinado anexado até o momento. Por favor, emita o termo acima, colete a assinatura do portador e anexe abaixo:</p>
                <div className="max-w-xs">
                  <ImageUpload label="Anexar Termo Assinado (PDF ou Imagem)" value={asset.responsibility_term_url || ''} onChange={async (val) => {
                    await api.updateAsset(assetId, { responsibility_term_url: val });
                    load();
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
              {m.image_url && (
                <div className="mt-3 max-w-xs rounded-lg overflow-hidden border border-slate-700/50">
                  <a href={m.image_url} target="_blank" rel="noreferrer" title="Visualizar Foto Ampliada">
                    <img src={m.image_url} alt="Foto da Avaria" className="w-full h-auto object-cover max-h-40 hover:scale-105 transition duration-300" />
                  </a>
                </div>
              )}
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
        <div className="mb-3">
          <ImageUpload label="Foto da Avaria (Opcional)" value={maintForm.image_url} onChange={val => setMaintForm({ ...maintForm, image_url: val })} />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button onClick={() => setShowMaint(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleMaint} disabled={!maintForm.description} className="px-4 py-2 rounded-lg text-sm bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-medium transition">Abrir Manutencao</button>
        </div>
      </Modal>

      {/* Modal de Impressão do Termo de Responsabilidade */}
      <Modal open={showTermPrintModal} onClose={() => setShowTermPrintModal(false)} title="Termo de Responsabilidade">
        <div id="print-term-area" className="bg-white text-black p-8 rounded-lg max-h-[60vh] overflow-y-auto space-y-6 font-sans">
          <div className="text-center space-y-1 border-b pb-4">
            <h2 className="text-xl font-bold uppercase tracking-wide">Termo de Responsabilidade de Equipamento</h2>
            <p className="text-xs text-gray-500">IT MANAGER - GOVERNANÇA DE TI & CONTROLE OPERACIONAL</p>
          </div>
          <div className="text-sm space-y-4 leading-relaxed">
            <p>
              Eu, <strong className="text-black">{asset.assigned_to}</strong>, pertencente ao departamento{' '}
              <strong className="text-black">{asset.dept || '-'}</strong>, declaro para os devidos fins ter recebido da empresa,{' '}
              nesta data, o equipamento de TI descrito abaixo, de propriedade da empresa, em perfeito estado de conservação e funcionamento:
            </p>
            <div className="bg-gray-100 p-4 rounded-lg border space-y-2 text-xs">
              <p><strong>Equipamento / Ativo</strong>: {asset.name}</p>
              <p><strong>Categoria</strong>: {asset.category}</p>
              <p><strong>Marca / Modelo</strong>: {asset.brand} {asset.model}</p>
              <p><strong>Nº de Série</strong>: {asset.serial_number || '-'}</p>
              <p><strong>Código de Patrimônio</strong>: {asset.asset_tag || '-'}</p>
              <p><strong>Valor Estimado</strong>: {fmt(asset.cost)}</p>
            </div>
            <p>
              Comprometo-me a zelar pela guarda, integridade e correta utilização do equipamento acima especificado, assumindo a{' '}
              responsabilidade exclusiva por danos decorrentes de negligência, imperícia ou uso inadequado, autorizando, desde já,{' '}
              o desconto em folha de pagamento de eventuais prejuízos causados por perda ou avarias decorrentes de conduta culposa.{' '}
              Comprometo-me, ainda, a devolvê-lo imediatamente em caso de rescisão do contrato de trabalho ou quando solicitado pela TI.
            </p>
            <p className="text-right mt-6">
              Brasil, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div className="border-t pt-4">
                <p className="font-bold">{asset.assigned_to}</p>
                <p className="text-gray-500">Assinatura do Colaborador</p>
              </div>
              <div className="border-t pt-4">
                <p className="font-bold">Departamento de TI</p>
                <p className="text-gray-500">Assinatura do Gestor</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => {
            const printContent = document.getElementById("print-term-area").innerHTML;
            const style = '<style>body { background: white !important; color: black !important; padding: 2cm !important; font-family: sans-serif !important; } .bg-gray-100 { background: #f3f4f6 !important; padding: 1rem !important; border-radius: 0.5rem !important; } .rounded-lg { border-radius: 0.5rem !important; } .border { border: 1px solid #e5e7eb !important; } @media print { body { padding: 0 !important; } button { display: none !important; } }</style>';
            const win = window.open("", "_blank");
            win.document.write("<html><head><title>Termo de Responsabilidade</title>" + style + "</head><body>" + printContent + "</body></html>");
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); win.close(); }, 500);
          }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition">
            Imprimir / Salvar em PDF
          </button>
          <button onClick={() => setShowTermPrintModal(false)} className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-xs transition">
            Fechar
          </button>
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
  const [form, setForm] = useState({ name: '', category: 'Computador', brand: '', model: '', serial_number: '', asset_tag: '', cost: '', status: 'Ativo', assigned_to: '', department_id: '', location: '', purchase_date: '', warranty_end: '', image_url: '', pulsus_number: '', deactivation_wiped: 0, deactivation_eco_recycle: 0, deactivation_document_url: '', deactivation_notes: '', responsibility_term_url: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: 'Computador', brand: '', model: '', serial_number: '', asset_tag: '', cost: '', status: 'Ativo', assigned_to: '', department_id: '', location: '', purchase_date: '', warranty_end: '', image_url: '', residual_value: '', useful_life_months: 60, vendor_id: '', pulsus_number: '', deactivation_wiped: 0, deactivation_eco_recycle: 0, deactivation_document_url: '', deactivation_notes: '', responsibility_term_url: '' });

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
    const snTrim = form.serial_number ? form.serial_number.trim().toLowerCase() : '';
    const tagTrim = form.asset_tag ? form.asset_tag.trim().toLowerCase() : '';

    if (snTrim && assets.some(a => a.serial_number && a.serial_number.trim().toLowerCase() === snTrim)) {
      alert("Atenção: Este Número de Série já está cadastrado em outro ativo!");
      return;
    }
    if (tagTrim && assets.some(a => a.asset_tag && a.asset_tag.trim().toLowerCase() === tagTrim)) {
      alert("Atenção: Este código de Patrimônio já está cadastrado em outro ativo!");
      return;
    }

    try {
      await api.createAsset({ ...form, cost: Number(form.cost) || 0 });
      setShowModal(false); setForm({ name: '', category: 'Computador', brand: '', model: '', serial_number: '', asset_tag: '', cost: '', status: 'Ativo', assigned_to: '', department_id: '', location: '', purchase_date: '', warranty_end: '', image_url: '', pulsus_number: '', deactivation_wiped: 0, deactivation_eco_recycle: 0, deactivation_document_url: '', deactivation_notes: '', responsibility_term_url: '' }); load();
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
      vendor_id: asset.vendor_id || '',
      pulsus_number: asset.pulsus_number || '',
      deactivation_wiped: asset.deactivation_wiped || 0,
      deactivation_eco_recycle: asset.deactivation_eco_recycle || 0,
      deactivation_document_url: asset.deactivation_document_url || '',
      deactivation_notes: asset.deactivation_notes || '',
      responsibility_term_url: asset.responsibility_term_url || ''
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
                          <div><p className="text-white font-medium">{a.name}</p><p className="text-slate-500 text-xs">{a.asset_tag || a.serial_number || ''}{a.pulsus_number && ` · Pulsus: ${a.pulsus_number}`}</p></div>
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
          {form.category === 'Celular' && (
            <Input label="Nº do Pulsus" value={form.pulsus_number} onChange={e => setForm({ ...form, pulsus_number: e.target.value })} placeholder="Ex: P123456" />
          )}
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
          {editForm.category === 'Celular' && (
            <Input label="Nº do Pulsus" value={editForm.pulsus_number} onChange={e => setEditForm({ ...editForm, pulsus_number: e.target.value })} placeholder="Ex: P123456" />
          )}
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
          {(editForm.status === 'Desativado' || editForm.status === 'Inativo') && (
            <div className="col-span-2 mt-4 bg-slate-950/40 border border-slate-700/60 rounded-xl p-4 space-y-4">
              <h3 className="text-amber-400 font-bold text-sm flex items-center gap-1.5"><Shield size={16} /> Conformidade Pós-Desativação (LGPD & Ambiental)</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Este ativo foi marcado como <strong>{editForm.status}</strong>. Responda aos controles de governança necessários para baixa segura:
              </p>
              <div className="flex flex-col sm:flex-row gap-4 py-1">
                <label className="flex items-center gap-2 text-white text-xs font-semibold cursor-pointer">
                  <input type="checkbox" checked={!!editForm.deactivation_wiped} onChange={e => setEditForm({ ...editForm, deactivation_wiped: e.target.checked ? 1 : 0 })} className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                  Sanitização de Dados (Data Wiping / LGPD)
                </label>
                <label className="flex items-center gap-2 text-white text-xs font-semibold cursor-pointer">
                  <input type="checkbox" checked={!!editForm.deactivation_eco_recycle} onChange={e => setEditForm({ ...editForm, deactivation_eco_recycle: e.target.checked ? 1 : 0 })} className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                  Descarte Ecológico Certificado (E-Waste)
                </label>
              </div>
              <TextArea label="Justificativa de Desativação" value={editForm.deactivation_notes} onChange={e => setEditForm({ ...editForm, deactivation_notes: e.target.value })} placeholder="Ex: Equipamento obsoleto, sem condições de reparo..." />
              <ImageUpload label="Anexar Laudo / Termo de Descarte (PDF ou Imagem)" value={editForm.deactivation_document_url} onChange={val => setEditForm({ ...editForm, deactivation_document_url: val })} />
            </div>
          )}
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
function Licenses({ user }) {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLicenseId, setSelectedLicenseId] = useState(null);
  
  const [form, setForm] = useState({ name: '', vendor_name: '', license_type: 'Assinatura', category: '', total_seats: 1, used_seats: 0, cost_per_seat: 0, total_cost: 0, billing_cycle: 'Mensal', start_date: '', end_date: '', status: 'Ativa', notes: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', vendor_name: '', license_type: 'Assinatura', category: '', total_seats: 1, used_seats: 0, cost_per_seat: 0, total_cost: 0, billing_cycle: 'Mensal', start_date: '', end_date: '', status: 'Ativa', notes: '', compliance_notes: '' });

  const load = () => {
    setLoading(true);
    api.listLicenses()
      .then(res => {
        const withUtil = res.map(l => ({
          ...l,
          util: l.total_seats > 0 ? Math.round((l.used_seats / l.total_seats) * 100) : 0
        }));
        setLicenses(withUtil);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    await api.createLicense({ 
      ...form, 
      total_seats: Number(form.total_seats) || 0, 
      used_seats: Number(form.used_seats) || 0, 
      cost_per_seat: Number(form.cost_per_seat) || 0, 
      total_cost: Number(form.total_cost) || 0,
      performed_by: user ? user.username : 'Sistema'
    });
    setShowModal(false);
    setForm({ name: '', vendor_name: '', license_type: 'Assinatura', category: '', total_seats: 1, used_seats: 0, cost_per_seat: 0, total_cost: 0, billing_cycle: 'Mensal', start_date: '', end_date: '', status: 'Ativa', notes: '' });
    load();
  };

  const handleOpenEdit = (lic) => {
    setEditForm({
      id: lic.id,
      name: lic.name || '',
      vendor_name: lic.vendor_name || '',
      license_type: lic.license_type || 'Assinatura',
      category: lic.category || '',
      total_seats: lic.total_seats || 1,
      used_seats: lic.used_seats || 0,
      cost_per_seat: lic.cost_per_seat || 0,
      total_cost: lic.total_cost || 0,
      billing_cycle: lic.billing_cycle || 'Mensal',
      start_date: lic.start_date || '',
      end_date: lic.end_date || '',
      status: lic.status || 'Ativa',
      notes: lic.notes || '',
      compliance_notes: lic.compliance_notes || ''
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    try {
      await api.updateLicense(editForm.id, {
        ...editForm,
        total_seats: Number(editForm.total_seats) || 0,
        used_seats: Number(editForm.used_seats) || 0,
        cost_per_seat: Number(editForm.cost_per_seat) || 0,
        total_cost: Number(editForm.total_cost) || 0,
        performed_by: user ? user.username : 'Sistema'
      });
      setShowEditModal(false);
      load();
    } catch (err) {
      alert('Erro ao atualizar licença: ' + err.message);
    }
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

  if (selectedLicenseId) {
    return <LicenseDetail licenseId={selectedLicenseId} onBack={() => { setSelectedLicenseId(null); load(); }} />;
  }

  const totalCost = licenses.reduce((s, l) => s + (l.total_cost || 0), 0);
  const totalSeats = licenses.reduce((s, l) => s + (l.total_seats || 0), 0);
  const usedSeats = licenses.reduce((s, l) => s + (l.used_seats || 0), 0);

  // Calcular desperdício de Overlicensing e riscos de Underlicensing para SAM (ISO/IEC 19770-1)
  const overlicensingWaste = licenses.reduce((sum, l) => {
    if (l.total_seats > l.used_seats) {
      return sum + ((l.total_seats - l.used_seats) * (l.cost_per_seat || 0));
    }
    return sum;
  }, 0);

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

      {/* SAM Summary Panel (ISO/IEC 19770) */}
      {!loading && licenses.length > 0 && (
        <div className="bg-slate-800/40 rounded-xl p-5 ring-1 ring-slate-700/60 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Shield size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Gestão de Ativos de Software (SAM)</h2>
                <p className="text-slate-400 text-[11px] mt-0.5">Alinhamento com a Norma Internacional ISO/IEC 19770-1</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700/60 text-blue-400 uppercase tracking-wider">ISO 19770-1</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Progress bar showing overall utilization */}
            <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-800 space-y-2 flex flex-col justify-center">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Utilização Geral de Seats</span>
                <span className="text-white font-medium">
                  {usedSeats} de {totalSeats} ({totalSeats > 0 ? ((usedSeats / totalSeats) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usedSeats > totalSeats ? 'bg-red-500' : (usedSeats / totalSeats) > 0.9 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(totalSeats > 0 ? (usedSeats / totalSeats) * 100 : 0, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Métrica consolidada de licenças contratadas vs. alocadas aos ativos.
              </p>
            </div>

            {/* Overlicensing / Underlicensing Alerts */}
            <div className="space-y-3 flex flex-col justify-center">
              {/* Overlicensing Waste Alert */}
              {totalSeats > usedSeats && overlicensingWaste > 0 && (
                <div className="flex gap-3 bg-amber-500/10 text-amber-300 rounded-lg p-3.5 border border-amber-500/20 text-xs">
                  <AlertTriangle className="shrink-0 text-amber-400" size={16} />
                  <div>
                    <span className="font-semibold block text-amber-400">Otimização de Custos (Overlicensing)</span>
                    <p className="mt-0.5 leading-relaxed text-slate-300">
                      Você possui <strong className="text-amber-400">{totalSeats - usedSeats}</strong> licenças ociosas. 
                      Desperdício financeiro estimado: <strong className="text-amber-400">{fmt(overlicensingWaste)}</strong> por ciclo. Considere reduzir o plano.
                    </p>
                  </div>
                </div>
              )}

              {/* Underlicensing Risco Legal Warning */}
              {usedSeats > totalSeats && (
                <div className="flex gap-3 bg-red-500/10 text-red-300 rounded-lg p-3.5 border border-red-500/20 text-xs">
                  <XCircle className="shrink-0 text-red-400" size={16} />
                  <div>
                    <span className="font-semibold block text-red-400">Risco Legal & Compliance (Underlicensing)</span>
                    <p className="mt-0.5 leading-relaxed text-slate-300">
                      Há <strong className="text-red-400">{usedSeats - totalSeats}</strong> seats em uso acima do limite contratado geral.
                      Isso viola a conformidade da <strong>ISO/IEC 19770-1</strong> e expõe a empresa a riscos de auditoria e multas!
                    </p>
                  </div>
                </div>
              )}

              {/* In compliance message if totalSeats === usedSeats */}
              {totalSeats > 0 && totalSeats === usedSeats && (
                <div className="flex gap-3 bg-emerald-500/10 text-emerald-300 rounded-lg p-3.5 border border-emerald-500/20 text-xs">
                  <CheckCircle2 className="shrink-0 text-emerald-400" size={16} />
                  <div>
                    <span className="font-semibold block text-emerald-400">Conformidade Perfeita</span>
                    <p className="mt-0.5 leading-relaxed text-slate-300">
                      100% de eficiência. Todos os seats contratados estão alocados, garantindo zero desperdício e compliance total de conformidade.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {licenses.map(l => (
            <div key={l.id} className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 hover:bg-slate-800/80 transition">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-white font-semibold">{l.name}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">{l.vendor_name || 'Sem fornecedor'} &middot; {l.license_type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setSelectedLicenseId(l.id)} title="Visualizar" className="text-slate-500 hover:text-blue-400 transition"><Eye size={14} /></button>
                  <button onClick={() => handleOpenEdit(l)} title="Editar" className="text-slate-500 hover:text-amber-400 transition"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(l.id)} title="Excluir" className="text-slate-500 hover:text-red-400 transition"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Badges de Compliance Individual */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${LIC_COLOR[l.status] || 'bg-slate-600 text-slate-300'}`}>{l.status}</span>
                {l.used_seats > l.total_seats ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
                    Sublicenciado (-{l.used_seats - l.total_seats})
                  </span>
                ) : l.used_seats < l.total_seats ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                    Sobrando ({l.total_seats - l.used_seats})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                    Em conformidade
                  </span>
                )}
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
              {l.notes && <p className="text-slate-400 text-xs mt-3 italic border-t border-slate-700/50 pt-2">{l.notes}</p>}
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
          <Input label="Total de Licencas" type="number" value={form.total_seats} onChange={e => {
            const seats = Number(e.target.value) || 0;
            const costPer = Number(form.cost_per_seat) || 0;
            setForm({ ...form, total_seats: e.target.value, total_cost: seats * costPer });
          }} />
          <Input label="Em Uso" type="number" value={form.used_seats} onChange={e => setForm({ ...form, used_seats: e.target.value })} />
          <Input label="Custo/Licenca" type="number" value={form.cost_per_seat} onChange={e => {
            const costPer = Number(e.target.value) || 0;
            const seats = Number(form.total_seats) || 0;
            setForm({ ...form, cost_per_seat: e.target.value, total_cost: seats * costPer });
          }} />
          <Input label="Custo Total" type="number" value={form.total_cost} onChange={e => setForm({ ...form, total_cost: e.target.value })} />
          <Select label="Ciclo" options={['Mensal', 'Anual', 'Unica']} value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value })} />
          <Select label="Status" options={['Ativa', 'Expirando', 'Expirada']} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} />
          <Input label="Inicio" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          <Input label="Fim" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          <div className="col-span-2">
            <TextArea label="Observações / Notas" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas ou observações adicionais sobre a licença..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!form.name} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Criar Licenca</button>
        </div>
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Licença">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nome *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Microsoft 365" />
          <Input label="Fornecedor" value={editForm.vendor_name} onChange={e => setEditForm({ ...editForm, vendor_name: e.target.value })} />
          <Select label="Tipo" options={['Assinatura', 'OEM', 'SaaS', 'Perpetua']} value={editForm.license_type} onChange={e => setEditForm({ ...editForm, license_type: e.target.value })} />
          <Select label="Categoria" options={['Produtividade', 'Seguranca', 'Design', 'Comunicacao', 'Gestao', 'SO']} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
          <Input label="Total de Licenças" type="number" value={editForm.total_seats} onChange={e => {
            const seats = Number(e.target.value) || 0;
            const costPer = Number(editForm.cost_per_seat) || 0;
            setEditForm({ ...editForm, total_seats: e.target.value, total_cost: seats * costPer });
          }} />
          <Input label="Em Uso" type="number" value={editForm.used_seats} onChange={e => setEditForm({ ...editForm, used_seats: e.target.value })} />
          <Input label="Custo/Licença" type="number" value={editForm.cost_per_seat} onChange={e => {
            const costPer = Number(e.target.value) || 0;
            const seats = Number(editForm.total_seats) || 0;
            setEditForm({ ...editForm, cost_per_seat: e.target.value, total_cost: seats * costPer });
          }} />
          <Input label="Custo Total" type="number" value={editForm.total_cost} onChange={e => setEditForm({ ...editForm, total_cost: e.target.value })} />
          <Select label="Ciclo" options={['Mensal', 'Anual', 'Unica']} value={editForm.billing_cycle} onChange={e => setEditForm({ ...editForm, billing_cycle: e.target.value })} />
          <Select label="Status" options={['Ativa', 'Expirando', 'Expirada']} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} />
          <Input label="Início" type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} />
          <Input label="Fim" type="date" value={editForm.end_date} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} />
          <div className="col-span-2">
            <TextArea label="Observações / Notas" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notas ou observações adicionais sobre a licença..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleEditSave} disabled={!editForm.name} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Salvar Alterações</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ LICENSE DETAIL (HISTORICO/DETALHES) ═══════════ */
function LicenseDetail({ licenseId, onBack }) {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); api.getLicense(licenseId).then(setLicense).finally(() => setLoading(false)); };
  useEffect(load, [licenseId]);

  if (loading) return <Loading />;
  if (!license) return <ErrorMsg msg="Licença não encontrada" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/20"><FileKey size={22} className="text-blue-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-white">{license.name}</h1>
              <p className="text-slate-400 text-sm">{license.vendor_name || 'Sem fornecedor'} &middot; {license.license_type}</p>
            </div>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${LIC_COLOR[license.status] || 'bg-slate-600 text-slate-300'}`}>{license.status}</span>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Categoria</p><p className="text-white font-medium text-sm">{license.category || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Total de Licenças</p><p className="text-white font-medium text-sm">{license.total_seats}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Em Uso</p><p className="text-white font-medium text-sm">{license.used_seats}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Utilização</p><p className="text-blue-400 font-medium text-sm">{license.util}%</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Custo Unitário</p><p className="text-white font-medium text-sm">{fmt(license.cost_per_seat)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Custo Total</p><p className="text-emerald-400 font-medium text-sm">{fmt(license.total_cost)}/{license.billing_cycle?.toLowerCase()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Data Início</p><p className="text-white font-medium text-sm">{fmtDate(license.start_date)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Expiração / Fim</p><p className="text-white font-medium text-sm">{fmtDate(license.end_date)}</p>
        </div>
      </div>

      {/* Observações e Chave de Licença */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {license.license_key && (
          <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
            <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2"><Shield size={16} className="text-blue-400" /> Chave de Ativação</h3>
            <p className="text-slate-300 text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40 select-all select-text break-all">{license.license_key}</p>
          </div>
        )}
        {license.compliance_notes && (
          <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
            <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2"><ClipboardCheck size={16} className="text-emerald-400" /> Conformidade</h3>
            <p className="text-slate-300 text-xs">{license.compliance_notes}</p>
          </div>
        )}
      </div>

      {license.notes && (
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2"><MessageSquare size={16} className="text-amber-400" /> Observações</h3>
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{license.notes}</p>
        </div>
      )}

      {/* Timeline Section */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Clock size={16} className="text-blue-400" /> Histórico de Alterações</h3>
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-700" />
          <div className="space-y-4">
            {(license.history || []).map(h => {
              const HIcon = HISTORY_ICON[h.action] || CircleDot;
              const hColor = h.action === 'Cadastro' ? 'text-emerald-400' : 'text-blue-400';
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
            {(!license.history || license.history.length === 0) && (
              <p className="text-slate-500 text-sm text-center py-8">Nenhum registro no histórico</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileLineDetail({ lineId, onBack }) {
  const [line, setLine] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getMobileLine(lineId).then(setLine).finally(() => setLoading(false));
  };
  useEffect(load, [lineId]);

  if (loading) return <Loading />;
  if (!line) return <ErrorMsg msg="Linha móvel não encontrada" />;

  const fmtPhone = (num) => {
    const clean = ("" + num).replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    }
    return num;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/20">
              <Smartphone size={22} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{fmtPhone(line.phone_number)}</h1>
              <p className="text-slate-400 text-sm">
                Plano: {line.plan_name || 'Sem plano'} &middot; {line.sim_card ? `ICCID: ${line.sim_card}` : 'Sem SIM (eSIM)'}
              </p>
            </div>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${line.status === 'Ativo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
          {line.status}
        </span>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Portador</p>
          <p className="text-white font-medium text-sm">{line.assigned_to || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Departamento</p>
          <p className="text-white font-medium text-sm">{line.dept || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Aparelho Associado</p>
          <p className="text-white font-medium text-sm">{line.asset_name || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Nº do Pulsus</p>
          <p className="text-amber-400 font-semibold text-sm">{line.pulsus_number || '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Custo Mensal</p>
          <p className="text-emerald-400 font-medium text-sm">{fmt(line.monthly_cost)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Intervalo de Auditoria</p>
          <p className="text-white font-medium text-sm">{line.audit_interval_days} dias</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Último Inventário</p>
          <p className="text-white font-medium text-sm">{line.last_audited_at ? fmtDate(line.last_audited_at) : 'Nunca'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 ring-1 ring-slate-700/50">
          <p className="text-xs text-slate-500">Status Auditoria</p>
          <p className={`font-semibold text-sm ${line.is_audit_overdue ? 'text-red-400' : 'text-emerald-400'}`}>
            {line.is_audit_overdue ? 'Atrasada' : 'Em dia'} {line.days_since_last_audit !== null && `(${line.days_since_last_audit}d)`}
          </p>
        </div>
      </div>

      {line.notes && (
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
            <MessageSquare size={16} className="text-amber-400" /> Observações
          </h3>
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{line.notes}</p>
        </div>
      )}

      {/* Timeline Section */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Clock size={16} className="text-blue-400" /> Histórico da Linha
        </h3>
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-700" />
          <div className="space-y-4">
            {(line.history || []).map(h => {
              const HIcon = HISTORY_ICON[h.action] || CircleDot;
              const hColor = HISTORY_COLOR[h.action] || 'text-slate-400';
              return (
                <div key={h.id} className="relative flex gap-4 pl-2">
                  <div className={`relative z-10 p-2 rounded-full bg-slate-800 ring-2 ring-slate-700 ${hColor}`}>
                    <HIcon size={14} />
                  </div>
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
                    {h.performed_by && <p className="text-xs text-slate-500 mt-1 font-mono">por {h.performed_by}</p>}
                  </div>
                </div>
              );
            })}
            {(!line.history || line.history.length === 0) && (
              <p className="text-slate-500 text-sm text-center py-8">Nenhum registro no histórico</p>
            )}
          </div>
        </div>
      </div>
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
            <BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#e2e8f0' }} formatter={v => fmt(v)} /><Legend /><Bar dataKey="planejado" name="Planejado" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="realizado" name="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
          <h3 className="text-white font-semibold mb-4">Orcamento por Categoria</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={catArr} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><YAxis type="category" dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#e2e8f0' }} formatter={v => fmt(v)} /><Legend /><Bar dataKey="planejado" name="Planejado" fill="#3b82f6" radius={[0, 4, 4, 0]} /><Bar dataKey="realizado" name="Realizado" fill="#10b981" radius={[0, 4, 4, 0]} /></BarChart>
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

/* ═══════════ TELECOM (MOBILE LINES & AUDITS) ═══════════ */
function AuditItemRow({ item, onConfirm, fmtPhone, fmt }) {
  const [tempUser, setTempUser] = useState(item.confirmed_user || item.original_user || '');
  const [tempNotes, setTempNotes] = useState(item.notes || '');

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
      <td className="px-4 py-3 font-medium text-white">
        <div>
          <p>{fmtPhone(item.phone_number)}</p>
          <p className="text-slate-500 text-xs">{item.plan_name} &middot; {fmt(item.monthly_cost)}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-300">
        <input type="text" value={tempUser} onChange={e => setTempUser(e.target.value)} disabled={item.is_confirmed === 1} className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-44" />
      </td>
      <td className="px-4 py-3 text-slate-300 max-w-sm">
        <textarea 
          value={tempNotes} 
          onChange={e => setTempNotes(e.target.value)} 
          disabled={item.is_confirmed === 1}
          placeholder="Nenhum consumo. Escreva um comentário rápido..." 
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 h-14 resize-none" 
        />
      </td>
      <td className="px-4 py-3">
        {item.is_confirmed === 1 ? (
          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium">
            <CheckCircle size={12} /> Confirmado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 text-xs px-2.5 py-1 rounded-full font-medium">
            <Clock size={12} /> Pendente
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {item.is_confirmed !== 1 && (
          <button onClick={() => onConfirm(item, tempUser, tempNotes)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1">
            <UserCheck size={12} /> Confirmar Portador
          </button>
        )}
      </td>
    </tr>
  );
}

function TelecomPage({ user }) {
  const [tab, setTab] = useState('lines'); // 'lines', 'audits', 'audit-detail'
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [lines, setLines] = useState([]);
  const [audits, setAudits] = useState([]);
  const [assets, setAssets] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  
  // Modals & Form states
  const [showLineModal, setShowLineModal] = useState(false);
  const [showEditLineModal, setShowEditLineModal] = useState(false);
  const [showCreateAuditModal, setShowCreateAuditModal] = useState(false);
  const [showImportLinesModal, setShowImportLinesModal] = useState(false);
  const [importLinesFile, setImportLinesFile] = useState(null);
  const [importLinesResult, setImportLinesResult] = useState(null);
  const [importLinesLoading, setImportLinesLoading] = useState(false);
  const [importLinesError, setImportLinesError] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedLineHistory, setSelectedLineHistory] = useState([]);
  const [selectedLineForHistory, setSelectedLineForHistory] = useState(null);
  const [lineComment, setLineComment] = useState('');
  const [lineAuthor, setLineAuthor] = useState('Admin');
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [lineForm, setLineForm] = useState({ phone_number: '', sim_card: '', assigned_to: '', department_id: '', asset_id: '', plan_name: 'Vivo Empresas', monthly_cost: '', status: 'Ativo', notes: '', audit_interval_days: 90, last_audited_at: '', pulsus_number: '' });
  const [editLineForm, setEditLineForm] = useState({ id: '', phone_number: '', sim_card: '', assigned_to: '', department_id: '', asset_id: '', plan_name: 'Vivo Empresas', monthly_cost: '', status: 'Ativo', notes: '', audit_interval_days: 90, last_audited_at: '', pulsus_number: '' });
  const [auditForm, setAuditForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), title: '' });
  
  const [importing, setImporting] = useState(false);

  const loadLines = () => {
    setLoading(true);
    api.listMobileLines({ search }).then(setLines).finally(() => setLoading(false));
  };

  const loadAudits = () => {
    setLoading(true);
    api.listTelecomAudits().then(setAudits).finally(() => setLoading(false));
  };

  const loadDetail = (aid) => {
    setLoading(true);
    setAuditSearch('');
    api.getTelecomAudit(aid).then(setSelectedAudit).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'lines' || tab === 'management') {
      loadLines();
    }
    if (tab === 'audits' || tab === 'management') {
      loadAudits();
    }
    if (tab === 'audit-detail' && selectedAuditId) {
      loadDetail(selectedAuditId);
    }
  }, [tab, search, selectedAuditId]);

  useEffect(() => {
    api.listAssets({}).then(setAssets).catch(() => {});
    api.departments().then(setDepts).catch(() => {});
  }, []);

  const handleImportLines = async () => {
    if (!importLinesFile) return;
    setImportLinesLoading(true);
    setImportLinesError(null);
    setImportLinesResult(null);
    try {
      const res = await api.importMobileLines(importLinesFile);
      setImportLinesResult(res);
      loadLines();
    } catch (err) {
      setImportLinesError(err.message || 'Erro inesperado ao importar.');
    } finally {
      setImportLinesLoading(false);
    }
  };

  const handleCloseAudit = async () => {
    if (!window.confirm("Deseja realmente finalizar esta auditoria? Ela será marcada como concluída.")) return;
    try {
      await api.closeTelecomAudit(selectedAudit.id);
      loadDetail(selectedAudit.id);
      loadAudits();
    } catch (err) {
      alert("Erro ao finalizar auditoria: " + err.message);
    }
  };

  const handleOpenLineHistory = async (line) => {
    setSelectedLineForHistory(line);
    setLineComment('');
    setLineAuthor('Admin');
    try {
      const res = await api.getMobileLineHistory(line.id);
      setSelectedLineHistory(res);
      setShowHistoryModal(true);
    } catch (err) {
      alert("Erro ao carregar histórico: " + err.message);
    }
  };

  const handleAddLineComment = async () => {
    if (!lineComment.trim() || !selectedLineForHistory) return;
    try {
      await api.addMobileLineComment(selectedLineForHistory.id, {
        author: lineAuthor || 'Admin',
        text: lineComment
      });
      setLineComment('');
      const res = await api.getMobileLineHistory(selectedLineForHistory.id);
      setSelectedLineHistory(res);
    } catch (err) {
      alert("Erro ao adicionar comentário: " + err.message);
    }
  };

  const handleCreateLine = async () => {
    try {
      await api.createMobileLine({ ...lineForm, monthly_cost: Number(lineForm.monthly_cost) || 0, audit_interval_days: Number(lineForm.audit_interval_days) || 90 });
      setShowLineModal(false);
      setLineForm({ phone_number: '', sim_card: '', assigned_to: '', department_id: '', asset_id: '', plan_name: 'Vivo Empresas', monthly_cost: '', status: 'Ativo', notes: '', audit_interval_days: 90, last_audited_at: '', pulsus_number: '' });
      loadLines();
    } catch (err) {
      alert('Erro ao salvar linha: ' + err.message);
    }
  };

  const handleOpenEditLine = (line) => {
    setEditLineForm({
      id: line.id,
      phone_number: line.phone_number || '',
      sim_card: line.sim_card || '',
      assigned_to: line.assigned_to || '',
      department_id: line.department_id || '',
      asset_id: line.asset_id || '',
      plan_name: line.plan_name || 'Vivo Empresas',
      monthly_cost: line.monthly_cost || 0,
      status: line.status || 'Ativo',
      notes: line.notes || '',
      audit_interval_days: line.audit_interval_days || 90,
      last_audited_at: line.last_audited_at || '',
      pulsus_number: line.pulsus_number || ''
    });
    setShowEditLineModal(true);
  };

  const handleEditLineSave = async () => {
    try {
      await api.updateMobileLine(editLineForm.id, {
        ...editLineForm,
        monthly_cost: Number(editLineForm.monthly_cost) || 0,
        audit_interval_days: Number(editLineForm.audit_interval_days) || 90
      });
      setShowEditLineModal(false);
      loadLines();
    } catch (err) {
      alert('Erro ao atualizar linha: ' + err.message);
    }
  };

  const handleDeleteLine = async (id) => {
    if (!window.confirm('Remover esta linha telefônica?')) return;
    try {
      await api.deleteMobileLine(id);
      loadLines();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleCreateAudit = async () => {
    try {
      const res = await api.createTelecomAudit(auditForm);
      setShowCreateAuditModal(false);
      setAuditForm({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), title: '' });
      setSelectedAuditId(res.id);
      setTab('audit-detail');
    } catch (err) {
      alert('Erro ao criar auditoria: ' + err.message);
    }
  };

  const handleConfirmItem = async (item, confirmedUser, notes) => {
    try {
      await api.updateTelecomAuditItem(selectedAuditId, item.id, {
        confirmed_user: confirmedUser || item.original_user,
        is_confirmed: true,
        sync_to_line: true,
        notes: notes !== undefined ? notes : item.notes
      });
      loadDetail(selectedAuditId);
    } catch (err) {
      alert('Erro ao confirmar: ' + err.message);
    }
  };

  const handleImportVivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await api.importVivoInvoice(selectedAuditId, file);
      alert(res.message);
      loadDetail(selectedAuditId);
    } catch (err) {
      alert('Erro ao processar fatura: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const fmtPhone = (num) => {
    const clean = ("" + num).replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    }
    return num;
  };

  const filteredAuditItems = (selectedAudit?.items || []).filter(item => {
    const query = auditSearch.toLowerCase().trim();
    if (!query) return true;
    
    const phone = (item.phone_number || '').toLowerCase();
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanQuery = query.replace(/\D/g, '');

    const portador = (item.original_user || '').toLowerCase();
    const confPortador = (item.confirmed_user || '').toLowerCase();

    return phone.includes(query) || 
           (cleanQuery && cleanPhone.includes(cleanQuery)) ||
           portador.includes(query) ||
           confPortador.includes(query);
  });

  if (selectedLineId) {
    return <MobileLineDetail lineId={selectedLineId} onBack={() => { setSelectedLineId(null); loadLines(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Linhas Móveis & Telecom</h1>
          <p className="text-slate-400 text-sm mt-1">Gestão de linhas telefônicas da Vivo e auditoria de consumo</p>
        </div>
        
        {/* Buttons */}
        <div className="flex gap-2">
          {tab === 'lines' && (
            <>
              <button onClick={() => setShowImportLinesModal(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition border border-slate-700">
                <Upload size={16} /> Importar CSV
              </button>
              <button onClick={() => setShowLineModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
                <Plus size={16} /> Nova Linha
              </button>
            </>
          )}
          {tab === 'audits' && (
            <button onClick={() => setShowCreateAuditModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
              <ClipboardCheck size={16} /> Nova Auditoria
            </button>
          )}
          {tab === 'audit-detail' && (
            <button onClick={() => { setTab('audits'); setSelectedAuditId(null); setSelectedAudit(null); }} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
              <ArrowLeft size={16} /> Voltar para Auditorias
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tab !== 'audit-detail' && (
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
          <button onClick={() => { setTab('lines'); }} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'lines' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Linhas Telefônicas</button>
          <button onClick={() => { setTab('audits'); }} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'audits' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Auditoria de Consumo</button>
          <button onClick={() => { setTab('management'); }} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'management' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Gestão & Indicadores</button>
        </div>
      )}

      {/* Main Content */}
      {tab === 'lines' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por número, portador ou sim card..." className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {loading ? <Loading /> : (
            <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-left">
                      <th className="px-4 py-3 font-medium">Linha Telefônica</th>
                      <th className="px-4 py-3 font-medium">Portador</th>
                      <th className="px-4 py-3 font-medium">Departamento</th>
                      <th className="px-4 py-3 font-medium">Aparelho Associado</th>
                      <th className="px-4 py-3 font-medium">Plano Vivo</th>
                      <th className="px-4 py-3 font-medium text-right">Custo Mensal</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => (
                      <tr key={line.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3 font-medium text-white">
                          <div>
                            <div className="flex items-center gap-2">
                              <span>{fmtPhone(line.phone_number)}</span>
                              {line.is_audit_overdue ? (
                                <span className="inline-flex items-center gap-0.5 bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  <AlertTriangle size={10} /> Vencido
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  <CheckCircle size={10} /> Em Dia
                                </span>
                              )}
                            </div>
                            <p className="text-slate-500 text-xs font-mono mt-0.5">
                              ICCID: {line.sim_card || 'Sem SIM (eSIM)'}{line.pulsus_number && ` · Pulsus: ${line.pulsus_number}`} &middot; Cadastrado: {fmtDate(line.created_at)} &middot; <span className="italic text-slate-400">Último Inventário: {line.last_audited_at ? fmtDate(line.last_audited_at) : 'Nunca'}</span>
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{line.assigned_to || '-'}</td>
                        <td className="px-4 py-3 text-slate-300">{line.dept || '-'}</td>
                        <td className="px-4 py-3 text-slate-300">
                          <div className="flex items-center gap-1.5">
                            {line.asset_name ? (
                              <>
                                <Laptop size={14} className="text-blue-400" />
                                <span>{line.asset_name}</span>
                              </>
                            ) : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{line.plan_name || 'Vivo'}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{fmt(line.monthly_cost)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${line.status === 'Ativo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                            {line.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right flex gap-2 justify-end">
                          <button onClick={() => setSelectedLineId(line.id)} title="Visualizar" className="text-slate-500 hover:text-blue-400 transition"><Eye size={16} /></button>
                          <button onClick={() => handleOpenLineHistory(line)} title="Timeline / Histórico" className="text-slate-500 hover:text-blue-400 transition"><Clock size={16} /></button>
                          <button onClick={() => handleOpenEditLine(line)} title="Editar" className="text-slate-500 hover:text-amber-400 transition"><Edit3 size={16} /></button>
                          <button onClick={() => handleDeleteLine(line.id)} title="Excluir" className="text-slate-500 hover:text-red-400 transition"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Nenhuma linha móvel encontrada</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'audits' && (
        <div className="space-y-4">
          {loading ? <Loading /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {audits.map(audit => {
                const pct = audit.total_items > 0 ? ((audit.confirmed_items / audit.total_items) * 100).toFixed(0) : 0;
                return (
                  <div key={audit.id} className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 hover:bg-slate-800/80 transition flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-white font-semibold text-base">{audit.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${audit.status === 'Aberto' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {audit.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs">Mês/Ano Ref: {String(audit.month).padStart(2, '0')}/{audit.year}</p>
                      
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Confirmado</span>
                          <span>{audit.confirmed_items} de {audit.total_items} linhas ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    </div>
                    
                    <button onClick={() => { setSelectedAuditId(audit.id); setTab('audit-detail'); }} className="mt-5 w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-1.5">
                      <Eye size={14} /> Abrir Reconciliação
                    </button>
                  </div>
                );
              })}
              {audits.length === 0 && (
                <div className="col-span-full py-16 text-center bg-slate-800/20 rounded-2xl border border-dashed border-slate-700/50 p-8 flex flex-col items-center justify-center">
                  <ClipboardCheck size={48} className="text-slate-600 mb-4" />
                  <p className="text-slate-300 text-base font-medium">Nenhum inventário ou auditoria cadastrado</p>
                  <p className="text-slate-500 text-sm mt-1 mb-6">Inicie uma nova auditoria para conciliar faturas e confirmar portadores.</p>
                  <button onClick={() => setShowCreateAuditModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition shadow-lg shadow-blue-500/20">
                    <Plus size={16} /> Iniciar Primeira Auditoria
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'management' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Smartphone} label="Total de Linhas" value={lines.length} color="blue" />
            <KpiCard icon={AlertTriangle} label="Auditorias Vencidas" value={lines.filter(l => l.is_audit_overdue).length} sub="Necessitam de inventário" color="amber" />
            <KpiCard icon={CheckCircle} label="Em Dia" value={lines.filter(l => !l.is_audit_overdue).length} sub="Dentro do prazo" color="emerald" />
            <KpiCard icon={DollarSign} label="Custo Mensal Estimado" value={fmt(lines.reduce((acc, curr) => acc + (curr.monthly_cost || 0), 0))} color="cyan" />
          </div>

          {/* Primeira Linha de Painéis: Alertas e Gestão por Departamento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Painel Alertas de Auditoria Vencida */}
            <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-400" /> Alertas: Inventário Necessário (&gt;90 dias)</h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {lines.filter(l => l.is_audit_overdue).map(line => (
                    <div key={line.id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-3 border border-red-500/10">
                      <div>
                        <p className="text-white font-semibold text-sm">{fmtPhone(line.phone_number)}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Portador: <span className="text-slate-300 font-medium">{line.assigned_to || 'Não designado'}</span> &middot; Depto: {line.dept || '-'}</p>
                        <p className="text-red-400 text-xs mt-1 font-medium flex items-center gap-1">
                          <Clock size={12} /> {line.days_since_last_audit === null ? 'Nunca auditado' : `Última auditoria há ${line.days_since_last_audit} dias`}
                        </p>
                      </div>
                      <button onClick={() => handleOpenEditLine(line)} className="text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                        <Edit3 size={12} /> Ajustar
                      </button>
                    </div>
                  ))}
                  {lines.filter(l => l.is_audit_overdue).length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                      Todas as linhas estão em dia com a auditoria!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Painel Controle por Departamento */}
            <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Building2 size={18} className="text-blue-400" /> Distribuição & Conformidade por Departamento</h3>
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {depts.map(dept => {
                    const deptLines = lines.filter(l => l.department_id === dept.id);
                    const overdueCount = deptLines.filter(l => l.is_audit_overdue).length;
                    const compliancePct = deptLines.length > 0 ? (((deptLines.length - overdueCount) / deptLines.length) * 100).toFixed(0) : 100;
                    return (
                      <div key={dept.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-white font-medium">{dept.name}</span>
                            <span className="text-slate-500 text-xs ml-2">({deptLines.length} linhas)</span>
                          </div>
                          <span className={`text-xs font-semibold ${Number(compliancePct) === 100 ? 'text-emerald-400' : Number(compliancePct) > 50 ? 'text-blue-400' : 'text-amber-400'}`}>
                            {compliancePct}% em dia
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden flex">
                          <div 
                            className={`h-full rounded-full transition-all ${Number(compliancePct) === 100 ? 'bg-emerald-500' : Number(compliancePct) > 50 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                            style={{ width: `${compliancePct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                  {depts.length === 0 && (
                    <p className="text-slate-500 text-xs text-center py-12">Nenhum departamento cadastrado</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Segunda Linha de Painéis: Qualidade de Cadastro e Resumo dos Inventários */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Painel Auditoria de Qualidade dos Dados */}
            <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Shield size={18} className="text-pink-400" /> Qualidade dos Cadastros (Dados Incompletos)
                </h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {lines.filter(l => !l.sim_card || !l.assigned_to || !l.department_id || !l.asset_id || !l.pulsus_number).map(line => {
                    const missing = [];
                    if (!line.assigned_to) missing.push("Portador");
                    if (!line.sim_card) missing.push("ICCID/SIM");
                    if (!line.department_id) missing.push("Depto");
                    if (!line.asset_id) missing.push("Aparelho");
                    if (!line.pulsus_number) missing.push("Pulsus");
                    
                    return (
                      <div key={line.id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                        <div className="space-y-1.5">
                          <p className="text-white font-semibold text-sm">{fmtPhone(line.phone_number)}</p>
                          <div className="flex flex-wrap gap-1">
                            {missing.map(m => (
                              <span 
                                key={m} 
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  m === 'Portador' ? 'bg-slate-700 text-slate-300' :
                                  m === 'ICCID/SIM' ? 'bg-amber-500/20 text-amber-400' :
                                  m === 'Depto' ? 'bg-blue-500/20 text-blue-400' :
                                  m === 'Aparelho' ? 'bg-purple-500/20 text-purple-400' :
                                  'bg-pink-500/20 text-pink-400'
                                }`}
                              >
                                Sem {m}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleOpenEditLine(line)} className="text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                          <Edit3 size={12} /> Completar
                        </button>
                      </div>
                    );
                  })}
                  {lines.filter(l => !l.sim_card || !l.assigned_to || !l.department_id || !l.asset_id || !l.pulsus_number).length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                      Todos os cadastros de linha estão 100% completos!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Painel Resumo dos Inventários (Auditorias) */}
            <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-emerald-400" /> Resumo das Auditorias de Fatura
                </h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {audits.slice(0, 5).map(audit => {
                    const pct = audit.total_items > 0 ? ((audit.confirmed_items / audit.total_items) * 100).toFixed(0) : 0;
                    return (
                      <div key={audit.id} className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30 flex items-center justify-between">
                        <div className="space-y-1.5 flex-1 mr-4">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-semibold text-sm">{audit.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${audit.status === 'Aberto' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {audit.status}
                            </span>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                              <span>Ref: {String(audit.month).padStart(2, '0')}/{audit.year} &middot; {audit.confirmed_items} de {audit.total_items} confirmados</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${Number(pct) === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => { setSelectedAuditId(audit.id); setTab('audit-detail'); }} 
                          className="text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-3 py-2 rounded-lg transition"
                        >
                          Ver
                        </button>
                      </div>
                    );
                  })}
                  {audits.length === 0 && (
                    <p className="text-slate-500 text-xs text-center py-12">Nenhuma auditoria iniciada</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit-detail' && selectedAudit && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">{selectedAudit.title}</h2>
              <p className="text-slate-400 text-sm mt-0.5">Status: <span className="text-amber-400 font-semibold">{selectedAudit.status}</span></p>
            </div>
            
            <div className="flex items-center gap-3">
              {selectedAudit.status === 'Aberto' && (
                <button 
                  onClick={handleCloseAudit} 
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  <CheckCircle size={16} /> Finalizar Auditoria
                </button>
              )}
              {selectedAudit.status !== 'Aberto' && (
                <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-lg text-sm font-semibold border border-emerald-500/30">
                  <CheckCircle size={16} /> Auditoria Concluída
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/30">
              <div>
                <h3 className="text-white font-semibold text-sm">Lista de Conciliação por Linha</h3>
                <p className="text-xs text-slate-400 mt-0.5">Total de linhas nesta auditoria: {selectedAudit.items?.length || 0}</p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  value={auditSearch} 
                  onChange={e => setAuditSearch(e.target.value)} 
                  placeholder="Buscar por número ou portador..." 
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
                {auditSearch && (
                  <button 
                    onClick={() => setAuditSearch('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-left">
                    <th className="px-4 py-3 font-medium">Linha Vivo</th>
                    <th className="px-4 py-3 font-medium">Portador Cadastrado</th>
                    <th className="px-4 py-3 font-medium">Informação de Consumo / Auditoria</th>
                    <th className="px-4 py-3 font-medium">Confirmação</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditItems.map(item => (
                    <AuditItemRow key={item.id} item={item} onConfirm={handleConfirmItem} fmtPhone={fmtPhone} fmt={fmt} />
                  ))}
                  {(!selectedAudit.items || selectedAudit.items.length === 0) && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Nenhum registro para validar.</td></tr>
                  )}
                  {selectedAudit.items && selectedAudit.items.length > 0 && filteredAuditItems.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Nenhum registro corresponde à busca.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Histórico/Timeline Modal da Linha */}
      <Modal open={showHistoryModal} onClose={() => { setShowHistoryModal(false); setSelectedLineForHistory(null); setSelectedLineHistory([]); }} title={selectedLineForHistory ? `Histórico - ${fmtPhone(selectedLineForHistory.phone_number)}` : 'Histórico da Linha'}>
        <div className="space-y-6 max-w-xl">
          {/* Caixa de Comentário */}
          <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-4">
            <h3 className="text-white font-semibold text-xs mb-3 flex items-center gap-2">
              <MessageSquare size={14} className="text-slate-400" /> Adicionar Comentário
            </h3>
            <div className="flex gap-2">
              <input 
                value={lineComment} 
                onChange={e => setLineComment(e.target.value)} 
                placeholder="Escreva um comentário sobre esta linha..." 
                className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleAddLineComment()} 
              />
              <button 
                onClick={handleAddLineComment} 
                disabled={!lineComment.trim()} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition"
              >
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* Timeline da Linha */}
          <div className="relative max-h-[400px] overflow-y-auto pr-1">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-800" />
            <div className="space-y-4">
              {(selectedLineHistory || []).map(h => {
                const HIcon = HISTORY_ICON[h.action] || CircleDot;
                const hColor = HISTORY_COLOR[h.action] || 'text-slate-400';
                return (
                  <div key={h.id} className="relative flex gap-4 pl-2">
                    <div className={`relative z-10 p-1.5 rounded-full bg-slate-950 ring-2 ring-slate-800 ${hColor}`}>
                      <HIcon size={12} />
                    </div>
                    <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <span className="text-white font-medium text-xs">{h.action}</span>
                          {h.from_value && h.to_value && (
                            <span className="text-slate-400 text-xs ml-2">
                              <span className="text-red-400/80 font-mono">{h.from_value}</span>
                              <ChevronRight size={10} className="inline mx-1" />
                              <span className="text-emerald-400/80 font-mono">{h.to_value}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap font-mono">{fmtDateTime(h.created_at)}</span>
                      </div>
                      {h.notes && <p className="text-slate-300 text-xs mt-1 leading-relaxed">{h.notes}</p>}
                      {h.performed_by && <p className="text-[10px] text-slate-500 mt-1 font-mono">por {h.performed_by}</p>}
                    </div>
                  </div>
                );
              })}
              {(!selectedLineHistory || selectedLineHistory.length === 0) && (
                <p className="text-slate-500 text-xs text-center py-8">Nenhum registro no histórico desta linha.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button 
            onClick={() => { setShowHistoryModal(false); setSelectedLineForHistory(null); setSelectedLineHistory([]); }} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </Modal>

      {/* Importar Linhas Modal */}
      <Modal open={showImportLinesModal} onClose={() => { setShowImportLinesModal(false); setImportLinesFile(null); setImportLinesResult(null); setImportLinesError(null); }} title="Importação em Massa - Linhas Móveis">
        <div className="space-y-4 max-w-xl">
          {/* Visualizador de Layout */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Exemplo do Layout Esperado (Planilha CSV)</h3>
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-800 text-slate-300 font-semibold border-b border-slate-700">
                      <th className="px-2.5 py-1.5 border-r border-slate-700">telefone *</th>
                      <th className="px-2.5 py-1.5 border-r border-slate-700">iccid</th>
                      <th className="px-2.5 py-1.5 border-r border-slate-700">portador</th>
                      <th className="px-2.5 py-1.5 border-r border-slate-700">departamento</th>
                      <th className="px-2.5 py-1.5 border-r border-slate-700">plano</th>
                      <th className="px-2.5 py-1.5 text-right">custo_mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <td className="px-2.5 py-1.5 border-r border-slate-800 font-mono font-medium text-white">19998446265</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800 font-mono">8955101...</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800">João Silva</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800 text-blue-400 font-medium">Gente</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800">Vivo Empresas</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">49.90</td>
                    </tr>
                    <tr className="text-slate-400">
                      <td className="px-2.5 py-1.5 border-r border-slate-800 font-mono font-medium text-white">019998446265</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800 italic text-slate-600">(vazio)</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800">Maria Santos</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800 text-blue-400 font-medium">TI</td>
                      <td className="px-2.5 py-1.5 border-r border-slate-800">Vivo Empresas</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">39.90</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-sans">
              * A primeira linha deve ser o cabeçalho. Variações como <strong>telefone, iccid, portador, departamento, plano, custo_mensal, frequencia, status, observacoes</strong> são mapeadas automaticamente. O sistema normaliza os DDDs com/sem zero (ex: 019... e 19...) impedindo a importação de duplicados.
            </p>
          </div>

          {/* Download do Modelo */}
          <div>
            <a 
              href="/api/telecom/lines/template" 
              onClick={(e) => {
                e.preventDefault();
                const token = localStorage.getItem('it_manager_token');
                fetch('/api/telecom/lines/template', {
                  headers: { 'Authorization': token || '' }
                })
                .then(res => res.blob())
                .then(blob => {
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'modelo_importacao_linhas.csv';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                });
              }}
              className="inline-flex items-center gap-1.5 bg-slate-800/85 hover:bg-slate-700/85 text-blue-400 hover:text-blue-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <Download size={14} /> Baixar Planilha CSV de Exemplo
            </a>
          </div>

          {/* Drag & Drop Input */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-6 bg-slate-900/30 hover:bg-slate-900/50 transition relative">
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImportLinesFile(e.target.files[0]);
                  setImportLinesResult(null);
                  setImportLinesError(null);
                }
              }} 
              className="absolute inset-0 opacity-0 cursor-pointer" 
            />
            <Upload size={28} className="text-slate-500 mb-2" />
            <p className="text-sm font-medium text-white text-center">
              {importLinesFile ? importLinesFile.name : "Selecione ou arraste o arquivo CSV de linhas"}
            </p>
            {importLinesFile && (
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {(importLinesFile.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          {/* Erros */}
          {importLinesError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{importLinesError}</span>
            </div>
          )}

          {/* Resultados */}
          {importLinesResult && (
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Resultado da Importação</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-500">Importadas</p>
                  <p className="text-xl font-bold text-white mt-0.5">{importLinesResult.imported}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-500">Duplicadas Puladas</p>
                  <p className="text-xl font-bold text-white mt-0.5">{importLinesResult.skipped}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg text-center">
                  <p className="text-[10px] uppercase font-bold text-red-400">Linhas Inválidas</p>
                  <p className="text-xl font-bold text-white mt-0.5">{importLinesResult.errors}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="flex justify-end gap-3 mt-5">
          <button 
            onClick={() => {
              setShowImportLinesModal(false);
              setImportLinesFile(null);
              setImportLinesResult(null);
              setImportLinesError(null);
            }} 
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition"
          >
            {importLinesResult ? "Fechar" : "Cancelar"}
          </button>
          {!importLinesResult && (
            <button 
              onClick={handleImportLines} 
              disabled={!importLinesFile || importLinesLoading} 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition"
            >
              {importLinesLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Importando...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Iniciar Importação
                </>
              )}
            </button>
          )}
        </div>
      </Modal>

      {/* Nova Linha Modal */}
      <Modal open={showLineModal} onClose={() => setShowLineModal(false)} title="Nova Linha Móvel (Vivo)">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Número do Telefone *" value={lineForm.phone_number} onChange={e => setLineForm({ ...lineForm, phone_number: e.target.value })} placeholder="11999999999" />
          <Input label="SIM Card (ICCID)" value={lineForm.sim_card} onChange={e => setLineForm({ ...lineForm, sim_card: e.target.value })} placeholder="8955..." />
          <Input label="Nome do Portador" value={lineForm.assigned_to} onChange={e => setLineForm({ ...lineForm, assigned_to: e.target.value })} placeholder="Ex: João da Silva" />
          
          <label className="block mb-3">
            <span className="text-sm text-slate-400 mb-1 block">Departamento</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={lineForm.department_id} onChange={e => setLineForm({ ...lineForm, department_id: e.target.value })}>
              <option value="">Selecione</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>

          <label className="block mb-3">
            <span className="text-sm text-slate-400 mb-1 block">Aparelho Associado</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={lineForm.asset_id} onChange={e => setLineForm({ ...lineForm, asset_id: e.target.value })}>
              <option value="">Nenhum</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.asset_tag || a.serial_number})</option>)}
            </select>
          </label>
          
          <Input label="Plano" value={lineForm.plan_name} onChange={e => setLineForm({ ...lineForm, plan_name: e.target.value })} placeholder="Vivo Smart 50GB" />
          <Input label="Custo Mensal (R$)" type="number" value={lineForm.monthly_cost} onChange={e => setLineForm({ ...lineForm, monthly_cost: e.target.value })} />
          <Input label="Freq. Inventário (Dias)" type="number" value={lineForm.audit_interval_days} onChange={e => setLineForm({ ...lineForm, audit_interval_days: e.target.value })} />
          
          <Select label="Status" options={['Ativo', 'Suspenso', 'Estoque', 'Cancelado']} value={lineForm.status} onChange={e => setLineForm({ ...lineForm, status: e.target.value })} />
          <Input label="Nº do Pulsus" value={lineForm.pulsus_number} onChange={e => setLineForm({ ...lineForm, pulsus_number: e.target.value })} placeholder="Ex: P123456" />
          
          <div className="col-span-2">
            <TextArea label="Notas / Observações" value={lineForm.notes} onChange={e => setLineForm({ ...lineForm, notes: e.target.value })} placeholder="Observações sobre a linha..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowLineModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreateLine} disabled={!lineForm.phone_number} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Criar Linha</button>
        </div>
      </Modal>

      {/* Editar Linha Modal */}
      <Modal open={showEditLineModal} onClose={() => setShowEditLineModal(false)} title="Editar Linha Móvel">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Número do Telefone *" value={editLineForm.phone_number} onChange={e => setEditLineForm({ ...editLineForm, phone_number: e.target.value })} placeholder="11999999999" />
          <Input label="SIM Card (ICCID)" value={editLineForm.sim_card} onChange={e => setEditLineForm({ ...editLineForm, sim_card: e.target.value })} placeholder="8955..." />
          <Input label="Nome do Portador" value={editLineForm.assigned_to} onChange={e => setEditLineForm({ ...editLineForm, assigned_to: e.target.value })} placeholder="Ex: João da Silva" />
          
          <label className="block mb-3">
            <span className="text-sm text-slate-400 mb-1 block">Departamento</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={editLineForm.department_id} onChange={e => setEditLineForm({ ...editLineForm, department_id: e.target.value })}>
              <option value="">Nenhum</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>

          <label className="block mb-3">
            <span className="text-sm text-slate-400 mb-1 block">Aparelho Associado</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={editLineForm.asset_id} onChange={e => setEditLineForm({ ...editLineForm, asset_id: e.target.value })}>
              <option value="">Nenhum</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.asset_tag || a.serial_number})</option>)}
            </select>
          </label>
          
          <Input label="Plano" value={editLineForm.plan_name} onChange={e => setEditLineForm({ ...editLineForm, plan_name: e.target.value })} placeholder="Vivo Smart 50GB" />
          <Input label="Custo Mensal (R$)" type="number" value={editLineForm.monthly_cost} onChange={e => setEditLineForm({ ...editLineForm, monthly_cost: e.target.value })} />
          <Input label="Freq. Inventário (Dias)" type="number" value={editLineForm.audit_interval_days} onChange={e => setEditLineForm({ ...editLineForm, audit_interval_days: e.target.value })} />
          
          <Select label="Status" options={['Ativo', 'Suspenso', 'Estoque', 'Cancelado']} value={editLineForm.status} onChange={e => setEditLineForm({ ...editLineForm, status: e.target.value })} />
          <Input label="Nº do Pulsus" value={editLineForm.pulsus_number} onChange={e => setEditLineForm({ ...editLineForm, pulsus_number: e.target.value })} placeholder="Ex: P123456" />
          
          <div className="col-span-2">
            <TextArea label="Notas / Observações" value={editLineForm.notes} onChange={e => setEditLineForm({ ...editLineForm, notes: e.target.value })} placeholder="Observações sobre a linha..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowEditLineModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleEditLineSave} disabled={!editLineForm.phone_number} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Salvar Alterações</button>
        </div>
      </Modal>

      {/* Nova Auditoria Modal */}
      <Modal open={showCreateAuditModal} onClose={() => setShowCreateAuditModal(false)} title="Nova Auditoria de Fatura Vivo">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Título da Auditoria" value={auditForm.title} onChange={e => setAuditForm({ ...auditForm, title: e.target.value })} placeholder="Auditoria Vivo - Maio/2026" />
          <Input label="Mês Ref (1-12) *" type="number" min="1" max="12" value={auditForm.month} onChange={e => setAuditForm({ ...auditForm, month: e.target.value })} />
          <Input label="Ano Ref *" type="number" value={auditForm.year} onChange={e => setAuditForm({ ...auditForm, year: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowCreateAuditModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreateAudit} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium transition">Iniciar Auditoria</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ CELULARES (PAINEL PULSUS MDM) ═══════════ */
// Todo cálculo vem de lib/pulsus-indicadores.ts (regras em INDICADORES.md do pacote de integração).
const CEL_STATUS_COLOR = { ok: 'bg-emerald-500/20 text-emerald-400', warn: 'bg-amber-500/20 text-amber-400', crit: 'bg-red-500/20 text-red-400', na: 'bg-slate-500/20 text-slate-400', nodata: 'bg-slate-500/20 text-slate-400' };
const CEL_PROB_COLOR = { parado: 'bg-red-500/15 text-red-300', usuario: 'bg-violet-500/15 text-violet-300', patrimonio: 'bg-amber-500/15 text-amber-300', frota: 'bg-amber-500/15 text-amber-300', duplicado: 'bg-rose-500/15 text-rose-300', numero: 'bg-cyan-500/15 text-cyan-300', divergencia: 'bg-pink-500/15 text-pink-300', ciclo: 'bg-slate-500/20 text-slate-300', status: 'bg-slate-500/20 text-slate-400' };
const CEL_PROB_DO_KPI = { sync24: 'semsync', parados: 'parado', cadastro: 'cadastro', duplicidades: 'duplicado', semNumero: 'numero', divergencia: 'divergencia', fimCiclo: 'ciclo', reserva: 'reserva' };
const CEL_FILTROS = [['todos', 'Todos'], ['comproblema', 'Com problema'], ['parado', 'Parados +7 dias'], ['semsync', 'Sem sync em 24h'], ['cadastro', 'Cadastro incompleto'], ['usuario', 'Sem usuário identificado'], ['patrimonio', 'Patrimônio'], ['frota', 'Nº Frota'], ['duplicado', 'Duplicados e inválidos'], ['numero', 'Sem número'], ['divergencia', 'Chip × SMS'], ['ciclo', 'Fim de ciclo'], ['reserva', 'Reserva'], ['comnumero', 'Com número'], ['comchip', 'Com chip'], ['doischips', '2 chips']];
const CEL_SITUACAO_VERSAO = { atual: ['Mais recente', 'bg-emerald-500/20 text-emerald-400'], anterior: ['Versão anterior', 'bg-slate-500/20 text-slate-400'], fim: ['Fim de ciclo', 'bg-red-500/20 text-red-400'], outro: ['Computador', 'bg-slate-500/20 text-slate-400'] };
const fmtPctCel = v => (v == null || isNaN(v) ? '—' : (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%');
const fmtNCel = v => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
const fmtPctInt = v => (v == null || isNaN(v) ? '—' : Math.round(v) + '%');
const fmtAnos = v => (v == null ? '—' : v < 1 ? Math.round(v * 12) + ' meses' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' anos');
const metasDoForm = m => Object.fromEntries(Object.keys(METAS_PADRAO).map(k => [k, k in m ? (m[k] ?? '') : METAS_PADRAO[k].meta]));

async function lerArquivoCSV(file) {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
  return text;
}

function CelPill({ cls, children }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}

function CelPartes({ itens }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 mt-3 pt-3 border-t border-slate-700/50 text-xs">
      {itens.map(([l, v], i) => [<span key={'l' + i} className="text-slate-400">{l}</span>, <span key={'v' + i} className="text-white font-medium text-right font-mono">{v}</span>])}
    </div>
  );
}

function CelCard({ titulo, status, valor, linhas = [], partes, onVer }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50 hover:bg-slate-800/80 transition flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-slate-400 text-sm font-medium">{titulo}</span>
        {status && <CelPill cls={CEL_STATUS_COLOR[status]}>{ROTULO_STATUS[status]}</CelPill>}
      </div>
      <p className="text-2xl font-bold text-white">{valor}</p>
      {linhas.filter(Boolean).map((l, i) => <p key={i} className="text-xs text-slate-500 mt-1">{l}</p>)}
      {partes && partes.length > 0 && <CelPartes itens={partes} />}
      <div className="flex-1" />
      {onVer && <button onClick={onVer} className="mt-3 self-end text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">Ver aparelhos <ChevronRight size={14} /></button>}
    </div>
  );
}

function CelBarra({ qtd, max, pct, cor = 'bg-blue-500' }) {
  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <div className="flex-1 h-2 rounded bg-slate-700/60"><div className={`h-2 rounded ${cor}`} style={{ width: `${(qtd / max) * 100}%` }} /></div>
      <span className="font-mono text-white">{qtd}</span>
      <span className="font-mono text-xs text-slate-500">{Math.round(pct * 100)}%</span>
    </div>
  );
}

function CelSecao({ titulo, info, acoes, children }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div><h2 className="text-lg font-semibold text-white">{titulo}</h2>{info && <p className="text-slate-500 text-xs mt-0.5">{info}</p>}</div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

function CelularesPage() {
  const [rel, setRel] = useState(null);
  const [metas, setMetas] = useState({});
  const [metasForm, setMetasForm] = useState(metasDoForm({}));
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [msg, setMsg] = useState(null);
  const [metasMsg, setMetasMsg] = useState('');
  const [importando, setImportando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [grupo, setGrupo] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const listaRef = useRef(null);

  useEffect(() => {
    Promise.all([api.getCelularesRelatorio(), api.getCelularesMetas()])
      .then(([r, m]) => { setRel(r); setMetas(m); setMetasForm(metasDoForm(m)); })
      .catch(e => setLoadErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const relatorio = useMemo(() => (rel ? { base: rel.base, dispositivos: rel.dispositivos } : null), [rel]);
  const grupos = useMemo(() => (relatorio ? [...new Set(relatorio.dispositivos.map(d => d.grupo))].sort((a, b) => a.localeCompare(b, 'pt-BR')) : []), [relatorio]);
  const calc = useMemo(() => relatorio && {
    k: calcularIndicadores(relatorio, grupo),
    chips: analisarChips(relatorio, grupo),
    modelos: analisarModelos(relatorio, grupo),
    versoes: analisarVersoes(relatorio, grupo),
  }, [relatorio, grupo]);

  const importar = async (file) => {
    if (!file) return;
    setMsg(null); setImportando(true);
    try {
      const lido = lerRelatorioPulsus(await lerArquivoCSV(file));
      if (!lido.dispositivos.length) throw new Error('Nenhum aparelho encontrado no arquivo.');
      await api.saveCelularesRelatorio({ base: lido.base, arquivo: file.name, dispositivos: lido.dispositivos });
      setRel(await api.getCelularesRelatorio());
      setGrupo(''); setFiltro('todos'); setBusca('');
      setMsg({ tipo: 'ok', texto: `Painel atualizado: ${lido.dispositivos.length} aparelhos, relatório de ${fmtDateTime(lido.base)}.` });
    } catch (e) {
      setMsg({ tipo: 'err', texto: e.message || String(e) });
    } finally {
      setImportando(false);
    }
  };

  const salvarMetas = async () => {
    const novas = Object.fromEntries(Object.keys(METAS_PADRAO).map(k => { const v = metasForm[k]; return [k, v === '' || v == null ? null : Number(v)]; }));
    if (Object.values(novas).some(v => v != null && isNaN(v))) { setMetasMsg('Use apenas números nas metas.'); return; }
    try {
      await api.saveCelularesMetas(novas);
      setMetas(novas); setMetasMsg('Metas salvas.');
    } catch (e) { setMetasMsg('Não foi possível salvar: ' + e.message); }
  };

  const verAparelhos = (f, b = '') => {
    setFiltro(f); setBusca(b);
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const metaTxt = (chave) => {
    const d = METAS_PADRAO[chave], m = chave in metas ? metas[chave] : d.meta;
    if (m == null) return 'Meta não definida';
    return 'Meta ' + (d.direcao === 'max' ? '≥ ' : '≤ ') + m + (d.tipo === 'pct' ? '%' : '');
  };

  const zonaImportacao = (
    <div
      onDragOver={e => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={() => setArrastando(false)}
      onDrop={e => { e.preventDefault(); setArrastando(false); importar(e.dataTransfer?.files?.[0]); }}
      className={`flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-2 border-dashed rounded-xl transition ${arrastando ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700'}`}>
      <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400 self-start"><Upload size={20} /></div>
      <p className="flex-1 text-sm text-slate-400"><span className="text-white font-medium">Atualizar com novo relatório:</span> arraste aqui o CSV exportado do Pulsus (devices_report) ou escolha o arquivo. A página passa a mostrar só o relatório mais recente.</p>
      <label className={`flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${importando ? 'opacity-50 pointer-events-none' : ''}`}>
        {importando ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />} {importando ? 'Importando...' : 'Escolher CSV'}
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { importar(e.target.files[0]); e.target.value = ''; }} />
      </label>
    </div>
  );

  const aviso = msg && (
    <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${msg.tipo === 'ok' ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-red-500/10 text-red-300 ring-1 ring-red-500/30'}`}>
      {msg.tipo === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}<span>{msg.texto}</span>
    </div>
  );

  if (loading) return <Loading />;
  if (loadErr) return <ErrorMsg msg={loadErr} />;

  const cabecalho = (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Celulares</h1>
        <p className="text-slate-400 text-sm mt-1">
          {rel ? `Situação conforme o relatório do Pulsus de ${fmtDateTime(rel.base)} · ${rel.dispositivos.length} aparelhos` : 'Importe o relatório de dispositivos do Pulsus para ver os indicadores.'}
        </p>
        {rel && <p className="text-slate-500 text-xs mt-1">{rel.arquivo || 'Arquivo sem nome'} · importado por {rel.importado_por || '—'} em {fmtDateTime(rel.importado_em && rel.importado_em.replace(' ', 'T') + 'Z')}</p>}
      </div>
      {rel && <div className="sm:w-64"><Select label="Grupo" options={grupos} value={grupo} onChange={e => { setGrupo(e.target.value); setFiltro('todos'); }} /></div>}
    </div>
  );

  const formMetas = (
    <CelSecao titulo="Metas" info="As metas valem para todos os grupos. Percentuais em %. Deixe em branco para não ter meta.">
      <div className="bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-700/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4">
          {Object.entries(METAS_PADRAO).map(([k, d]) => (
            <Input key={k} type="number" step="any" label={`${d.rotulo} (${d.direcao === 'max' ? 'mínimo' : 'máximo'}${d.tipo === 'pct' ? ', %' : ''})`}
              value={metasForm[k]} onChange={e => { setMetasForm({ ...metasForm, [k]: e.target.value }); setMetasMsg(''); }} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <button onClick={salvarMetas} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Salvar metas</button>
          <button onClick={() => { setMetasForm(metasDoForm({})); setMetasMsg('Valores padrão carregados. Clique em Salvar para aplicar.'); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Restaurar padrão</button>
          {metasMsg && <span className="text-xs text-slate-400">{metasMsg}</span>}
        </div>
      </div>
    </CelSecao>
  );

  if (!calc) {
    return (
      <div className="space-y-6">
        {cabecalho}{zonaImportacao}{aviso}
        <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 py-16 text-center text-slate-500 text-sm">Nenhum relatório importado ainda. Use “Escolher CSV” acima.</div>
        {formMetas}
      </div>
    );
  }

  const { k, chips, modelos, versoes } = calc;
  const st = chave => statusMeta(chave, k[chave].valor, metas);
  const cad = k.cadastro.partes;
  const pcAtivos = n => (chips.ativos ? Math.round((n / chips.ativos) * 100) + '%' : '—');

  // Lista de aparelhos
  const sets = { semsync: new Set(k.sync24.ids), cadastro: new Set(k.cadastro.ids), reserva: new Set(k.reserva.ids), duplicado: new Set(k.duplicidades.ids) };
  const doGrupo = relatorio.dispositivos.filter(d => !grupo || d.grupo === grupo);
  const temFiltro = (d, chave) => {
    const ps = k.problemas[d.id] || [];
    if (chave === 'todos') return true;
    if (chave === 'comproblema') return ps.length > 0;
    if (chave === 'comnumero') return !!(d.t1 || d.ts) && d.status === 'active';
    if (chave === 'comchip') return quantidadeChips(d) >= 1 && d.status === 'active';
    if (chave === 'doischips') return quantidadeChips(d) >= 2 && d.status === 'active';
    if (sets[chave]) return sets[chave].has(d.id);
    return ps.some(p => p.tipo === chave);
  };
  const contagem = Object.fromEntries(CEL_FILTROS.map(([c]) => [c, doGrupo.filter(d => temFiltro(d, c)).length]));
  const q = busca.trim().toLowerCase();
  const aparelhos = doGrupo
    .filter(d => temFiltro(d, filtro))
    .filter(d => !q || [d.id, d.nome, d.pat, d.frota, d.t1, d.ts, d.imei, d.iccid, d.grupo, nomeModelo(d), d.cod, d.plat === 'Android' ? 'Android ' + d.os + ';' : d.os].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (k.problemas[b.id]?.length || 0) - (k.problemas[a.id]?.length || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const ultSync = d => { const x = diasSemSync(d, relatorio.base); return x <= 1 ? 'Hoje' : Math.floor(x) + ' d'; };

  const maxModelo = Math.max(...modelos.map(m => m.qtd), 1);
  const situacaoModelo = (m) => {
    const tags = [];
    if (m.fimCiclo) tags.push(['crit', 'Fim de ciclo' + (m.fimCiclo < m.qtd ? ` (${m.fimCiclo})` : '')]);
    if (m.parados / m.qtd >= 0.2) tags.push(['warn', `${m.parados} parados`]);
    if (m.armLivre != null && m.armLivre < 30) tags.push(['warn', 'Pouco espaço']);
    else if (m.poucoEspaco) tags.push(['warn', `${m.poucoEspaco} com pouco espaço`]);
    if (m.plataforma === 'Android' && m.ramGB && m.ramGB < 3) tags.push(['warn', 'RAM baixa']);
    if (!tags.length) tags.push(['ok', 'Em dia']);
    return <div className="flex flex-wrap gap-1">{tags.map(([s, t]) => <CelPill key={t} cls={CEL_STATUS_COLOR[s]}>{t}</CelPill>)}</div>;
  };
  const maxVersao = Math.max(...versoes.map(v => v.qtd), 1);
  const th = 'px-3 py-3 font-medium whitespace-nowrap';
  const td = 'px-3 py-2.5';

  return (
    <div className="space-y-8">
      <div className="space-y-4">{cabecalho}{zonaImportacao}{aviso}</div>

      <CelSecao titulo="Indicadores do parque" info={`${k.ativos} aparelhos ativos${k.inativos ? ` · ${k.inativos} com wipe/inativos` : ''}${grupo ? ' · ' + grupo : ''}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CelCard titulo={METAS_PADRAO.sync24.rotulo} status={st('sync24')} valor={fmtPctCel(k.sync24.valor)} linhas={[metaTxt('sync24'), `${k.sync24.n} de ${k.sync24.de} ativos`]} onVer={() => verAparelhos(CEL_PROB_DO_KPI.sync24)} />
          <CelCard titulo={METAS_PADRAO.parados.rotulo} status={st('parados')} valor={fmtNCel(k.parados.valor)} linhas={[metaTxt('parados')]} onVer={() => verAparelhos(CEL_PROB_DO_KPI.parados)} />
          <CelCard titulo={METAS_PADRAO.cadastro.rotulo} status={st('cadastro')} valor={fmtPctCel(k.cadastro.valor)} linhas={[metaTxt('cadastro')]} onVer={() => verAparelhos(CEL_PROB_DO_KPI.cadastro)}
            partes={[['Usuário identificado', `${cad.usuario}/${k.ativos}`], ['Patrimônio válido', `${cad.patrimonio}/${k.ativos}`], ['Número nos aparelhos com chip', `${cad.numero}/${cad.chips}`], ...(cad.exigeFrota ? [['Nº Frota válido (Tracking)', `${cad.frota}/${cad.exigeFrota}`]] : [])]} />
          <CelCard titulo={METAS_PADRAO.duplicidades.rotulo} status={st('duplicidades')} valor={fmtNCel(k.duplicidades.valor)} linhas={[metaTxt('duplicidades'), 'Patrimônio, Nº Frota ou chip repetido, ou valor inválido']} onVer={() => verAparelhos(CEL_PROB_DO_KPI.duplicidades)} />
          <CelCard titulo={METAS_PADRAO.semNumero.rotulo} status={st('semNumero')} valor={fmtNCel(k.semNumero.valor)} linhas={[metaTxt('semNumero')]} onVer={() => verAparelhos(CEL_PROB_DO_KPI.semNumero)} />
          <CelCard titulo={METAS_PADRAO.divergencia.rotulo} status={st('divergencia')} valor={fmtNCel(k.divergencia.valor)} linhas={[metaTxt('divergencia'), 'Sinal de chip trocado de aparelho']} onVer={() => verAparelhos(CEL_PROB_DO_KPI.divergencia)} />
          <CelCard titulo={METAS_PADRAO.fimCiclo.rotulo} status={st('fimCiclo')} valor={fmtPctCel(k.fimCiclo.valor)} linhas={[metaTxt('fimCiclo'), `${k.fimCiclo.n} de ${k.fimCiclo.de} Android`]} onVer={() => verAparelhos(CEL_PROB_DO_KPI.fimCiclo)} />
          <CelCard titulo={METAS_PADRAO.reserva.rotulo} status={st('reserva')} valor={k.reserva.total ? fmtPctCel(k.reserva.valor) : '—'} linhas={[metaTxt('reserva'), `${k.reserva.prontos} de ${k.reserva.total} reservas sincronizando e com bateria ≥ 50%`]} onVer={() => verAparelhos(CEL_PROB_DO_KPI.reserva)} />
        </div>
      </CelSecao>

      <CelSecao titulo="Chips e números" info={`${chips.ativos} aparelhos ativos${grupo ? ' · ' + grupo : ''}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CelCard titulo="Aparelhos com número cadastrado" valor={fmtNCel(chips.comNumero)} linhas={[`${pcAtivos(chips.comNumero)} dos ativos · ${chips.numerosDistintos} números diferentes`]} onVer={() => verAparelhos('comnumero')}
            partes={[['Número lido do chip', chips.numeroDoChip], ['Número informado por SMS', chips.numeroPorSMS], ['Com os dois', chips.numeroNosDois], ['Sem número', chips.ativos - chips.comNumero]]} />
          <CelCard titulo="Aparelhos com chip" valor={fmtNCel(chips.comChip)} linhas={[`${pcAtivos(chips.comChip)} dos ativos · ${chips.totalChips} chips no total`]} onVer={() => verAparelhos('comchip')}
            partes={[['Sem chip (só Wi-Fi)', chips.semChip], ['Aceitam 2 chips', chips.aceitam2Chips]]} />
          <CelCard titulo="Aparelhos com 2 chips" valor={fmtNCel(chips.com2Chips)} linhas={[`${pcAtivos(chips.com2Chips)} dos ativos`]} onVer={() => verAparelhos('doischips')}
            partes={chips.listaCom2Chips.map(d => [`#${d.id} ${d.nome || '(sem nome)'}`, d.operadoras])} />
          <CelCard titulo="Chips por operadora" valor={fmtNCel(chips.totalChips)} linhas={['chips encontrados nos aparelhos']} partes={chips.operadoras} />
        </div>
      </CelSecao>

      <CelSecao titulo="Modelos" info={`${modelos.length} modelos · ${modelos.reduce((a, m) => a + m.qtd, 0)} aparelhos ativos · ${modelos.reduce((a, m) => a + m.fimCiclo, 0)} em fim de ciclo`}>
        <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-slate-400 text-left">
              {['Modelo', 'Quantidade', 'Sistema', 'RAM · Armaz.', 'Tempo no MDM', 'Sinc. 24h', 'Parados +7d', 'Armaz. livre', 'RAM livre', 'Bateria', 'Situação', 'Onde está'].map(h => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {modelos.map(m => (
                <tr key={m.nome} tabIndex={0} onClick={() => verAparelhos('todos', m.nome)} onKeyDown={e => e.key === 'Enter' && verAparelhos('todos', m.nome)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition cursor-pointer text-slate-300 align-top">
                  <td className={td}><p className="text-white font-medium whitespace-nowrap">{m.nome}</p><p className="text-xs text-slate-500">{m.codigos}</p></td>
                  <td className={td}><CelBarra qtd={m.qtd} max={maxModelo} pct={m.pct} /></td>
                  <td className={`${td} whitespace-nowrap`}>{m.versoes.map(([v, n]) => <div key={v}>{/^\d+$/.test(v) ? 'Android ' + v : v.replace('Microsoft ', '')}{m.versoes.length > 1 ? ` (${n})` : ''}</div>)}</td>
                  <td className={`${td} whitespace-nowrap font-mono`}>{m.ramGB ? fmtNCel(m.ramGB) + ' GB' : '—'} · {m.armazenamentoGB ? m.armazenamentoGB + ' GB' : '—'}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtAnos(m.anosNoMDM)}</td>
                  <td className={`${td} font-mono`}>{fmtPctInt(m.sync24 * 100)}</td>
                  <td className={`${td} font-mono`}>{m.parados || '—'}</td>
                  <td className={`${td} font-mono`}>{fmtPctInt(m.armLivre)}</td>
                  <td className={`${td} font-mono`}>{fmtPctInt(m.ramLivre)}</td>
                  <td className={`${td} font-mono`}>{fmtPctInt(m.bateria)}</td>
                  <td className={td}>{situacaoModelo(m)}</td>
                  <td className={`${td} text-xs whitespace-nowrap`}>{m.grupos.slice(0, 3).map(([g, n]) => <div key={g}>{g} <span className="text-slate-500">{n}</span></div>)}{m.grupos.length > 3 && <div className="text-slate-500">+{m.grupos.length - 3} grupos</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Armazenamento, memória e bateria são medianas no momento da última sincronização. Tempo no MDM conta a partir da ativação no Pulsus. Clique em um modelo para ver os aparelhos dele.</p>
      </CelSecao>

      <CelSecao titulo="Versões do sistema" info={`${versoes.filter(v => v.situacao === 'fim').reduce((a, v) => a + v.qtd, 0)} em fim de ciclo · ${versoes.reduce((a, v) => a + v.podeAtualizar, 0)} com atualização pendente`}>
        <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-slate-400 text-left">
              {['Versão', 'Quantidade', 'Situação', 'Modelos', 'Sinc. 24h', 'Parados +7d', 'Pode atualizar'].map(h => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {versoes.map(v => (
                <tr key={v.nome} tabIndex={0} onClick={() => verAparelhos('todos', v.nome)} onKeyDown={e => e.key === 'Enter' && verAparelhos('todos', v.nome)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition cursor-pointer text-slate-300">
                  <td className={`${td} text-white font-medium whitespace-nowrap`}>{v.nome}</td>
                  <td className={td}><CelBarra qtd={v.qtd} max={maxVersao} pct={v.pct} cor={v.situacao === 'fim' ? 'bg-red-500' : 'bg-blue-500'} /></td>
                  <td className={td}><CelPill cls={CEL_SITUACAO_VERSAO[v.situacao][1]}>{CEL_SITUACAO_VERSAO[v.situacao][0]}</CelPill></td>
                  <td className={`${td} text-xs`}>{v.modelos.map(([m, n]) => `${m} (${n})`).join(' · ')}</td>
                  <td className={`${td} font-mono`}>{Math.round(v.sync24 * 100)}%</td>
                  <td className={`${td} font-mono`}>{v.parados || '—'}</td>
                  <td className={td}>{v.podeAtualizar ? <CelPill cls={CEL_STATUS_COLOR.warn}>{v.podeAtualizar}</CelPill> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Fim de ciclo: Android 12 ou anterior. “Pode atualizar” conta aparelhos abaixo da versão mais alta já vista no mesmo modelo. Clique em uma versão para ver os aparelhos.</p>
      </CelSecao>

      <div ref={listaRef} className="scroll-mt-4">
        <CelSecao titulo="Aparelhos" info={`${aparelhos.length} de ${doGrupo.length} aparelhos`}
          acoes={<div className="relative sm:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, ID, patrimônio, telefone, modelo" className="w-full bg-slate-900/60 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>}>
          <div className="flex flex-wrap gap-2">
            {CEL_FILTROS.map(([c, l]) => (
              <button key={c} onClick={() => setFiltro(c)} aria-pressed={filtro === c} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filtro === c ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:text-white'}`}>{l} ({contagem[c]})</button>
            ))}
          </div>
          <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-auto max-h-[620px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800"><tr className="border-b border-slate-700 text-slate-400 text-left">
                {['ID', 'Usuário', 'Grupo', 'Modelo', 'Android', 'Patrimônio', 'Nº Frota', 'Telefone', 'Chips', 'Últ. sync', 'Bateria', 'Problemas'].map(h => <th key={h} className={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {aparelhos.map(d => {
                  const ps = k.problemas[d.id] || [], nc = quantidadeChips(d);
                  return (
                    <tr key={d.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition text-slate-300 align-top">
                      <td className={`${td} font-mono`}>{d.id}</td>
                      <td className={`${td} text-white whitespace-nowrap`}>{d.nome || '(sem nome)'}</td>
                      <td className={`${td} whitespace-nowrap`}>{d.grupo}</td>
                      <td className={`${td} whitespace-nowrap`}>{nomeModelo(d)}</td>
                      <td className={`${td} font-mono`}>{d.os}</td>
                      <td className={`${td} font-mono`}>{d.pat || '—'}</td>
                      <td className={`${td} font-mono`}>{d.frota || '—'}</td>
                      <td className={`${td} font-mono whitespace-nowrap`}>{[...new Set([d.n1, d.n2, d.ts].filter(Boolean))].join(' / ') || d.t1 || '—'}</td>
                      <td className={`${td} whitespace-nowrap`}>{nc ? `${nc} · ${[d.oper1, d.oper2].filter(Boolean).map(o => o.replace(/ BR$/, '')).join(' + ') || '—'}` : '—'}</td>
                      <td className={`${td} whitespace-nowrap`}>{ultSync(d)}</td>
                      <td className={`${td} font-mono`}>{d.bat}%</td>
                      <td className={td}><div className="flex flex-wrap gap-1 min-w-[180px]">{ps.length ? ps.map((p, i) => <span key={i} className={`px-2 py-0.5 rounded text-xs ${CEL_PROB_COLOR[p.tipo]}`}>{p.texto}</span>) : <span className="text-slate-500">—</span>}</div></td>
                    </tr>
                  );
                })}
                {aparelhos.length === 0 && <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-500">Nenhum aparelho neste filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </CelSecao>
      </div>

      {formMetas}
    </div>
  );
}

/* ═══════════ APP ═══════════ */
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'assets', label: 'Ativos', icon: Monitor },
  { key: 'telecom', label: 'Linhas Móveis', icon: Smartphone },
  { key: 'celulares', label: 'Celulares', icon: TabletSmartphone },
  { key: 'licenses', label: 'Licencas', icon: FileKey },
  { key: 'contracts', label: 'Contratos', icon: Briefcase },
  { key: 'budget', label: 'Orcamento', icon: DollarSign },
  { key: 'inventories', label: 'Inventarios', icon: ClipboardCheck },
  { key: 'summary', label: 'Resumo', icon: Package },
  { key: 'knowledge', label: 'Guia & Governança', icon: BookOpen },
  { key: 'users', label: 'Usuários', icon: Users },
];
// Páginas restritas ao perfil admin (Celulares mostra nome, telefone e IMEI de funcionários)
const NAV_ADMIN = ['users', 'celulares'];

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

/* ═══════════ GUIA & GOVERNANÇA (KNOWLEDGE) ═══════════ */
function KnowledgePage() {
  const [activeSubTab, setActiveSubTab] = useState('itam');
  
  const sections = {
    itam: {
      title: 'Gestão de Ativos de Hardware (ITAM)',
      frameworks: ['ITIL v4 ITAM', 'COBIT 2019 (BAI09 - Manage Assets)', 'ISO/IEC 27001'],
      icon: Monitor,
      desc: 'Processo sistemático de gerenciamento do ciclo de vida físico e financeiro de dispositivos eletrônicos da empresa.',
      advantages: [
        { title: 'Controle de PC Refresh', text: 'Previsibilidade orçamentária sabendo exatamente quais computadores estão no fim de sua vida útil (ex: 60 meses).' },
        { title: 'Gestão de Depreciação', text: 'Cálculo automatizado do Valor Atual e Depreciação Acumulada, ideal para planejamento contábil e dedução tributária.' },
        { title: 'Rastreabilidade de Histórico', text: 'Auditoria completa de quem usou o dispositivo, por qual departamento passou e onde está localizado fisicamente.' },
        { title: 'Prevenção de Perdas', text: 'Vínculo rígido de termos de responsabilidade (gerados e armazenados) com assinaturas de recebimento dos portadores.' }
      ],
      utilization: 'Utilize para cadastrar notebooks, celulares, switches, servidores e monitores. Monitore o status (Em Manutenção, Inativo, Ativo) e registre manutenções corretivas ou preventivas.'
    },
    tem: {
      title: 'Telecom Expense Management (TEM)',
      frameworks: ['ITIL Financial Management', 'COBIT 2019 (APO06 - Budget)', 'ITIL Service Configuration'],
      icon: Smartphone,
      desc: 'Gestão de despesas e inventário de conectividade móvel (linhas telefônicas corporativas e SIM chips).',
      advantages: [
        { title: 'Detecção de Contas "Fantasma"', text: 'Identifique rapidamente chips ativos sem portador atribuído, cortando custos recorrentes imediatamente.' },
        { title: 'Auditoria de Fatura Automatizada', text: 'Importe faturas e cruze os valores cobrados com o inventário, anotando comentários rápidos de divergência na conciliação.' },
        { title: 'Sincronização MDM/Pulsus', text: 'Garante que cada linha telefônica móvel está vinculada a um smartphone cadastrado e sob o controle do MDM Pulsus.' }
      ],
      utilization: 'Utilize para inventariar linhas corporativas, gerenciar planos de dados contratados, rodar auditorias mensais de faturas da Vivo/Claro e monitorar de forma centralizada os gastos mensais de telecom.'
    },
    sam: {
      title: 'Software Asset Management (SAM)',
      frameworks: ['ISO/IEC 19770 (SAM)', 'ITIL SAM', 'ISO 27001 A.8'],
      icon: FileKey,
      desc: 'Boas práticas para controle, proteção e otimização das licenças e assinaturas de softwares corporativos (SaaS e On-Premises).',
      advantages: [
        { title: 'Mitigação de Risco de Auditoria', text: 'Evite multas milionárias de fabricantes (Microsoft, Adobe, SAP) detectando imediatamente o uso acima do limite licenciado.' },
        { title: 'Corte de Desperdício (Overlicensing)', text: 'Identifique assinaturas ativas sem atribuição a usuários e reduza despesas de licenças ociosas.' },
        { title: 'Gestão de Expirabilidade', text: 'Acompanhe datas de vigência de licenças SaaS e evite suspensão repentina de serviços essenciais.' }
      ],
      utilization: 'Registre licenças compradas, chaves de ativação, valores por assento e associe as licenças aos respectivos computadores/usuários para obter gráficos em tempo real de conformidade.'
    },
    governance: {
      title: 'Segurança, LGPD & Contratos',
      frameworks: ['LGPD (Lei Geral de Proteção de Dados)', 'ISO/IEC 27001', 'ITIL Contract & Supplier Management'],
      icon: Shield,
      desc: 'Garantia de conformidade legal, termos jurídicos assinados e processos de descarte ecológico seguro de ativos.',
      advantages: [
        { title: 'Sanitização de Mídias (Wiping)', text: 'Checklist obrigatório de higienização de discos rígidos em descartes, evitando vazamentos de segredos industriais ou dados pessoais (LGPD).' },
        { title: 'Governança Contratual e SLAs', text: 'Controle de vigência de contratos de provedores com alertas de vencimento em 60 dias e registros de metas de SLA.' },
        { title: 'Termo de Responsabilidade Seguro', text: 'Automatize a geração de documentos para assinatura física ou digital, vinculando de forma legal o ativo ao seu responsável.' }
      ],
      utilization: 'Utilize o módulo de Contratos para gerenciar parcerias, fornecedores de nuvem, link de internet e suporte técnico. Monitore o processo de pós-desativação ao inativar equipamentos antigos.'
    }
  };

  const active = sections[activeSubTab];
  const ActiveIcon = active.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Guia de Governança & Frameworks de TI</h1>
          <p className="text-slate-400 text-sm">Entenda os conceitos internacionais e as melhores práticas aplicadas nas telas do IT-Manager.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/50 overflow-x-auto gap-2">
        {Object.entries(sections).map(([key, sec]) => {
          const SecIcon = sec.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveSubTab(key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition shrink-0 ${
                activeSubTab === key
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <SecIcon size={16} />
              {sec.title.split(' (')[0]}
            </button>
          );
        })}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/20 rounded-xl text-blue-400"><ActiveIcon size={24} /></div>
              <div>
                <h2 className="text-xl font-bold text-white">{active.title}</h2>
                <p className="text-slate-400 text-sm">{active.desc}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/30">
              <h3 className="text-white font-semibold text-sm mb-3">Vantagens & Benefícios de Governança:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.advantages.map((adv, idx) => (
                  <div key={idx} className="bg-slate-900/40 p-4 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                    <p className="text-white font-semibold text-xs mb-1 flex items-center gap-1.5 text-blue-400">
                      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> {adv.title}
                    </p>
                    <p className="text-slate-400 text-xs leading-relaxed">{adv.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold text-sm mb-2">Como utilizar operacionalmente no sistema:</h3>
            <p className="text-slate-300 text-xs leading-relaxed bg-slate-900/30 p-4 border border-slate-800 rounded-lg">{active.utilization}</p>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-900/20 to-slate-800/40 border border-blue-500/20 rounded-xl p-6 space-y-4">
            <h3 className="text-blue-400 font-bold text-sm flex items-center gap-1.5"><Shield size={16} /> Conformidade & Metodologias</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              O IT-Manager foi projetado com alinhamento rigoroso a frameworks internacionais. Este módulo está em conformidade com:
            </p>
            <div className="space-y-2 pt-2">
              {active.frameworks.map((fw, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-900/60 px-3 py-2 border border-slate-800 rounded-lg text-white text-xs font-medium">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  {fw}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold text-sm">Status de Governança</h3>
            <div className="text-slate-400 text-xs space-y-2 leading-relaxed">
              <p>🎯 **Foco**: Otimização Financeira, Gestão de Riscos, Rastreabilidade.</p>
              <p>🔒 **Segurança**: Auditorias em conformidade com as seções A.8 da **ISO 27001**.</p>
              <p>📄 **Legal**: Guarda legal e proteção de termos em consonância com a **LGPD**.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ CONTRACTS & SLA MANAGEMENT ═══════════ */
function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState({ name: '', vendor_id: '', contract_number: '', start_date: '', end_date: '', monthly_cost: '', sla_details: '', document_url: '', status: 'Ativo', notes: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', vendor_id: '', contract_number: '', start_date: '', end_date: '', monthly_cost: '', sla_details: '', document_url: '', status: 'Ativo', notes: '' });

  const load = () => {
    setLoading(true);
    api.listContracts().then(setContracts).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.vendors().then(setVendors).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      await api.createContract({ ...form, monthly_cost: Number(form.monthly_cost) || 0 });
      setShowModal(false);
      setForm({ name: '', vendor_id: '', contract_number: '', start_date: '', end_date: '', monthly_cost: '', sla_details: '', document_url: '', status: 'Ativo', notes: '' });
      load();
    } catch (err) {
      alert("Erro ao criar contrato: " + err.message);
    }
  };

  const handleOpenEdit = (c) => {
    setEditForm({
      id: c.id,
      name: c.name || '',
      vendor_id: c.vendor_id || '',
      contract_number: c.contract_number || '',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      monthly_cost: c.monthly_cost || 0,
      sla_details: c.sla_details || '',
      document_url: c.document_url || '',
      status: c.status || 'Ativo',
      notes: c.notes || ''
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    try {
      await api.updateContract(editForm.id, { ...editForm, monthly_cost: Number(editForm.monthly_cost) || 0 });
      setShowEditModal(false);
      load();
    } catch (err) {
      alert("Erro ao atualizar contrato: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deseja realmente remover este contrato?")) return;
    try {
      await api.deleteContract(id);
      load();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const getDaysLeft = (endDateStr) => {
    if (!endDateStr) return null;
    const diff = new Date(endDateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const expiringContracts = contracts.filter(c => {
    if (c.status !== 'Ativo') return false;
    const days = getDaysLeft(c.end_date);
    return days !== null && days <= 60 && days >= 0;
  });

  return (
    <div className="space-y-6">
      {/* Expirability alert banner */}
      {expiringContracts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-amber-400 font-bold text-sm">Alerta de Expirabilidade de Contratos</h3>
            <p className="text-slate-300 text-xs leading-relaxed mt-1">
              Os seguintes contratos vencem em menos de **60 dias** e requerem renovação ou negociação de SLA:
            </p>
            <ul className="list-disc pl-4 mt-2 text-xs text-slate-400 space-y-1">
              {expiringContracts.map(c => {
                const days = getDaysLeft(c.end_date);
                return (
                  <li key={c.id}>
                    <span className="text-white font-medium">{c.name}</span> (nº {c.contract_number}) - Vence em{' '}
                    <span className="text-amber-400 font-bold">{days} dias</span> ({fmtDate(c.end_date)})
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contratos & SLAs de Fornecedores</h1>
          <p className="text-slate-400 text-sm">Gerenciamento centralizado de contratos de TI, licenças SaaS, links e serviços com fornecedores.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shrink-0">
          <Plus size={18} /> Adicionar Contrato
        </button>
      </div>

      {loading ? <Loading /> : (
        <div className="bg-slate-800/50 rounded-xl ring-1 ring-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Contrato</th>
                  <th className="px-4 py-3 font-medium">Nº Contrato</th>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Custo Mensal</th>
                  <th className="px-4 py-3 font-medium">Vigência</th>
                  <th className="px-4 py-3 font-medium">Situação / Expirabilidade</th>
                  <th className="px-4 py-3 font-medium">Doc</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => {
                  const days = getDaysLeft(c.end_date);
                  let expBadge = null;
                  if (c.status === 'Ativo') {
                    if (days !== null) {
                      if (days < 0) {
                        expBadge = <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[10px]">Vencido</span>;
                      } else if (days <= 60) {
                        expBadge = <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px]">Faltam {days} dias</span>;
                      } else {
                        expBadge = <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">Regular</span>;
                      }
                    }
                  } else {
                    expBadge = <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-400 text-[10px]">Inativo</span>;
                  }

                  return (
                    <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{c.name}</p>
                          <p className="text-slate-500 text-xs max-w-xs truncate">{c.sla_details || 'Sem especificações de SLA'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{c.contract_number || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">{c.vendor_name || '-'}</td>
                      <td className="px-4 py-3 text-slate-300 font-medium">{fmt(c.monthly_cost)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {fmtDate(c.start_date)} até {fmtDate(c.end_date)}
                      </td>
                      <td className="px-4 py-3">{expBadge}</td>
                      <td className="px-4 py-3">
                        {c.document_url ? (
                          <a href={c.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition" title="Visualizar Contrato Anexo">
                            <FileText size={14} /> PDF/Doc
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs">Sem anexo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        <button onClick={() => handleOpenEdit(c)} title="Editar" className="text-slate-500 hover:text-amber-400 transition"><Edit3 size={16} /></button>
                        <button onClick={() => handleDelete(c.id)} title="Excluir" className="text-slate-500 hover:text-red-400 transition"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {contracts.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Nenhum contrato cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Contrato">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nome do Contrato *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Licenciamento Microsoft Enterprise Agreement" />
          <Input label="Número do Contrato" value={form.contract_number} onChange={e => setForm({ ...form, contract_number: e.target.value })} placeholder="Ex: CT-2026-987" />
          <label className="block mb-3">
            <span className="text-sm text-slate-400 mb-1 block">Fornecedor *</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })}>
              <option value="">Selecione</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <Input label="Custo Mensal (R$)" type="number" value={form.monthly_cost} onChange={e => setForm({ ...form, monthly_cost: e.target.value })} placeholder="Ex: 12500" />
          <Input label="Data Inicial" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          <Input label="Data Final" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          <Select label="Status" options={['Ativo', 'Inativo']} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} />
          <div className="col-span-2">
            <TextArea label="Especificações de SLA / Metas" value={form.sla_details} onChange={e => setForm({ ...form, sla_details: e.target.value })} placeholder="Ex: Disponibilidade de links 99.9%, tempo de resposta de 4 horas para incidentes críticos." />
          </div>
          <div className="col-span-2">
            <TextArea label="Observações / Notas" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ex: Aditivo firmado em maio para acréscimo de banda." />
          </div>
          <div className="col-span-2">
            <ImageUpload label="Anexar Cópia do Contrato (PDF ou Imagem)" value={form.document_url} onChange={val => setForm({ ...form, document_url: val })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!form.name} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Criar Contrato</button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Contrato">
        <div className="grid grid-cols-2 gap-x-3">
          <Input label="Nome do Contrato *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Número do Contrato" value={editForm.contract_number} onChange={e => setEditForm({ ...editForm, contract_number: e.target.value })} />
          <label className="block mb-3">
            <span className="text-sm text-slate-400 mb-1 block">Fornecedor *</span>
            <select className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={editForm.vendor_id} onChange={e => setEditForm({ ...editForm, vendor_id: e.target.value })}>
              <option value="">Selecione</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <Input label="Custo Mensal (R$)" type="number" value={editForm.monthly_cost} onChange={e => setEditForm({ ...editForm, monthly_cost: e.target.value })} />
          <Input label="Data Inicial" type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} />
          <Input label="Data Final" type="date" value={editForm.end_date} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} />
          <Select label="Status" options={['Ativo', 'Inativo']} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} />
          <div className="col-span-2">
            <TextArea label="Especificações de SLA / Metas" value={editForm.sla_details} onChange={e => setEditForm({ ...editForm, sla_details: e.target.value })} />
          </div>
          <div className="col-span-2">
            <TextArea label="Observações / Notas" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <div className="col-span-2">
            <ImageUpload label="Anexar Cópia do Contrato (PDF ou Imagem)" value={editForm.document_url} onChange={val => setEditForm({ ...editForm, document_url: val })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancelar</button>
          <button onClick={handleEditSave} disabled={!editForm.name} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition">Salvar Alterações</button>
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
  const [expiringContractsAlert, setExpiringContractsAlert] = useState([]);
  const [showExpiringModal, setShowExpiringModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('it_manager_token');
    if (token) {
      api.me().then(setUser).catch(() => localStorage.removeItem('it_manager_token')).finally(() => setAuthLoading(false));
    } else { setAuthLoading(false); }
  }, []);

  useEffect(() => {
    if (user) {
      api.listContracts().then(data => {
        const expiring = data.filter(c => {
          if (c.status !== 'Ativo') return false;
          if (!c.end_date) return false;
          const diff = new Date(c.end_date) - new Date();
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          return days <= 60 && days >= 0;
        });
        if (expiring.length > 0) {
          setExpiringContractsAlert(expiring);
          setShowExpiringModal(true);
        }
      }).catch(() => {});
    }
  }, [user]);

  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div></div>;
  if (!user) return <Login onLogin={setUser} />;

  const handleLogout = () => { if (window.confirm("Deseja sair do sistema?")) { localStorage.removeItem('it_manager_token'); setUser(null); } };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'assets': return <Assets user={user} />;
      case 'telecom': return <TelecomPage user={user} />;
      case 'celulares': return user && user.role === 'admin' ? <CelularesPage /> : <Dashboard />;
      case 'licenses': return <Licenses user={user} />;
      case 'contracts': return <ContractsPage />;
      case 'budget': return <Budget />;
      case 'inventories': return <Inventories />;
      case 'summary': return <InventorySummary />;
      case 'knowledge': return <KnowledgePage />;
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
          {NAV.filter(item => !NAV_ADMIN.includes(item.key) || (user && user.role === 'admin')).map(({ key, label, icon: Icon }) => (
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

      {/* Modal de Alerta de Vencimento de Contratos */}
      <Modal open={showExpiringModal} onClose={() => setShowExpiringModal(false)} title="Alerta de Vencimento de Contrato">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle size={24} />
            <h3 className="font-bold text-base">Contratos Próximos do Vencimento!</h3>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Detectamos contratos vigentes ativos com vencimento programado para os **próximos 60 dias**. Por favor, revise as condições de renovação e SLAs:
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pt-2">
            {expiringContractsAlert.map(c => {
              const diff = new Date(c.end_date) - new Date();
              const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
              return (
                <div key={c.id} className="bg-slate-900/60 p-3 border border-slate-800 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-white font-semibold text-xs">{c.name}</h4>
                    <p className="text-slate-500 text-[10px]">Contrato nº {c.contract_number || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold text-xs">Faltam {days} dias</p>
                    <p className="text-slate-400 text-[9px]">{fmtDate(c.end_date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => { setShowExpiringModal(false); setPage('contracts'); }} className="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium transition">Revisar Contratos</button>
          <button onClick={() => setShowExpiringModal(false)} className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white transition">Fechar</button>
        </div>
      </Modal>
    </div>
  );
}
