from flask import Flask, request, jsonify, g, send_from_directory, abort
from functools import wraps
import sqlite3, os, json, uuid, csv, io, hashlib
from datetime import datetime
from flask_cors import CORS

# Detecta pasta do frontend buildado (../frontend/dist)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
CORS(app)
DATABASE = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "it_manager.db"))
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", 5000))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None: db.close()

def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = [dict(row) for row in cur.fetchall()]
    cur.close()
    return (rv[0] if rv else None) if one else rv

def execute_db(query, args=()):
    db = get_db()
    cur = db.execute(query, args)
    db.commit()
    return cur.lastrowid

def gen_id(): return uuid.uuid4().hex[:12]

def log_asset_history(asset_id, action, from_val=None, to_val=None, performed_by=None, notes=None):
    execute_db("INSERT INTO asset_history(id,asset_id,action,from_value,to_value,performed_by,notes) VALUES(?,?,?,?,?,?,?)",
               (gen_id(), asset_id, action, from_val, to_val, performed_by, notes))

def log_line_history(line_id, action, from_val=None, to_val=None, performed_by=None, notes=None):
    execute_db("INSERT INTO mobile_lines_history(id,mobile_line_id,action,from_value,to_value,performed_by,notes) VALUES(?,?,?,?,?,?,?)",
               (gen_id(), line_id, action, from_val, to_val, performed_by, notes))

def log_license_history(license_id, action, from_val=None, to_val=None, performed_by=None, notes=None):
    execute_db("INSERT INTO licenses_history(id,license_id,action,from_value,to_value,performed_by,notes) VALUES(?,?,?,?,?,?,?)",
               (gen_id(), license_id, action, from_val, to_val, performed_by, notes))

def init_db():
    db = sqlite3.connect(DATABASE)
    db.executescript("""
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, manager TEXT, cost_center TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS vendors (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, email TEXT, phone TEXT, website TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, serial_number TEXT UNIQUE, asset_tag TEXT UNIQUE, brand TEXT, model TEXT, specifications TEXT, purchase_date TEXT, warranty_end TEXT, cost REAL DEFAULT 0, residual_value REAL DEFAULT 0, useful_life_months INTEGER DEFAULT 60, status TEXT DEFAULT 'Ativo', condition TEXT DEFAULT 'Bom', assigned_to TEXT, department_id TEXT REFERENCES departments(id), location TEXT, vendor_id TEXT REFERENCES vendors(id), notes TEXT, image_url TEXT, pulsus_number TEXT, deactivation_wiped INTEGER DEFAULT 0, deactivation_eco_recycle INTEGER DEFAULT 0, deactivation_document_url TEXT, deactivation_notes TEXT, responsibility_term_url TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, name TEXT NOT NULL, vendor_id TEXT REFERENCES vendors(id), vendor_name TEXT, license_type TEXT DEFAULT 'Assinatura', category TEXT, license_key TEXT, total_seats INTEGER DEFAULT 1, used_seats INTEGER DEFAULT 0, cost_per_seat REAL DEFAULT 0, total_cost REAL DEFAULT 0, billing_cycle TEXT DEFAULT 'Mensal', start_date TEXT, end_date TEXT, auto_renew INTEGER DEFAULT 0, status TEXT DEFAULT 'Ativa', compliance_notes TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS asset_licenses (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE, assigned_at TEXT DEFAULT (datetime('now')), UNIQUE(asset_id, license_id));
    CREATE TABLE IF NOT EXISTS budget (id TEXT PRIMARY KEY, year INTEGER NOT NULL, month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12), category TEXT NOT NULL, planned REAL DEFAULT 0, actual REAL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(year, month, category));
    CREATE TABLE IF NOT EXISTS asset_history (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, action TEXT NOT NULL, from_value TEXT, to_value TEXT, performed_by TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS maintenance (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, type TEXT, description TEXT, vendor TEXT, cost REAL DEFAULT 0, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'Aberta', notes TEXT, image_url TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS inventories (id TEXT PRIMARY KEY, name TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, status TEXT DEFAULT 'Aberto', responsible TEXT, notes TEXT, started_at TEXT DEFAULT (datetime('now')), closed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY, inventory_id TEXT NOT NULL REFERENCES inventories(id) ON DELETE CASCADE, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, status TEXT DEFAULT 'Pendente', checked_by TEXT, checked_at TEXT, location_found TEXT, condition_found TEXT, notes TEXT, image_url TEXT, UNIQUE(inventory_id, asset_id));
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'admin', token TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS mobile_lines (id TEXT PRIMARY KEY, phone_number TEXT UNIQUE NOT NULL, sim_card TEXT UNIQUE, assigned_to TEXT, department_id TEXT REFERENCES departments(id), asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL, plan_name TEXT, monthly_cost REAL DEFAULT 0, status TEXT DEFAULT 'Ativo', notes TEXT, audit_interval_days INTEGER DEFAULT 90, last_audited_at TEXT, pulsus_number TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS telecom_audits (id TEXT PRIMARY KEY, title TEXT NOT NULL, month INTEGER NOT NULL, year INTEGER NOT NULL, status TEXT DEFAULT 'Aberto', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS telecom_audit_items (id TEXT PRIMARY KEY, audit_id TEXT REFERENCES telecom_audits(id) ON DELETE CASCADE, mobile_line_id TEXT REFERENCES mobile_lines(id) ON DELETE CASCADE, original_user TEXT, confirmed_user TEXT, is_confirmed INTEGER DEFAULT 0, notes TEXT, updated_at TEXT DEFAULT (datetime('now')), UNIQUE(audit_id, mobile_line_id));
    CREATE TABLE IF NOT EXISTS mobile_lines_history (id TEXT PRIMARY KEY, mobile_line_id TEXT NOT NULL REFERENCES mobile_lines(id) ON DELETE CASCADE, action TEXT NOT NULL, from_value TEXT, to_value TEXT, performed_by TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_a_cat ON assets(category);
    CREATE INDEX IF NOT EXISTS idx_a_st ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_a_dept ON assets(department_id);
    CREATE INDEX IF NOT EXISTS idx_l_st ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_l_end ON licenses(end_date);
    CREATE INDEX IF NOT EXISTS idx_b_ym ON budget(year, month);
    CREATE INDEX IF NOT EXISTS idx_ah_asset ON asset_history(asset_id);
    CREATE INDEX IF NOT EXISTS idx_inv_ym ON inventories(year, month);
    CREATE INDEX IF NOT EXISTS idx_invi_inv ON inventory_items(inventory_id);
    CREATE INDEX IF NOT EXISTS idx_ml_num ON mobile_lines(phone_number);
    CREATE INDEX IF NOT EXISTS idx_ta_ym ON telecom_audits(year, month);
    CREATE INDEX IF NOT EXISTS idx_tai_aud ON telecom_audit_items(audit_id);
    CREATE INDEX IF NOT EXISTS idx_mlh_line ON mobile_lines_history(mobile_line_id);
    CREATE TABLE IF NOT EXISTS licenses_history (id TEXT PRIMARY KEY, license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE, action TEXT NOT NULL, from_value TEXT, to_value TEXT, performed_by TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_lh_license ON licenses_history(license_id);
    CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, name TEXT NOT NULL, vendor_id TEXT REFERENCES vendors(id), contract_number TEXT, start_date TEXT, end_date TEXT, monthly_cost REAL DEFAULT 0, sla_details TEXT, document_url TEXT, status TEXT DEFAULT 'Ativo', notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_c_end ON contracts(end_date);
    CREATE TABLE IF NOT EXISTS celulares_relatorio (id INTEGER PRIMARY KEY CHECK(id = 1), base TEXT NOT NULL, arquivo TEXT, importado_por TEXT, importado_em TEXT DEFAULT (datetime('now')), dispositivos TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS celulares_metas (chave TEXT PRIMARY KEY, meta REAL, atualizado_em TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS metas_mensais (id TEXT PRIMARY KEY, assunto TEXT NOT NULL, chave TEXT NOT NULL, rotulo TEXT NOT NULL, tipo TEXT NOT NULL, direcao TEXT NOT NULL, ordem INTEGER DEFAULT 0, ano INTEGER NOT NULL, mes INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12), valor REAL, meta REAL, fechado_por TEXT, fechado_em TEXT DEFAULT (datetime('now')), UNIQUE(assunto, chave, ano, mes));
    CREATE INDEX IF NOT EXISTS idx_mm_ano ON metas_mensais(ano);
    CREATE TABLE IF NOT EXISTS celulares_importacoes (id TEXT PRIMARY KEY, base TEXT NOT NULL, arquivo TEXT, importado_por TEXT, importado_em TEXT DEFAULT (datetime('now')), aparelhos INTEGER DEFAULT 0, dispositivos TEXT NOT NULL, indicadores TEXT);
    CREATE INDEX IF NOT EXISTS idx_ci_base ON celulares_importacoes(base);
    CREATE TABLE IF NOT EXISTS computadores_arquivos (tipo TEXT PRIMARY KEY CHECK(tipo IN ('ocs','ad_computadores','ad_usuarios')), base TEXT, arquivo TEXT, importado_por TEXT, importado_em TEXT DEFAULT (datetime('now')), dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS computadores_metas (chave TEXT PRIMARY KEY, meta REAL, atualizado_em TEXT DEFAULT (datetime('now')));
    """)
    # Migracao simples para bases existentes
    try:
        db.execute("ALTER TABLE assets ADD COLUMN image_url TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE assets ADD COLUMN pulsus_number TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE assets ADD COLUMN deactivation_wiped INTEGER DEFAULT 0")
    except: pass
    try:
        db.execute("ALTER TABLE assets ADD COLUMN deactivation_eco_recycle INTEGER DEFAULT 0")
    except: pass
    try:
        db.execute("ALTER TABLE assets ADD COLUMN deactivation_document_url TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE assets ADD COLUMN deactivation_notes TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE assets ADD COLUMN responsibility_term_url TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE maintenance ADD COLUMN image_url TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE inventory_items ADD COLUMN image_url TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE mobile_lines ADD COLUMN audit_interval_days INTEGER DEFAULT 90")
    except: pass
    try:
        db.execute("ALTER TABLE mobile_lines ADD COLUMN last_audited_at TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE mobile_lines ADD COLUMN pulsus_number TEXT")
    except: pass
    try:
        db.execute("CREATE TABLE IF NOT EXISTS licenses_history (id TEXT PRIMARY KEY, license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE, action TEXT NOT NULL, from_value TEXT, to_value TEXT, performed_by TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')))")
        db.execute("CREATE INDEX IF NOT EXISTS idx_lh_license ON licenses_history(license_id)")
    except: pass
    try:
        db.execute("ALTER TABLE metas_mensais ADD COLUMN referencia TEXT")
    except: pass
    # O relatorio unico antigo (celulares_relatorio) vira a primeira importacao do historico.
    # Os indicadores dele sao calculados pela pagina Celulares na primeira abertura.
    if not db.execute("SELECT 1 FROM celulares_importacoes LIMIT 1").fetchone():
        old = db.execute("SELECT base, arquivo, importado_por, importado_em, dispositivos FROM celulares_relatorio WHERE id=1").fetchone()
        if old:
            db.execute("INSERT INTO celulares_importacoes(id, base, arquivo, importado_por, importado_em, aparelhos, dispositivos) VALUES(?,?,?,?,?,?,?)",
                       (gen_id(), old[0], old[1], old[2], old[3], len(json.loads(old[4])), old[4]))

    # Garante usuário admin padrao admin/admin
    pwd_hash = hashlib.sha256("admin".encode()).hexdigest()
    db.execute("INSERT OR IGNORE INTO users(id,username,password,role) VALUES(?,?,?,?)", (gen_id(), "admin", pwd_hash, "admin"))

    db.commit(); db.close()
    print("DB inicializado!")

def seed_db():
    db = sqlite3.connect(DATABASE)
    if db.execute("SELECT COUNT(*) FROM assets").fetchone()[0] > 0: db.close(); return
    year = datetime.now().year
    db.executemany("INSERT INTO departments(id,name,manager,cost_center) VALUES(?,?,?,?)", [
        ("dept_ti","TI","Rafael Souza","CC-100"),
        ("dept_rh","RH","Juliana Alves","CC-200"),
        ("dept_fin","Financeiro","Marcos Pereira","CC-300"),
        ("dept_com","Comercial","Ana Costa","CC-400"),
        ("dept_mkt","Marketing","Maria Santos","CC-500"),
        ("dept_dir","Diretoria","Carlos Mendes","CC-700"),
        ("dept_armazem","Armazém","Gerente de Armazém","CC-800"),
        ("dept_distribuicao","Distribuição","Gerente de Distribuição","CC-900"),
        ("dept_apoio_log","Apoio Logístico","Gerente de Apoio Logístico","CC-1000"),
        ("dept_gente","Gente","Gerente de Gente","CC-1100")
    ])
    db.executemany("INSERT INTO vendors(id,name,contact,email,phone,website,notes) VALUES(?,?,?,?,?,?,?)", [("vnd_dell","Dell","Suporte","suporte@dell.com","0800-970-3355","dell.com.br",""),("vnd_apple","Apple","Vendas","corp@apple.com","","apple.com/br",""),("vnd_lenovo","Lenovo","Suporte","suporte@lenovo.com","0800-536-6861","lenovo.com",""),("vnd_ms","Microsoft","Licensing","lic@microsoft.com","","microsoft.com",""),("vnd_hp","HP","Suporte","suporte@hp.com","0800-709-7751","hp.com.br","")])

    asset_ids = [gen_id() for _ in range(8)]
    db.executemany("INSERT INTO assets(id,name,category,serial_number,asset_tag,brand,model,specifications,purchase_date,warranty_end,cost,residual_value,useful_life_months,status,condition,assigned_to,department_id,location,vendor_id,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
        (asset_ids[0],"Dell Optiplex 7090","Computador","DL-7090-001","PAT-001","Dell","Optiplex 7090","{}","2024-03-15","2027-03-15",5200,0,60,"Ativo","Bom","Joao Silva","dept_ti","Sala TI","vnd_dell","Desktop principal"),
        (asset_ids[1],"MacBook Pro 14","Notebook","AP-MBP-002","PAT-002","Apple","MacBook Pro M3","{}","2024-06-20","2026-06-20",18500,0,48,"Ativo","Novo","Maria Santos","dept_mkt","Home Office","vnd_apple",""),
        (asset_ids[2],"iPhone 15 Pro","Celular","AP-IP15-003","PAT-003","Apple","iPhone 15 Pro","{}","2024-09-01","2025-09-01",8999,0,36,"Ativo","Novo","Carlos Mendes","dept_dir","","vnd_apple","Linha corporativa"),
        (asset_ids[3],"Dell UltraSharp 27","Monitor","DL-U27-004","PAT-004","Dell","U2723QE","{}","2023-11-10","2026-11-10",3200,0,60,"Ativo","Bom","Joao Silva","dept_ti","Sala TI","vnd_dell","4K"),
        (asset_ids[4],"Galaxy A54","Celular","SS-A54-005","PAT-005","Samsung","Galaxy A54","{}","2024-01-15","2025-01-15",2499,0,36,"Em Manutencao","Ruim","Ana Costa","dept_com","Assistencia","vnd_dell","Tela trincada"),
        (asset_ids[5],"ThinkPad T14","Notebook","LN-T14-006","PAT-006","Lenovo","ThinkPad T14","{}","2024-04-10","2027-04-10",7800,0,48,"Ativo","Bom","Pedro Lima","dept_fin","3 andar","vnd_lenovo","32GB RAM"),
        (asset_ids[6],"HP LaserJet Pro","Impressora","HP-LJ-007","PAT-007","HP","LaserJet M404dn","{}","2023-08-05","2025-08-05",2100,0,60,"Ativo","Bom","Sala TI","dept_ti","Copa TI","vnd_hp","Rede"),
        (asset_ids[7],"PowerEdge R750","Servidor","DL-PE-008","PAT-008","Dell","PowerEdge R750xs","{}","2023-06-01","2028-06-01",45000,5000,60,"Ativo","Bom","Datacenter","dept_ti","Rack A-01","vnd_dell","Servidor app"),
    ])

    # Seed historico de exemplo
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    history_data = [
        (gen_id(), asset_ids[0], "Cadastro", None, "Ativo", "Sistema", "Ativo cadastrado no sistema", "2024-03-15 09:00:00"),
        (gen_id(), asset_ids[4], "Cadastro", None, "Ativo", "Sistema", "Ativo cadastrado no sistema", "2024-01-15 10:00:00"),
        (gen_id(), asset_ids[4], "Mudanca de Status", "Ativo", "Em Manutencao", "Rafael Souza", "Tela trincada - enviado para assistencia", "2024-11-20 14:30:00"),
        (gen_id(), asset_ids[1], "Cadastro", None, "Ativo", "Sistema", "Ativo cadastrado no sistema", "2024-06-20 08:00:00"),
        (gen_id(), asset_ids[1], "Comentario", None, None, "Maria Santos", "Equipamento em perfeito estado, excelente performance para design", "2024-08-10 11:00:00"),
        (gen_id(), asset_ids[7], "Cadastro", None, "Ativo", "Sistema", "Ativo cadastrado no sistema", "2023-06-01 09:00:00"),
        (gen_id(), asset_ids[7], "Comentario", None, None, "Rafael Souza", "Upgrade de memoria para 128GB realizado", "2024-02-15 16:00:00"),
        (gen_id(), asset_ids[7], "Comentario", None, None, "Rafael Souza", "Backup configurado no schedule semanal", "2024-05-10 10:00:00"),
    ]
    db.executemany("INSERT INTO asset_history(id,asset_id,action,from_value,to_value,performed_by,notes,created_at) VALUES(?,?,?,?,?,?,?,?)", history_data)

    # Seed manutencao de exemplo
    maint_data = [
        (gen_id(), asset_ids[4], "Corretiva", "Troca de tela - display trincado", "Assistencia Samsung", 450, "2024-11-20", None, "Aberta", "Enviado para assistencia autorizada"),
        (gen_id(), asset_ids[6], "Preventiva", "Limpeza e troca de toner", "TI Interno", 180, "2024-09-01", "2024-09-01", "Concluida", "Manutencao trimestral"),
    ]
    db.executemany("INSERT INTO maintenance(id,asset_id,type,description,vendor,cost,start_date,end_date,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?)", maint_data)

    db.executemany("INSERT INTO licenses(id,name,vendor_id,vendor_name,license_type,category,license_key,total_seats,used_seats,cost_per_seat,total_cost,billing_cycle,start_date,end_date,auto_renew,status,compliance_notes,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
        (gen_id(),"Microsoft 365","vnd_ms","Microsoft","Assinatura","Produtividade","",50,42,75,3750,"Mensal","2024-01-01","2025-01-01",1,"Expirando","","Business Premium"),
        (gen_id(),"Adobe Creative Cloud","","Adobe","Assinatura","Design","",10,8,290,2900,"Mensal","2024-06-01","2025-06-01",1,"Ativa","","All Apps"),
        (gen_id(),"Slack Business+","","Salesforce","Assinatura","Comunicacao","",50,47,62,3100,"Mensal","2024-03-01","2025-03-01",0,"Ativa","",""),
        (gen_id(),"Windows 11 Pro","vnd_ms","Microsoft","OEM","SO","",30,30,0,21000,"Unica","2023-01-01","",0,"Ativa","OEM","Volume licensing"),
        (gen_id(),"Jira Cloud","","Atlassian","SaaS","Gestao","",25,22,38,950,"Mensal","2024-04-01","2025-04-01",1,"Ativa","","Premium"),
        (gen_id(),"Kaspersky Endpoint","","Kaspersky","Assinatura","Seguranca","",60,55,25,1500,"Anual","2024-02-01","2025-02-01",0,"Expirando","",""),
    ])
    bdata = []
    plan = {"Hardware":[25000,10000,15000,20000,12000,30000],"Licencas":[15000,15000,15000,15000,18000,15000],"Infraestrutura":[8000,8000,12000,8000,10000,15000]}
    apct = [0.89,0.87,1.12,0.925,0.93,0]
    for cat, vals in plan.items():
        for mi, pl in enumerate(vals):
            ac = round(pl * apct[mi]) if apct[mi] > 0 else 0
            bdata.append((gen_id(), year, mi+1, cat, pl, ac, ""))
    db.executemany("INSERT INTO budget(id,year,month,category,planned,actual,notes) VALUES(?,?,?,?,?,?,?)", bdata)
    db.commit(); db.close()
    print("Dados inseridos!")

def normalize_phone(num):
    if not num: return ""
    cleared = "".join(filter(str.isdigit, str(num)))
    while True:
        if cleared.startswith("0") and len(cleared) > 1:
            cleared = cleared[1:]
            continue
        if cleared.startswith("55") and len(cleared) >= 12:
            cleared = cleared[2:]
            continue
        break
    return cleared

def success(data=None, message="OK", st=200): return jsonify({"success":True,"message":message,"data":data}), st
def error(message, st=400): return jsonify({"success":False,"message":message,"data":None}), st

def calc_dep(cost, res, life, pdate):
    if not pdate or life <= 0: return {"current_value":cost}
    p = datetime.strptime(pdate, "%Y-%m-%d")
    m = (datetime.now().year-p.year)*12+(datetime.now().month-p.month)
    mo = (cost-res)/life if life>0 else 0
    td = min(mo*m, cost-res)
    return {"current_value":round(max(cost-td,res),2),"monthly":round(mo,2),"pct":round(td/(cost-res)*100,1) if (cost-res)>0 else 0}

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token: return error("Nao autorizado", 401)
        user = query_db("SELECT id, username, role FROM users WHERE token=?", [token], one=True)
        if not user: return error("Sessao expirada ou invalida", 401)
        g.user = user
        return f(*args, **kwargs)
    return decorated

@app.route("/api/auth/login", methods=["POST"])
def login():
    d = request.json
    u = d.get("username"); p = d.get("password")
    if not u or not p: return error("Usuario e senha sao obrigatorios")
    pwd_hash = hashlib.sha256(p.encode()).hexdigest()
    user = query_db("SELECT * FROM users WHERE username=? AND password=?", (u, pwd_hash), one=True)
    if not user: return error("Usuario ou senha invalidos", 401)
    
    token = uuid.uuid4().hex
    execute_db("UPDATE users SET token=? WHERE id=?", (token, user["id"]))
    return success({"token": token, "username": user["username"], "role": user["role"]}, "Login realizado")

@app.route("/api/auth/me")
@auth_required
def me():
    return success(g.user)

@app.route("/api/auth/logout", methods=["POST"])
@auth_required
def logout():
    execute_db("UPDATE users SET token=NULL WHERE id=?", [g.user["id"]])
    return success(message="Logout realizado")

# ─────────── DASHBOARD ───────────

@app.route("/api/dashboard")
@auth_required
def dashboard():
    ac=query_db("SELECT COUNT(*) as c FROM assets",one=True)["c"]
    active=query_db("SELECT COUNT(*) as c FROM assets WHERE status='Ativo'",one=True)["c"]
    tv=query_db("SELECT COALESCE(SUM(cost),0) as v FROM assets",one=True)["v"]
    lc=query_db("SELECT COUNT(*) as c FROM licenses",one=True)["c"]
    exp=query_db("SELECT COUNT(*) as c FROM licenses WHERE status='Expirando'",one=True)["c"]
    yr=datetime.now().year
    bp=query_db("SELECT COALESCE(SUM(planned),0) as v FROM budget WHERE year=?",[yr],one=True)["v"]
    ba=query_db("SELECT COALESCE(SUM(actual),0) as v FROM budget WHERE year=?",[yr],one=True)["v"]
    by_cat=query_db("SELECT category,COUNT(*) as count,SUM(cost) as total_cost FROM assets GROUP BY category")
    by_st=query_db("SELECT status,COUNT(*) as count FROM assets GROUP BY status")
    by_dept=query_db("SELECT COALESCE(d.name, 'Sem Departamento') as department, COUNT(*) as count FROM assets a LEFT JOIN departments d ON a.department_id=d.id GROUP BY a.department_id ORDER BY count DESC")
    return success({"kpis":{"total_assets":ac,"active":active,"value":tv,"licenses":lc,"expiring":exp,"budget_planned":bp,"budget_actual":ba},"charts":{"by_category":by_cat,"by_status":by_st,"by_department":by_dept}})

# ─────────── ASSETS ───────────
@app.route("/api/assets",methods=["GET"])
@auth_required
def list_assets():
    s=request.args.get("search",""); cat=request.args.get("category",""); st=request.args.get("status","")
    q="SELECT a.*,d.name as dept FROM assets a LEFT JOIN departments d ON a.department_id=d.id WHERE 1=1"; p=[]
    if s: q+=" AND (a.name LIKE ? OR a.serial_number LIKE ? OR a.brand LIKE ? OR a.pulsus_number LIKE ?)"; w="%"+s+"%"; p.extend([w]*4)
    if cat: q+=" AND a.category=?"; p.append(cat)
    if st: q+=" AND a.status=?"; p.append(st)
    q+=" ORDER BY a.updated_at DESC"
    items=query_db(q,p)
    for i in items: i["dep"]=calc_dep(i["cost"],i["residual_value"],i["useful_life_months"],i["purchase_date"])
    return success(items)

@app.route("/api/assets/import", methods=["POST"])
@auth_required
def import_assets():
    if 'file' not in request.files: return error("Arquivo nao enviado")
    file = request.files['file']
    if not file.filename.endswith('.csv'): return error("Formato deve ser CSV")
    
    stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
    dialect = csv.Sniffer().sniff(stream.read(1024)); stream.seek(0)
    reader = csv.DictReader(stream, dialect=dialect)
    
    # Carrega os departamentos cadastrados para mapear nomes para IDs
    depts = query_db("SELECT id, name FROM departments")
    dept_mapping = {}
    def norm_name(s):
        if not s: return ""
        s = s.strip().lower()
        replacements = {"á":"a", "à":"a", "ã":"a", "â":"a", "é":"e", "ê":"e", "í":"i", "ó":"o", "ô":"o", "õ":"o", "ú":"u", "ç":"c"}
        for k, v in replacements.items():
            s = s.replace(k, v)
        return s
    for d in depts:
        dept_mapping[norm_name(d["name"])] = d["id"]
        
    # Mapeamento de colunas (Portugues -> Interno)
    mapping = {
        'nome': 'name', 'categoria': 'category', 'status': 'status',
        'n_serie': 'serial_number', 'serial': 'serial_number', 'serial_number': 'serial_number',
        'patrimonio': 'asset_tag', 'tag': 'asset_tag', 'asset_tag': 'asset_tag',
        'marca': 'brand', 'modelo': 'model',
        'condicao': 'condition', 'condition': 'condition',
        'responsavel': 'assigned_to', 'assigned_to': 'assigned_to',
        'localizacao': 'location', 'location': 'location',
        'custo': 'cost', 'cost': 'cost', 'notas': 'notes', 'observacoes': 'notes',
        'departamento': 'department', 'department': 'department', 'setor': 'department'
    }
    
    count = 0; errors = []
    for row in reader:
        try:
            d = {}
            for k, v in row.items():
                low_k = k.lower().strip()
                if low_k in mapping: d[mapping[low_k]] = v.strip()
            
            if not d.get('name') or not d.get('category'):
                errors.append(f"Linha {reader.line_num}: Nome e Categoria sao obrigatorios")
                continue
            
            dept_id = None
            raw_dept = d.get('department')
            if raw_dept:
                norm_dept = norm_name(raw_dept)
                if norm_dept in dept_mapping:
                    dept_id = dept_mapping[norm_dept]
                    
            aid = gen_id()
            execute_db("""INSERT INTO assets(id,name,category,serial_number,asset_tag,brand,model,cost,status,condition,assigned_to,location,notes,department_id) 
                          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                       (aid, d['name'], d['category'], d.get('serial_number'), d.get('asset_tag'), 
                        d.get('brand'), d.get('model'), float(d.get('cost', 0) or 0), 
                        d.get('status', 'Ativo'), d.get('condition', 'Bom'), 
                        d.get('assigned_to'), d.get('location'), d.get('notes'), dept_id))
            count += 1
        except Exception as e:
            err_msg = str(e)
            if "UNIQUE constraint failed" in err_msg:
                if "assets.serial_number" in err_msg:
                    err_msg = "Número de Série duplicado ou já cadastrado no sistema"
                elif "assets.asset_tag" in err_msg:
                    err_msg = "Patrimônio duplicado ou já cadastrado no sistema"
                else:
                    err_msg = "Dado duplicado detectado"
            errors.append(f"Linha {reader.line_num}: {err_msg}")
            
    return success({"count": count, "errors": errors}, f"{count} ativos importados" if not errors else f"{count} importados com {len(errors)} erros")

@app.route("/api/assets/template")
def download_template():
    # Retorna os cabecalhos como texto CSV com alguns exemplos
    headers = "nome,categoria,n_serie,patrimonio,marca,modelo,status,condicao,responsavel,departamento,localizacao,custo,notas\n"
    e1 = "Dell Optiplex 7090,Computador,DL-7090-001,PAT-001,Dell,Optiplex,Ativo,Bom,Joao Silva,TI,Sala TI,5200,Desktop principal\n"
    e2 = "MacBook Pro 14,Notebook,AP-MBP-002,PAT-002,Apple,M3 Pro,Ativo,Novo,Maria Santos,Marketing,Home Office,18500,\n"
    e3 = "iPhone 15 Pro,Celular,AP-IP15-003,PAT-003,Apple,15 Pro,Em Manutencao,Bom,Carlos Mendes,Diretoria,TI,8999,Tela trincada\n"
    content = headers + e1 + e2 + e3
    return content, 200, {'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=modelo_ativos_exemplo.csv'}

@app.route("/api/assets/<aid>",methods=["GET"])
@auth_required
def get_asset(aid):
    asset = query_db("SELECT a.*,d.name as dept FROM assets a LEFT JOIN departments d ON a.department_id=d.id WHERE a.id=?", [aid], one=True)
    if not asset: return error("Ativo nao encontrado", 404)
    asset["dep"] = calc_dep(asset["cost"], asset["residual_value"], asset["useful_life_months"], asset["purchase_date"])
    asset["history"] = query_db("SELECT * FROM asset_history WHERE asset_id=? ORDER BY created_at DESC", [aid])
    asset["maintenance"] = query_db("SELECT * FROM maintenance WHERE asset_id=? ORDER BY start_date DESC", [aid])
    return success(asset)

@app.route("/api/assets",methods=["POST"])
@auth_required
def create_asset():
    d=request.json; aid=gen_id()
    # Converte strings vazias em None para evitar violação de UNIQUE e FOREIGN KEY
    sn = d.get("serial_number","").strip() or None
    tag = d.get("asset_tag","").strip() or None
    dept_id = d.get("department_id","").strip() or None
    vend_id = d.get("vendor_id","").strip() or None
    pulsus = d.get("pulsus_number","").strip() or None
    
    # Validação de duplicidade antes da inserção
    if sn:
        existing_sn = query_db("SELECT name FROM assets WHERE serial_number=?", [sn], one=True)
        if existing_sn:
            return error(f"Já existe um ativo cadastrado com o Número de Série '{sn}' ({existing_sn['name']})", 400)
    if tag:
        existing_tag = query_db("SELECT name FROM assets WHERE asset_tag=?", [tag], one=True)
        if existing_tag:
            return error(f"Já existe um ativo cadastrado com o código de Patrimônio '{tag}' ({existing_tag['name']})", 400)
            
    execute_db("INSERT INTO assets(id,name,category,serial_number,asset_tag,brand,model,specifications,purchase_date,warranty_end,cost,residual_value,useful_life_months,status,condition,assigned_to,department_id,location,vendor_id,notes,image_url,pulsus_number) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (aid,d["name"],d["category"],sn,tag,d.get("brand"),d.get("model"),json.dumps(d.get("specifications",{})),d.get("purchase_date"),d.get("warranty_end"),d.get("cost",0),d.get("residual_value",0),d.get("useful_life_months",60),d.get("status","Ativo"),d.get("condition","Novo"),d.get("assigned_to"),dept_id,d.get("location"),vend_id,d.get("notes"),d.get("image_url"),pulsus))
    log_asset_history(aid, "Cadastro", None, d.get("status","Ativo"), d.get("assigned_to","Sistema"), "Ativo cadastrado no sistema")
    return success({"id":aid},"Criado",201)

@app.route("/api/assets/<aid>",methods=["PUT"])
@auth_required
def update_asset(aid):
    d = request.json
    old = query_db("SELECT * FROM assets WHERE id=?", [aid], one=True)
    if not old: return error("Ativo nao encontrado", 404)

    performed_by = d.get("performed_by", "Sistema")
    fields = [
        "name", "category", "serial_number", "asset_tag", "brand", 
        "model", "status", "condition", "assigned_to", "department_id", 
        "location", "cost", "notes", "image_url", "purchase_date", 
        "warranty_end", "residual_value", "useful_life_months", "vendor_id", "pulsus_number",
        "deactivation_wiped", "deactivation_eco_recycle", "deactivation_document_url", "deactivation_notes",
        "responsibility_term_url"
    ]

    field_labels = {
        "name": "Nome",
        "category": "Categoria",
        "serial_number": "Número de Série",
        "asset_tag": "Patrimônio",
        "brand": "Marca",
        "model": "Modelo",
        "status": "Status",
        "condition": "Condição",
        "assigned_to": "Responsável",
        "department_id": "Departamento",
        "location": "Localização",
        "cost": "Custo",
        "notes": "Notas",
        "image_url": "Foto do Equipamento",
        "purchase_date": "Data de Compra",
        "warranty_end": "Fim da Garantia",
        "residual_value": "Valor Residual",
        "useful_life_months": "Vida Útil (meses)",
        "vendor_id": "Fornecedor",
        "pulsus_number": "Nº do Pulsus",
        "deactivation_wiped": "Sanitização de Dados (Wiping)",
        "deactivation_eco_recycle": "Descarte Ecológico",
        "deactivation_document_url": "Laudo de Desativação",
        "deactivation_notes": "Justificativa de Desativação",
        "responsibility_term_url": "Termo de Responsabilidade"
    }

    # Detecta mudancas para logar no historico
    for f in fields:
        if f in d:
            new_val = d[f]
            if isinstance(new_val, str) and new_val.strip() == "":
                new_val = None
            old_val = old[f]
            
            # Normalizações para comparação numérica
            if f in ["cost", "residual_value"]:
                try:
                    new_val_comp = float(new_val) if new_val is not None else 0.0
                    old_val_comp = float(old_val) if old_val is not None else 0.0
                except:
                    new_val_comp = new_val
                    old_val_comp = old_val
            elif f == "useful_life_months":
                try:
                    new_val_comp = int(new_val) if new_val is not None else 0
                    old_val_comp = int(old_val) if old_val is not None else 0
                except:
                    new_val_comp = new_val
                    old_val_comp = old_val
            else:
                new_val_comp = new_val
                old_val_comp = old_val

            if new_val_comp != old_val_comp:
                label = field_labels.get(f, f)
                from_str = str(old_val) if old_val is not None else "Nenhum"
                to_str = str(new_val) if new_val is not None else "Nenhum"
                
                # Resolução amigável de chaves estrangeiras
                if f == "department_id":
                    old_dept = query_db("SELECT name FROM departments WHERE id=?", [old_val], one=True) if old_val else None
                    new_dept = query_db("SELECT name FROM departments WHERE id=?", [new_val], one=True) if new_val else None
                    from_str = old_dept["name"] if old_dept else "Nenhum"
                    to_str = new_dept["name"] if new_dept else "Nenhum"
                elif f == "vendor_id":
                    old_vend = query_db("SELECT name FROM vendors WHERE id=?", [old_val], one=True) if old_val else None
                    new_vend = query_db("SELECT name FROM vendors WHERE id=?", [new_val], one=True) if new_val else None
                    from_str = old_vend["name"] if old_vend else "Nenhum"
                    to_str = new_vend["name"] if new_vend else "Nenhum"
                elif f in ["cost", "residual_value"]:
                    from_str = f"R$ {float(old_val_comp):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                    to_str = f"R$ {float(new_val_comp):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                
                action_name = "Atualização"
                notes_msg = f"Campo '{label}' modificado de '{from_str}' para '{to_str}'"
                
                if f == "status":
                    action_name = "Mudanca de Status"
                    notes_msg = d.get("status_notes", "") or f"Status alterado de '{from_str}' para '{to_str}'"
                elif f == "assigned_to":
                    action_name = "Transferencia"
                    notes_msg = d.get("transfer_notes", "") or f"Responsável alterado de '{from_str}' para '{to_str}'"
                elif f == "location":
                    action_name = "Mudanca de Local"
                    notes_msg = f"Localização alterada de '{from_str}' para '{to_str}'"
                elif f == "condition":
                    action_name = "Mudanca de Condicao"
                    notes_msg = f"Condição alterada de '{from_str}' para '{to_str}'"
                
                log_asset_history(aid, action_name, from_str, to_str, performed_by, notes_msg)

    sets = []
    vals = []
    for f in fields:
        if f in d:
            val = d[f]
            # Converte strings vazias em None para campos UNIQUE e FK
            if f in ["serial_number", "asset_tag", "department_id", "vendor_id"]:
                if isinstance(val, str):
                    val = val.strip() or None
            sets.append(f"{f}=?")
            vals.append(val)
    if sets:
        sets.append("updated_at=datetime('now')")
        vals.append(aid)
        execute_db(f"UPDATE assets SET {','.join(sets)} WHERE id=?", vals)
    return success(message="Atualizado")

@app.route("/api/assets/<aid>",methods=["DELETE"])
@auth_required
def delete_asset(aid):
    # Limpeza manual devido a possiveis tabelas antigas sem ON DELETE CASCADE
    execute_db("DELETE FROM asset_history WHERE asset_id=?", [aid])
    execute_db("DELETE FROM maintenance WHERE asset_id=?", [aid])
    execute_db("DELETE FROM asset_licenses WHERE asset_id=?", [aid])
    execute_db("DELETE FROM inventory_items WHERE asset_id=?", [aid])
    execute_db("DELETE FROM assets WHERE id=?", [aid])
    return success(message="Removido")

# ─────────── ASSET HISTORY / COMMENTS ───────────
@app.route("/api/assets/<aid>/history",methods=["GET"])
@auth_required
def get_asset_history(aid):
    items = query_db("SELECT * FROM asset_history WHERE asset_id=? ORDER BY created_at DESC", [aid])
    return success(items)

@app.route("/api/assets/<aid>/comment",methods=["POST"])
@auth_required
def add_asset_comment(aid):
    d = request.json
    log_asset_history(aid, "Comentario", None, None, d.get("author","Anonimo"), d.get("text",""))
    return success(message="Comentario adicionado")

# ─────────── MAINTENANCE ───────────
@app.route("/api/assets/<aid>/maintenance",methods=["POST"])
@auth_required
def create_maintenance(aid):
    d = request.json; mid = gen_id()
    execute_db("INSERT INTO maintenance(id,asset_id,type,description,vendor,cost,start_date,end_date,status,notes,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
               (mid, aid, d.get("type","Corretiva"), d.get("description",""), d.get("vendor",""), d.get("cost",0), d.get("start_date",""), d.get("end_date"), d.get("status","Aberta"), d.get("notes",""), d.get("image_url")))
    log_asset_history(aid, "Manutencao Aberta", None, d.get("type","Corretiva"), d.get("performed_by","Sistema"), d.get("description",""))
    # Auto muda status do ativo para Em Manutencao
    if d.get("auto_status", True):
        old = query_db("SELECT status FROM assets WHERE id=?", [aid], one=True)
        if old and old["status"] != "Em Manutencao":
            execute_db("UPDATE assets SET status='Em Manutencao', updated_at=datetime('now') WHERE id=?", [aid])
            log_asset_history(aid, "Mudanca de Status", old["status"], "Em Manutencao", d.get("performed_by","Sistema"), "Status alterado automaticamente ao abrir manutencao")
    return success({"id": mid}, "Manutencao criada", 201)

@app.route("/api/maintenance/<mid>",methods=["PUT"])
@auth_required
def update_maintenance(mid):
    d = request.json
    old = query_db("SELECT * FROM maintenance WHERE id=?", [mid], one=True)
    if not old: return error("Manutencao nao encontrada", 404)
    execute_db("UPDATE maintenance SET status=?, end_date=?, notes=?, cost=? WHERE id=?",
               (d.get("status", old["status"]), d.get("end_date", old["end_date"]), d.get("notes", old["notes"]), d.get("cost", old["cost"]), mid))
    if d.get("status") == "Concluida" and old["status"] != "Concluida":
        log_asset_history(old["asset_id"], "Manutencao Concluida", old["type"], "Concluida", d.get("performed_by","Sistema"), d.get("notes",""))
        # Auto retorna status do ativo para Ativo
        if d.get("auto_status", True):
            execute_db("UPDATE assets SET status='Ativo', updated_at=datetime('now') WHERE id=?", [old["asset_id"]])
            log_asset_history(old["asset_id"], "Mudanca de Status", "Em Manutencao", "Ativo", d.get("performed_by","Sistema"), "Status restaurado apos conclusao da manutencao")
    return success(message="Manutencao atualizada")

# ─────────── LICENSES ───────────
@app.route("/api/licenses",methods=["GET"])
@auth_required
def list_licenses():
    items=query_db("SELECT * FROM licenses ORDER BY end_date ASC")
    for license in items:
        license["util"] = round(license["used_seats"] / license["total_seats"] * 100, 1) if license["total_seats"] > 0 else 0
    return success(items)

@app.route("/api/licenses/<lid>", methods=["GET"])
@auth_required
def get_license(lid):
    license = query_db("SELECT * FROM licenses WHERE id=?", [lid], one=True)
    if not license: return error("Licença não encontrada", 404)
    license["util"] = round(license["used_seats"] / license["total_seats"] * 100, 1) if license["total_seats"] > 0 else 0
    license["history"] = query_db("SELECT * FROM licenses_history WHERE license_id=? ORDER BY created_at DESC", [lid])
    return success(license)

@app.route("/api/licenses",methods=["POST"])
@auth_required
def create_license():
    d=request.json; lid=gen_id()
    execute_db("INSERT INTO licenses(id,name,vendor_id,vendor_name,license_type,category,license_key,total_seats,used_seats,cost_per_seat,total_cost,billing_cycle,start_date,end_date,auto_renew,status,compliance_notes,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(lid,d["name"],d.get("vendor_id"),d.get("vendor_name"),d.get("license_type","Assinatura"),d.get("category"),d.get("license_key"),d.get("total_seats",1),d.get("used_seats",0),d.get("cost_per_seat",0),d.get("total_cost",0),d.get("billing_cycle","Mensal"),d.get("start_date"),d.get("end_date"),d.get("auto_renew",0),d.get("status","Ativa"),d.get("compliance_notes"),d.get("notes")))
    log_license_history(lid, "Cadastro", None, "Ativa", d.get("performed_by", "Sistema"), "Licença de software cadastrada no sistema")
    return success({"id":lid},"Criado",201)

@app.route("/api/licenses/<lid>",methods=["PUT"])
@auth_required
def update_license(lid):
    d = request.json
    old = query_db("SELECT * FROM licenses WHERE id=?", [lid], one=True)
    if not old: return error("Licença não encontrada", 404)

    performed_by = d.get("performed_by", "Sistema")
    fields = [
        "name", "vendor_name", "license_type", "category", "license_key",
        "total_seats", "used_seats", "cost_per_seat", "total_cost",
        "billing_cycle", "status", "start_date", "end_date", "notes", "compliance_notes"
    ]

    field_labels = {
        "name": "Nome",
        "vendor_name": "Fornecedor",
        "license_type": "Tipo de Licença",
        "category": "Categoria",
        "license_key": "Chave de Licença",
        "total_seats": "Total de Licenças",
        "used_seats": "Em Uso",
        "cost_per_seat": "Custo por Assento",
        "total_cost": "Custo Total",
        "billing_cycle": "Ciclo de Faturamento",
        "status": "Status",
        "start_date": "Data de Início",
        "end_date": "Data de Vencimento",
        "notes": "Observações",
        "compliance_notes": "Notas de Conformidade"
    }

    for f in fields:
        if f in d:
            new_val = d[f]
            if isinstance(new_val, str) and new_val.strip() == "":
                new_val = None
            old_val = old[f]

            # Normalizações de tipos
            if f in ["total_seats", "used_seats"]:
                try:
                    new_val_comp = int(new_val) if new_val is not None else 0
                    old_val_comp = int(old_val) if old_val is not None else 0
                except:
                    new_val_comp, old_val_comp = new_val, old_val
            elif f in ["cost_per_seat", "total_cost"]:
                try:
                    new_val_comp = float(new_val) if new_val is not None else 0.0
                    old_val_comp = float(old_val) if old_val is not None else 0.0
                except:
                    new_val_comp, old_val_comp = new_val, old_val
            else:
                new_val_comp, old_val_comp = new_val, old_val

            if new_val_comp != old_val_comp:
                label = field_labels.get(f, f)
                from_str = str(old_val) if old_val is not None else "Nenhum"
                to_str = str(new_val) if new_val is not None else "Nenhum"

                if f in ["cost_per_seat", "total_cost"]:
                    from_str = f"R$ {float(old_val_comp):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                    to_str = f"R$ {float(new_val_comp):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

                notes_msg = f"Campo '{label}' modificado de '{from_str}' para '{to_str}'"
                log_license_history(lid, "Atualização", from_str, to_str, performed_by, notes_msg)

    sets = []
    vals = []
    for f in fields:
        if f in d:
            val = d[f]
            if f in ["vendor_name", "license_key", "start_date", "end_date", "notes", "compliance_notes"]:
                if isinstance(val, str):
                    val = val.strip() or None
            sets.append(f"{f}=?")
            vals.append(val)
    if sets:
        sets.append("updated_at=datetime('now')")
        vals.append(lid)
        execute_db(f"UPDATE licenses SET {','.join(sets)} WHERE id=?", vals)
    return success(message="Licença atualizada")

@app.route("/api/licenses/<lid>/history", methods=["GET"])
@auth_required
def get_license_history(lid):
    items = query_db("SELECT * FROM licenses_history WHERE license_id=? ORDER BY created_at DESC", [lid])
    return success(items)

@app.route("/api/licenses/<lid>",methods=["DELETE"])
@auth_required
def delete_license(lid):
    execute_db("DELETE FROM licenses_history WHERE license_id=?", [lid])
    execute_db("DELETE FROM asset_licenses WHERE license_id=?", [lid])
    execute_db("DELETE FROM licenses WHERE id=?", [lid])
    return success(message="Removido")

# ─────────── BUDGET ───────────
@app.route("/api/budget",methods=["GET"])
@auth_required
def list_budget():
    yr=int(request.args.get("year",datetime.now().year))
    items=query_db("SELECT * FROM budget WHERE year=? ORDER BY month,category",[yr])
    totals=query_db("SELECT SUM(planned) as planned,SUM(actual) as actual FROM budget WHERE year=?",[yr],one=True)
    return success({"items":items,"totals":totals or {"planned":0,"actual":0}})

@app.route("/api/budget",methods=["POST"])
@auth_required
def create_budget():
    d=request.json; bid=gen_id()
    execute_db("INSERT INTO budget(id,year,month,category,planned,actual,notes) VALUES(?,?,?,?,?,?,?)",(bid,d.get("year",datetime.now().year),d["month"],d["category"],d.get("planned",0),d.get("actual",0),d.get("notes","")))
    return success({"id":bid},"Criado",201)

# ─────────── INVENTORIES ───────────
@app.route("/api/inventories",methods=["GET"])
@auth_required
def list_inventories():
    items = query_db("SELECT * FROM inventories ORDER BY year DESC, month DESC")
    for inv in items:
        stats = query_db("SELECT status, COUNT(*) as cnt FROM inventory_items WHERE inventory_id=? GROUP BY status", [inv["id"]])
        inv["stats"] = {s["status"]: s["cnt"] for s in stats}
        inv["total_items"] = sum(s["cnt"] for s in stats)
        inv["checked"] = inv["total_items"] - inv["stats"].get("Pendente", 0)
    return success(items)

@app.route("/api/inventories",methods=["POST"])
@auth_required
def create_inventory():
    d = request.json; iid = gen_id()
    yr = d.get("year", datetime.now().year)
    mo = d.get("month", datetime.now().month)
    name = d.get("name", f"Inventario {mo:02d}/{yr}")

    execute_db("INSERT INTO inventories(id,name,year,month,status,responsible,notes) VALUES(?,?,?,?,?,?,?)",
               (iid, name, yr, mo, "Aberto", d.get("responsible",""), d.get("notes","")))

    # Auto-popula com todos os ativos ativos
    assets = query_db("SELECT id FROM assets WHERE status IN ('Ativo','Em Manutencao')")
    for a in assets:
        execute_db("INSERT INTO inventory_items(id,inventory_id,asset_id,status) VALUES(?,?,?,?)",
                   (gen_id(), iid, a["id"], "Pendente"))

    return success({"id": iid, "assets_count": len(assets)}, "Inventario criado", 201)

@app.route("/api/inventories/<iid>",methods=["GET"])
@auth_required
def get_inventory(iid):
    inv = query_db("SELECT * FROM inventories WHERE id=?", [iid], one=True)
    if not inv: return error("Inventario nao encontrado", 404)
    items = query_db("""
        SELECT ii.*, a.name as asset_name, a.category, a.asset_tag, a.serial_number,
               a.brand, a.model, a.assigned_to, a.location as expected_location, a.condition as expected_condition,
               d.name as dept
        FROM inventory_items ii
        JOIN assets a ON ii.asset_id = a.id
        LEFT JOIN departments d ON a.department_id = d.id
        ORDER BY ii.status, a.name
    """, [])
    # Filter by inventory_id in Python since SQLite doesn't handle it well in some cases
    inv["items"] = [i for i in items if i["inventory_id"] == iid]
    stats = query_db("SELECT status, COUNT(*) as cnt FROM inventory_items WHERE inventory_id=? GROUP BY status", [iid])
    inv["stats"] = {s["status"]: s["cnt"] for s in stats}
    inv["total_items"] = sum(s["cnt"] for s in stats)
    inv["checked"] = inv["total_items"] - inv["stats"].get("Pendente", 0)
    return success(inv)

@app.route("/api/inventories/<iid>/items/<item_id>",methods=["PUT"])
@auth_required
def check_inventory_item(iid, item_id):
    d = request.json
    execute_db("""UPDATE inventory_items SET status=?, checked_by=?, checked_at=datetime('now'),
                  location_found=?, condition_found=?, notes=?, image_url=? WHERE id=? AND inventory_id=?""",
               (d.get("status","Encontrado"), d.get("checked_by",""), d.get("location_found",""),
                d.get("condition_found",""), d.get("notes",""), d.get("image_url"), item_id, iid))
    return success(message="Item verificado")

@app.route("/api/inventories/<iid>/close",methods=["PUT"])
@auth_required
def close_inventory(iid):
    d = request.json or {}
    # Marca pendentes como Nao Encontrado
    execute_db("UPDATE inventory_items SET status='Nao Encontrado', checked_at=datetime('now'), notes='Nao verificado ate o fechamento' WHERE inventory_id=? AND status='Pendente'", [iid])
    execute_db("UPDATE inventories SET status='Fechado', closed_at=datetime('now'), notes=? WHERE id=?", (d.get("notes",""), iid))
    return success(message="Inventario fechado")

@app.route("/api/inventories/<iid>",methods=["DELETE"])
@auth_required
def delete_inventory(iid):
    execute_db("DELETE FROM inventory_items WHERE inventory_id=?", [iid])
    execute_db("DELETE FROM inventories WHERE id=?", [iid])
    return success(message="Removido")

# ─────────── OTHER ───────────
@app.route("/api/inventory/summary")
@auth_required
def inventory_summary():
    by_cat=query_db("SELECT category,COUNT(*) as total,SUM(CASE WHEN status='Ativo' THEN 1 ELSE 0 END) as active,SUM(cost) as total_cost FROM assets GROUP BY category")
    return success({"by_category":by_cat})

@app.route("/api/departments")
@auth_required
def list_depts():
    return success(query_db("SELECT d.*,COUNT(a.id) as cnt FROM departments d LEFT JOIN assets a ON d.id=a.department_id GROUP BY d.id ORDER BY d.name"))

@app.route("/api/vendors")
@auth_required
def list_vendors():
    return success(query_db("SELECT * FROM vendors ORDER BY name"))

@app.route("/api/users", methods=["GET"])
@auth_required
def list_users():
    if g.user["role"] != "admin": return error("Acesso restrito para administradores", 403)
    users = query_db("SELECT id, username, role, created_at FROM users ORDER BY username")
    return success(users)

@app.route("/api/users", methods=["POST"])
@auth_required
def create_user():
    if g.user["role"] != "admin": return error("Acesso restrito para administradores", 403)
    d = request.json
    u = d.get("username", "").strip()
    p = d.get("password", "").strip()
    r = d.get("role", "admin").strip()
    if not u or not p: return error("Usuário e senha são obrigatórios")
    
    existing = query_db("SELECT id FROM users WHERE username=?", [u], one=True)
    if existing: return error("Nome de usuário já cadastrado")
    
    pwd_hash = hashlib.sha256(p.encode()).hexdigest()
    uid = gen_id()
    execute_db("INSERT INTO users(id, username, password, role) VALUES(?,?,?,?)", (uid, u, pwd_hash, r))
    return success({"id": uid, "username": u, "role": r}, "Usuário cadastrado com sucesso", 201)

@app.route("/api/users/<uid>", methods=["DELETE"])
@auth_required
def delete_user(uid):
    if g.user["role"] != "admin": return error("Acesso restrito para administradores", 403)
    if uid == g.user["id"]: return error("Você não pode excluir o seu próprio usuário")
    
    execute_db("DELETE FROM users WHERE id=?", [uid])
    return success(message="Usuário removido com sucesso")

@app.route("/api/health")
def health():
    return success({"status":"online","version":"2.0","frameworks":["ITIL 4","ISO 19770","ISO 27001","COBIT 2019"]})

@app.route("/api/upload", methods=["POST"])
@auth_required
def upload_file():
    if 'file' not in request.files: return error("Nenhum arquivo enviado")
    file = request.files['file']
    if file.filename == '': return error("Nenhum arquivo selecionado")
    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ['jpg','jpeg','png','gif','webp','pdf']: return error("Formato nao permitido")
    fname = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], fname))
    return success({"url": f"/uploads/{fname}"})

@app.route("/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ─────────── CONTRACTS ───────────
@app.route("/api/contracts", methods=["GET"])
@auth_required
def list_contracts():
    q = """
    SELECT c.*, v.name as vendor_name 
    FROM contracts c 
    LEFT JOIN vendors v ON c.vendor_id = v.id 
    ORDER BY c.end_date ASC
    """
    return success(query_db(q))

@app.route("/api/contracts", methods=["POST"])
@auth_required
def create_contract():
    d = request.json; cid = gen_id()
    execute_db("INSERT INTO contracts(id, name, vendor_id, contract_number, start_date, end_date, monthly_cost, sla_details, document_url, status, notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
               (cid, d.get("name"), d.get("vendor_id") or None, d.get("contract_number"), d.get("start_date"), d.get("end_date"), float(d.get("monthly_cost", 0) or 0), d.get("sla_details"), d.get("document_url"), d.get("status", "Ativo"), d.get("notes")))
    return success({"id": cid}, "Contrato criado", 201)

@app.route("/api/contracts/<cid>", methods=["PUT"])
@auth_required
def update_contract(cid):
    d = request.json
    old = query_db("SELECT * FROM contracts WHERE id=?", [cid], one=True)
    if not old: return error("Contrato não encontrado", 404)
    
    execute_db("UPDATE contracts SET name=?, vendor_id=?, contract_number=?, start_date=?, end_date=?, monthly_cost=?, sla_details=?, document_url=?, status=?, notes=? WHERE id=?",
               (d.get("name", old["name"]), d.get("vendor_id") or None, d.get("contract_number", old["contract_number"]), d.get("start_date", old["start_date"]), d.get("end_date", old["end_date"]), float(d.get("monthly_cost", old["monthly_cost"]) or 0), d.get("sla_details", old["sla_details"]), d.get("document_url", old["document_url"]), d.get("status", old["status"]), d.get("notes", old["notes"]), cid))
    return success(message="Contrato atualizado")

@app.route("/api/contracts/<cid>", methods=["DELETE"])
@auth_required
def delete_contract(cid):
    execute_db("DELETE FROM contracts WHERE id=?", [cid])
    return success(message="Contrato excluído")

# ─────────── CELULARES (PAINEL PULSUS MDM) ───────────
# Os calculos ficam no frontend (src/lib/pulsus-indicadores.ts); aqui guardamos cada
# importacao do CSV (o objeto Relatorio do modulo + os indicadores ja calculados) e as metas.
# Relatorio atual = importacao com a data-base mais recente. O Painel de Metas usa, em cada
# mes, a ultima importacao daquele mes (pela data-base).
# A pagina mostra nome, telefone e IMEI de funcionarios: acesso restrito a TI (perfil admin).
CELULARES_METAS = ["sync24", "parados", "cadastro", "duplicidades", "semNumero", "divergencia", "fimCiclo"]  # "reserva" retirado da tela
CEL_ORDEM_IMPORTACAO = "ORDER BY base DESC, importado_em DESC"

def celulares_acesso():
    return g.user["role"] == "admin"

def validar_indicadores(itens, chaves=CELULARES_METAS):
    if not isinstance(itens, list) or not itens: return "Nenhum indicador informado"
    for i in itens:
        if i.get("chave") not in chaves: return f"Indicador desconhecido: {i.get('chave')}"
        for campo in ("valor", "meta"):
            if i.get(campo) is not None and not isinstance(i.get(campo), (int, float)): return f"Valor invalido em {i.get('chave')}"
    return None

def gravar_mes_painel(assunto, referencia, itens, por, em):
    """Substitui no Painel de Metas o mes da data-base 'referencia' (AAAA-MM...) pelos indicadores informados."""
    ano, mes = int(referencia[:4]), int(referencia[5:7])
    execute_db("DELETE FROM metas_mensais WHERE assunto=? AND ano=? AND mes=?", (assunto, ano, mes))
    for ordem, i in enumerate(itens or []):
        execute_db("INSERT INTO metas_mensais(id, assunto, chave, rotulo, tipo, direcao, ordem, ano, mes, valor, meta, fechado_por, fechado_em, referencia) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (gen_id(), assunto, i["chave"], i.get("rotulo") or i["chave"], i.get("tipo") or "n", i.get("direcao") or "min", ordem, ano, mes, i.get("valor"), i.get("meta"), por, em, referencia))

def atualizar_mes_celulares(mes_ref):
    """Recalcula o mes 'AAAA-MM' do Painel de Metas a partir da ultima importacao do mes."""
    imp = query_db(f"SELECT id, base, importado_por, importado_em, indicadores FROM celulares_importacoes WHERE substr(base,1,7)=? AND indicadores IS NOT NULL {CEL_ORDEM_IMPORTACAO} LIMIT 1", [mes_ref], one=True)
    if not imp: return gravar_mes_painel("celulares", mes_ref, [], None, None)
    gravar_mes_painel("celulares", mes_ref, json.loads(imp["indicadores"]), imp["importado_por"], imp["importado_em"])

@app.route("/api/celulares/relatorio", methods=["GET"])
@auth_required
def get_celulares_relatorio():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    r = query_db(f"SELECT id, base, arquivo, importado_por, importado_em, dispositivos, indicadores FROM celulares_importacoes {CEL_ORDEM_IMPORTACAO} LIMIT 1", one=True)
    if not r: return success(None)
    r["dispositivos"] = json.loads(r["dispositivos"])
    r["indicadores"] = json.loads(r["indicadores"]) if r["indicadores"] else None
    return success(r)

@app.route("/api/celulares/importacoes", methods=["GET"])
@auth_required
def list_celulares_importacoes():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    rows = query_db(f"SELECT id, base, arquivo, importado_por, importado_em, aparelhos, indicadores FROM celulares_importacoes {CEL_ORDEM_IMPORTACAO}")
    for r in rows: r["indicadores"] = json.loads(r["indicadores"]) if r["indicadores"] else None
    return success(rows)

@app.route("/api/celulares/importacoes/<iid>", methods=["GET"])
@auth_required
def get_celulares_importacao(iid):
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    r = query_db("SELECT id, base, arquivo, importado_por, importado_em, dispositivos FROM celulares_importacoes WHERE id=?", [iid], one=True)
    if not r: return error("Importacao nao encontrada", 404)
    r["dispositivos"] = json.loads(r["dispositivos"])
    return success(r)

@app.route("/api/celulares/importacoes", methods=["POST"])
@auth_required
def create_celulares_importacao():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    d = request.json or {}
    base = d.get("base"); disp = d.get("dispositivos"); itens = d.get("indicadores")
    if not base or len(base) < 7 or not isinstance(disp, list) or not disp: return error("Relatorio invalido: informe a data-base e a lista de dispositivos")
    msg = validar_indicadores(itens)
    if msg: return error(msg)
    iid = gen_id()
    execute_db("INSERT INTO celulares_importacoes(id, base, arquivo, importado_por, importado_em, aparelhos, dispositivos, indicadores) VALUES(?,?,?,?,datetime('now'),?,?,?)",
               (iid, base, d.get("arquivo"), g.user["username"], len(disp), json.dumps(disp, ensure_ascii=False), json.dumps(itens, ensure_ascii=False)))
    atualizar_mes_celulares(base[:7])
    return success({"id": iid}, f"Relatorio salvo: {len(disp)} aparelhos", 201)

@app.route("/api/celulares/importacoes/<iid>/indicadores", methods=["PUT"])
@auth_required
def put_celulares_importacao_indicadores(iid):
    # Usado para completar importacoes antigas (migradas sem indicadores calculados)
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    r = query_db("SELECT base FROM celulares_importacoes WHERE id=?", [iid], one=True)
    if not r: return error("Importacao nao encontrada", 404)
    itens = (request.json or {}).get("indicadores")
    msg = validar_indicadores(itens)
    if msg: return error(msg)
    execute_db("UPDATE celulares_importacoes SET indicadores=? WHERE id=?", (json.dumps(itens, ensure_ascii=False), iid))
    atualizar_mes_celulares(r["base"][:7])
    return success(message="Indicadores salvos")

@app.route("/api/celulares/importacoes/<iid>", methods=["DELETE"])
@auth_required
def delete_celulares_importacao(iid):
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    r = query_db("SELECT base FROM celulares_importacoes WHERE id=?", [iid], one=True)
    if not r: return error("Importacao nao encontrada", 404)
    execute_db("DELETE FROM celulares_importacoes WHERE id=?", [iid])
    atualizar_mes_celulares(r["base"][:7])
    return success(message="Importacao excluida")

@app.route("/api/celulares/metas", methods=["GET"])
@auth_required
def get_celulares_metas():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    # So as metas ja salvas; o frontend completa com METAS_PADRAO. meta NULL = "Sem meta".
    return success({r["chave"]: r["meta"] for r in query_db("SELECT chave, meta FROM celulares_metas")})

@app.route("/api/celulares/metas", methods=["PUT"])
@auth_required
def put_celulares_metas():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    d = request.json or {}
    for chave, meta in d.items():
        if chave not in CELULARES_METAS: return error(f"Meta desconhecida: {chave}")
        if meta is not None and not isinstance(meta, (int, float)): return error(f"Meta invalida para {chave}")
    for chave, meta in d.items():
        execute_db("INSERT OR REPLACE INTO celulares_metas(chave, meta, atualizado_em) VALUES(?,?,datetime('now'))", (chave, meta))
    # A meta nova passa a valer no mes do relatorio atual (meses anteriores mantem a meta da epoca)
    atual = query_db(f"SELECT id, base, indicadores FROM celulares_importacoes WHERE indicadores IS NOT NULL {CEL_ORDEM_IMPORTACAO} LIMIT 1", one=True)
    if atual:
        itens = json.loads(atual["indicadores"])
        for i in itens:
            if i["chave"] in d: i["meta"] = d[i["chave"]]
        execute_db("UPDATE celulares_importacoes SET indicadores=? WHERE id=?", (json.dumps(itens, ensure_ascii=False), atual["id"]))
        atualizar_mes_celulares(atual["base"][:7])
    return success(message="Metas salvas")

# ─────────── COMPUTADORES (OCS + ACTIVE DIRECTORY) ───────────
# Os calculos ficam no frontend (src/lib/inventario-computadores.ts). Aqui guardamos o ultimo
# arquivo de cada tipo, ja lido pelo modulo, e as metas. Cada importacao atualiza no Painel de
# Metas o mes da data-base do OCS. Mostra usuarios e contas do AD: acesso restrito a TI (admin).
COMPUTADORES_TIPOS = {"ocs": dict, "ad_computadores": list, "ad_usuarios": list}
COMPUTADORES_METAS = ["cobertura", "foraDominio", "inventarioEmDia", "fantasmas", "cadastroCompleto", "nomePadrao", "serialValido",
                      "duplicados", "estacoesSuportadas", "servidoresSuportados", "agenteAtualizado", "hardwareAbaixo", "contasSemUso", "senhaNuncaExpira"]

@app.route("/api/computadores/arquivos", methods=["GET"])
@auth_required
def get_computadores_arquivos():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    rows = query_db("SELECT tipo, base, arquivo, importado_por, importado_em, dados FROM computadores_arquivos")
    for r in rows: r["dados"] = json.loads(r["dados"])
    return success({r["tipo"]: r for r in rows})

@app.route("/api/computadores/arquivos/<tipo>", methods=["PUT"])
@auth_required
def put_computadores_arquivo(tipo):
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    if tipo not in COMPUTADORES_TIPOS: return error("Tipo de arquivo desconhecido")
    d = request.json or {}
    dados = d.get("dados")
    if not isinstance(dados, COMPUTADORES_TIPOS[tipo]) or not dados: return error("Arquivo invalido ou vazio")
    if tipo == "ocs" and (not d.get("base") or not dados.get("maquinas")): return error("Exportacao do OCS sem data-base ou sem maquinas")
    # Um arquivo por tipo: a importacao nova substitui a anterior do mesmo tipo
    execute_db("INSERT OR REPLACE INTO computadores_arquivos(tipo, base, arquivo, importado_por, importado_em, dados) VALUES(?,?,?,?,datetime('now'),?)",
               (tipo, d.get("base"), d.get("arquivo"), g.user["username"], json.dumps(dados, ensure_ascii=False)))
    return success(message="Arquivo salvo")

@app.route("/api/computadores/arquivos/<tipo>", methods=["DELETE"])
@auth_required
def delete_computadores_arquivo(tipo):
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    if tipo != "ad_usuarios": return error("So o arquivo opcional de usuarios do AD pode ser removido")
    execute_db("DELETE FROM computadores_arquivos WHERE tipo=?", [tipo])
    return success(message="Arquivo removido")

# Leitura direta do banco do OCS (MariaDB/MySQL) com um usuario so de leitura.
# As credenciais ficam em backend/ocs_db.ini (fora do Git), secao [ocs]: host, port, database, user, password.
# Os dados voltam no mesmo formato da exportacao "All computers" para a pagina passar pelo lerOCS do modulo.
OCS_DB_INI = os.path.join(BASE_DIR, "ocs_db.ini")

def conectar_ocs():
    import configparser, pymysql
    cfg = configparser.ConfigParser(interpolation=None)
    if not cfg.read(OCS_DB_INI, encoding="utf-8") or "ocs" not in cfg:
        raise LookupError("Integracao com o OCS nao configurada: crie o arquivo backend/ocs_db.ini no servidor do IT Manager.")
    o = cfg["ocs"]
    return pymysql.connect(host=o.get("host"), port=o.getint("port", 3306), database=o.get("database", "ocsweb"),
                           user=o.get("user"), password=o.get("password", ""), charset="utf8mb4",
                           connect_timeout=5, read_timeout=60)

@app.route("/api/computadores/ocs-direto", methods=["GET"])
@auth_required
def get_computadores_ocs_direto():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    try:
        db = conectar_ocs()
    except LookupError as ex:
        return error(str(ex))
    except Exception as ex:
        return error(f"Nao foi possivel conectar ao banco do OCS: {ex}", 502)
    try:
        with db.cursor() as cur:
            # Campos administrativos de computadores: TAG fica em accountinfo.TAG, os demais em accountinfo.fields_<ID>
            cur.execute("SELECT * FROM accountinfo_config")
            nomes = [d[0].upper() for d in cur.description]
            cfg_rows = [dict(zip(nomes, r)) for r in cur.fetchall()]
            campos = [(c["ID"], str(c["NAME"]).upper()) for c in cfg_rows
                      if c.get("NAME") and str(c["NAME"]).upper() != "TAG"
                      and str(c.get("ACCOUNT_TYPE") or "COMPUTERS").upper() == "COMPUTERS"]
            cur.execute("SHOW COLUMNS FROM accountinfo")
            colunas_ai = {r[0].lower() for r in cur.fetchall()}
            campos = [(i, n) for i, n in campos if f"fields_{i}" in colunas_ai]
            extras = "".join(f", a.`fields_{i}`" for i, _ in campos)
            cur.execute(f"""SELECT h.NAME, a.TAG, h.LASTDATE, h.LASTCOME, h.USERID, h.OSNAME, h.PROCESSORT,
                                   b.SMANUFACTURER, b.SSN, b.SMODEL, h.IPADDR, h.MEMORY, h.USERAGENT{extras}
                              FROM hardware h
                              LEFT JOIN bios b ON b.HARDWARE_ID = h.ID
                              LEFT JOIN accountinfo a ON a.HARDWARE_ID = h.ID
                             WHERE h.DEVICEID NOT LIKE '\\_%' AND (h.ARCHIVE IS NULL OR h.ARCHIVE = 0)
                             ORDER BY h.NAME""")
            linhas = cur.fetchall()
    except Exception as ex:
        return error(f"Erro ao consultar o banco do OCS: {ex}", 502)
    finally:
        db.close()
    # Cabecalhos iguais aos da exportacao "All computers" (o lerOCS do frontend reconhece por eles)
    cab = ["Computer", "Account info : TAG", "Last inventory", "Last contact", "Connected user", "Operating system", "CPU type",
           "Manufacturer", "Serial number", "Model", "IP address", "RAM (MB)", "Agent"] + [f"Account info : {n}" for _, n in campos]
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", lineterminator="\n")
    w.writerow(cab)
    for r in linhas:
        w.writerow(["" if v is None else (v.strftime("%Y-%m-%d %H:%M:%S") if hasattr(v, "strftime") else str(v)) for v in r])
    return success({"csv": out.getvalue(), "maquinas": len(linhas), "origem": "Banco do OCS"})

@app.route("/api/computadores/metas", methods=["GET"])
@auth_required
def get_computadores_metas():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    return success({r["chave"]: r["meta"] for r in query_db("SELECT chave, meta FROM computadores_metas")})

@app.route("/api/computadores/metas", methods=["PUT"])
@auth_required
def put_computadores_metas():
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    d = request.json or {}
    for chave, meta in d.items():
        if chave not in COMPUTADORES_METAS: return error(f"Meta desconhecida: {chave}")
        if meta is not None and not isinstance(meta, (int, float)): return error(f"Meta invalida para {chave}")
    for chave, meta in d.items():
        execute_db("INSERT OR REPLACE INTO computadores_metas(chave, meta, atualizado_em) VALUES(?,?,datetime('now'))", (chave, meta))
    return success(message="Metas salvas")

@app.route("/api/computadores/mes", methods=["PUT"])
@auth_required
def put_computadores_mes():
    # Chamado pela pagina depois de cada importacao ou mudanca de meta, com os indicadores ja calculados
    if not celulares_acesso(): return error("Acesso restrito a TI", 403)
    d = request.json or {}
    ref = d.get("referencia") or ""
    if len(ref) < 7: return error("Data-base do OCS invalida")
    msg = validar_indicadores(d.get("indicadores"), COMPUTADORES_METAS)
    if msg: return error(msg)
    gravar_mes_painel("computadores", ref, d["indicadores"], g.user["username"], datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
    return success(message=f"Painel de Metas de {ref[5:7]}/{ref[:4]} atualizado")

# ─────────── PAINEL DE METAS ───────────
# Valores mensais por assunto. Celulares e preenchido automaticamente pelas importacoes;
# a rota de fechamento fica para assuntos com lancamento manual. O acumulado do ano
# (media dos meses) e o status de cada celula sao calculados no frontend.
METAS_ASSUNTOS = {}  # assunto -> indicadores aceitos no fechamento manual

@app.route("/api/metas-painel", methods=["GET"])
@auth_required
def get_metas_painel():
    ano = request.args.get("ano", type=int) or datetime.now().year
    itens = query_db("SELECT assunto, chave, rotulo, tipo, direcao, ordem, ano, mes, valor, meta, fechado_por, fechado_em, referencia FROM metas_mensais WHERE ano=? ORDER BY assunto, ordem, mes", [ano])
    anos = [r["ano"] for r in query_db("SELECT DISTINCT ano FROM metas_mensais ORDER BY ano DESC")]
    return success({"ano": ano, "anos": anos, "itens": itens})

@app.route("/api/metas-painel/fechamento", methods=["POST"])
@auth_required
def fechar_mes_metas():
    if g.user["role"] != "admin": return error("Acesso restrito para administradores", 403)
    d = request.json or {}
    assunto = d.get("assunto"); ano = d.get("ano"); mes = d.get("mes"); itens = d.get("itens") or []
    if assunto not in METAS_ASSUNTOS: return error("Assunto desconhecido")
    if not isinstance(ano, int) or not isinstance(mes, int) or not 1 <= mes <= 12: return error("Mes ou ano invalido")
    for i in itens:
        if i.get("chave") not in METAS_ASSUNTOS[assunto]: return error(f"Indicador desconhecido: {i.get('chave')}")
        for campo in ("valor", "meta"):
            if i.get(campo) is not None and not isinstance(i.get(campo), (int, float)): return error(f"Valor invalido em {i.get('chave')}")
    if not itens: return error("Nenhum indicador informado")
    # Fechar de novo o mesmo mes substitui o fechamento anterior
    execute_db("DELETE FROM metas_mensais WHERE assunto=? AND ano=? AND mes=?", (assunto, ano, mes))
    for ordem, i in enumerate(itens):
        execute_db("INSERT INTO metas_mensais(id, assunto, chave, rotulo, tipo, direcao, ordem, ano, mes, valor, meta, fechado_por) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                   (gen_id(), assunto, i["chave"], i.get("rotulo") or i["chave"], i.get("tipo") or "n", i.get("direcao") or "min", ordem, ano, mes, i.get("valor"), i.get("meta"), g.user["username"]))
    return success(message=f"Mes {mes:02d}/{ano} fechado")

# ─────────── TELECOM / MOBILE LINES ───────────

@app.route("/api/telecom/lines", methods=["GET"])
@auth_required
def list_mobile_lines():
    search = request.args.get("search", "")
    op = request.args.get("operator", "")
    st = request.args.get("status", "")
    
    q = """
        SELECT ml.*, d.name as dept, a.name as asset_name 
        FROM mobile_lines ml 
        LEFT JOIN departments d ON ml.department_id=d.id 
        LEFT JOIN assets a ON ml.asset_id=a.id 
        WHERE 1=1
    """
    p = []
    if search:
        q += " AND (ml.phone_number LIKE ? OR ml.assigned_to LIKE ? OR ml.sim_card LIKE ? OR ml.pulsus_number LIKE ?)"
        w = "%" + search + "%"
        p.extend([w, w, w, w])
    if op:
        q += " AND ml.plan_name LIKE ?"
        p.append("%" + op + "%")
    if st:
        q += " AND ml.status=?"
        p.append(st)
        
    q += " ORDER BY ml.phone_number ASC"
    items = query_db(q, p)
    
    # Calcula status de vencimento da auditoria
    now = datetime.now()
    for i in items:
        last_aud = i.get("last_audited_at")
        interval = i.get("audit_interval_days")
        if interval is None:
            interval = 90
            
        if not last_aud:
            i["days_since_last_audit"] = None
            i["is_audit_overdue"] = True
        else:
            try:
                # Trata formatos YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS
                dt_str = last_aud.split()[0]
                last_date = datetime.strptime(dt_str, "%Y-%m-%d")
                delta = (now - last_date).days
                i["days_since_last_audit"] = delta
                i["is_audit_overdue"] = delta > interval
            except Exception as ex:
                i["days_since_last_audit"] = None
                i["is_audit_overdue"] = True
                
    return success(items)

@app.route("/api/telecom/lines", methods=["POST"])
@auth_required
def create_mobile_line():
    d = request.json
    raw_num = d.get("phone_number", "").strip()
    if not raw_num: return error("Número do telefone é obrigatório")
    num = normalize_phone(raw_num)
    if not num: return error("Número do telefone inválido")
    
    # Valida se já existe
    existing = query_db("SELECT id FROM mobile_lines WHERE phone_number=?", [num], one=True)
    if existing: return error("Este número de telefone já está cadastrado")
    
    lid = gen_id()
    sim = d.get("sim_card", "").strip() or None
    dept_id = d.get("department_id", "").strip() or None
    asset_id = d.get("asset_id", "").strip() or None
    interval = int(d.get("audit_interval_days") or 90)
    last_aud = d.get("last_audited_at", "").strip() or None
    pulsus = d.get("pulsus_number", "").strip() or None
    
    execute_db(
        "INSERT INTO mobile_lines(id, phone_number, sim_card, assigned_to, department_id, asset_id, plan_name, monthly_cost, status, notes, audit_interval_days, last_audited_at, pulsus_number) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (lid, num, sim, d.get("assigned_to"), dept_id, asset_id, d.get("plan_name", "Vivo"), float(d.get("monthly_cost", 0) or 0), d.get("status", "Ativo"), d.get("notes"), interval, last_aud, pulsus)
    )
    log_line_history(lid, "Cadastro", None, d.get("status", "Ativo"), g.user["username"], "Linha móvel cadastrada no sistema")
    return success({"id": lid}, "Linha móvel criada", 201)

@app.route("/api/telecom/lines/<lid>", methods=["PUT"])
@auth_required
def update_mobile_line(lid):
    d = request.json
    old = query_db("SELECT * FROM mobile_lines WHERE id=?", [lid], one=True)
    if not old: return error("Linha móvel não encontrada", 404)
    
    raw_num = d.get("phone_number", "").strip()
    if not raw_num: return error("Número do telefone é obrigatório")
    num = normalize_phone(raw_num)
    if not num: return error("Número do telefone inválido")
    
    # Valida se já existe em outro registro
    existing = query_db("SELECT id FROM mobile_lines WHERE phone_number=? AND id!=?", [num, lid], one=True)
    if existing: return error("Este número de telefone já está cadastrado em outra linha")
    
    sim = d.get("sim_card", "").strip() or None
    dept_id = d.get("department_id", "").strip() or None
    asset_id = d.get("asset_id", "").strip() or None
    interval = int(d.get("audit_interval_days") or 90)
    last_aud = d.get("last_audited_at", "").strip() or None
    pulsus = d.get("pulsus_number", "").strip() or None
    
    execute_db(
        "UPDATE mobile_lines SET phone_number=?, sim_card=?, assigned_to=?, department_id=?, asset_id=?, plan_name=?, monthly_cost=?, status=?, notes=?, audit_interval_days=?, last_audited_at=?, pulsus_number=? WHERE id=?",
        (num, sim, d.get("assigned_to"), dept_id, asset_id, d.get("plan_name"), float(d.get("monthly_cost", 0) or 0), d.get("status"), d.get("notes"), interval, last_aud, pulsus, lid)
    )
    
    if old["assigned_to"] != d.get("assigned_to"):
        log_line_history(lid, "Transferencia", old["assigned_to"], d.get("assigned_to"), g.user["username"], "Portador da linha alterado manualmente")
    elif old["status"] != d.get("status"):
        log_line_history(lid, "Mudanca de Status", old["status"], d.get("status"), g.user["username"], "Status da linha alterado manualmente")
    elif old.get("pulsus_number") != pulsus:
        log_line_history(lid, "Pulsus Alterado", old.get("pulsus_number"), pulsus, g.user["username"], "Nº do Pulsus alterado manualmente")
    else:
        log_line_history(lid, "Atualizacao", None, None, g.user["username"], "Detalhes da linha atualizados")
        
    return success(message="Linha móvel atualizada")

@app.route("/api/telecom/lines/<lid>", methods=["GET"])
@auth_required
def get_mobile_line(lid):
    line = query_db("""
        SELECT ml.*, d.name as dept, a.name as asset_name 
        FROM mobile_lines ml 
        LEFT JOIN departments d ON ml.department_id=d.id 
        LEFT JOIN assets a ON ml.asset_id=a.id 
        WHERE ml.id=?
    """, [lid], one=True)
    if not line: return error("Linha móvel não encontrada", 404)
    line["history"] = query_db("SELECT * FROM mobile_lines_history WHERE mobile_line_id=? ORDER BY created_at DESC", [lid])
    
    # Calcula status de vencimento da auditoria
    now = datetime.now()
    last_aud = line.get("last_audited_at")
    interval = line.get("audit_interval_days")
    if interval is None:
        interval = 90
        
    if not last_aud:
        line["days_since_last_audit"] = None
        line["is_audit_overdue"] = True
    else:
        try:
            dt_str = last_aud.split()[0]
            last_date = datetime.strptime(dt_str, "%Y-%m-%d")
            delta = (now - last_date).days
            line["days_since_last_audit"] = delta
            line["is_audit_overdue"] = delta > interval
        except:
            line["days_since_last_audit"] = None
            line["is_audit_overdue"] = True
            
    return success(line)

@app.route("/api/telecom/lines/<lid>", methods=["DELETE"])
@auth_required
def delete_mobile_line(lid):
    execute_db("DELETE FROM telecom_audit_items WHERE mobile_line_id=?", [lid])
    execute_db("DELETE FROM mobile_lines WHERE id=?", [lid])
    return success(message="Linha móvel removida")

@app.route("/api/telecom/lines/template", methods=["GET"])
@auth_required
def get_mobile_lines_template():
    # Retorna o CSV modelo para download
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["telefone", "iccid", "portador", "departamento", "plano", "custo_mensal", "frequencia", "status", "observacoes", "pulsus"])
    writer.writerow(["11999999999", "8955123456789012345", "João da Silva", "Gente", "Vivo Empresas", "49.90", "90", "Ativo", "Linha corporativa de uso geral", "P12345"])
    writer.writerow(["011988888888", "", "Maria Santos", "TI", "Vivo Empresas", "39.90", "90", "Ativo", "Linha sem SIM Card cadastrado", "P54321"])
    
    from flask import make_response
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=modelo_importacao_linhas.csv"
    response.headers["Content-Type"] = "text/csv; charset=utf-8-sig"
    return response

@app.route("/api/telecom/lines/import", methods=["POST"])
@auth_required
def import_mobile_lines():
    if "file" not in request.files:
        return error("Nenhum arquivo enviado")
    
    file = request.files["file"]
    if not file or file.filename == "":
        return error("Nenhum arquivo selecionado")
    
    try:
        # Lê o arquivo. Tenta decodificar em UTF-8 com fallback para ISO-8859-1 (latin1)
        file_bytes = file.read()
        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = file_bytes.decode("latin1")
            
        stream = io.StringIO(content)
        # Tenta detectar dialeto do CSV (se é separado por vírgula ou ponto-e-vírgula)
        sample = content[:4096]
        if ";" in sample and "," not in sample:
            delimiter = ";"
        else:
            delimiter = ","
            
        reader = csv.reader(stream, delimiter=delimiter)
        try:
            headers = next(reader)
        except StopIteration:
            return error("Arquivo CSV vazio")
            
        # Normaliza cabeçalhos
        headers = [h.strip().lower() for h in headers]
        
        # Mapeia os índices das colunas esperadas
        col_map = {}
        expected = ["telefone", "iccid", "portador", "departamento", "plano", "custo_mensal", "frequencia", "status", "observacoes", "pulsus"]
        for key in expected:
            if key in headers:
                col_map[key] = headers.index(key)
            else:
                # Tenta variações comuns em português/inglês
                variations = {
                    "telefone": ["phone", "phone_number", "numero", "número", "linha"],
                    "iccid": ["sim", "sim_card", "simcard"],
                    "portador": ["user", "assigned_to", "nome", "funcionario", "funcionário"],
                    "departamento": ["dept", "department", "setor", "área", "area"],
                    "plano": ["plan", "plan_name"],
                    "custo_mensal": ["cost", "monthly_cost", "custo", "valor"],
                    "frequencia": ["frequency", "interval", "audit_interval_days", "frequência", "intervalo"],
                    "status": ["state", "situacao", "situação"],
                    "observacoes": ["notes", "obs", "observacao", "observações"],
                    "pulsus": ["pulsus", "pulsus_number", "numero_pulsus", "n_pulsus", "nº_pulsus", "nº do pulsus", "num_pulsus", "num do pulsus", "n_do_pulsus"]
                }
                found = False
                for var in variations[key]:
                    if var in headers:
                        col_map[key] = headers.index(var)
                        found = True
                        break
                if not found:
                    col_map[key] = -1
                    
        if col_map["telefone"] == -1:
            return error("Coluna de 'telefone' não encontrada no arquivo CSV. Colunas encontradas: " + ", ".join(headers))
            
        # Carrega os departamentos cadastrados para mapear nomes para IDs
        depts = query_db("SELECT id, name FROM departments")
        dept_mapping = {}
        def norm_name(s):
            if not s: return ""
            s = s.strip().lower()
            replacements = {"á":"a", "à":"a", "ã":"a", "â":"a", "é":"e", "ê":"e", "í":"i", "ó":"o", "ô":"o", "õ":"o", "ú":"u", "ç":"c"}
            for k, v in replacements.items():
                s = s.replace(k, v)
            return s
            
        for d in depts:
            dept_mapping[norm_name(d["name"])] = d["id"]
            
        # Carrega telefones já existentes
        existing_lines = query_db("SELECT phone_number FROM mobile_lines")
        existing_phones = {normalize_phone(row["phone_number"]) for row in existing_lines}
        
        imported_count = 0
        skipped_count = 0
        error_count = 0
        
        db_entries = []
        batch_phones = set()
        
        for row in reader:
            if not row or all(cell.strip() == "" for cell in row):
                continue
                
            def get_val(key, default=""):
                idx = col_map[key]
                if idx != -1 and idx < len(row):
                    return row[idx].strip()
                return default
                
            raw_phone = get_val("telefone")
            phone = normalize_phone(raw_phone)
            
            if not phone:
                error_count += 1
                continue
                
            # Verifica duplicados (no banco ou neste próprio lote)
            if phone in existing_phones or phone in batch_phones:
                skipped_count += 1
                continue
                
            sim_card = get_val("iccid") or None
            assigned_to = get_val("portador") or None
            dept_name = get_val("departamento")
            dept_id = None
            if dept_name:
                norm_dept = norm_name(dept_name)
                dept_id = dept_mapping.get(norm_dept, None)
                if not dept_id:
                    for name_key, d_id in dept_mapping.items():
                        if name_key in norm_dept or norm_dept in name_key:
                            dept_id = d_id
                            break
                            
            plan_name = get_val("plano") or "Vivo Empresas"
            
            raw_cost = get_val("custo_mensal", "0").replace(",", ".")
            try:
                monthly_cost = float("".join(c for c in raw_cost if c.isdigit() or c == ".")) if raw_cost else 0.0
            except ValueError:
                monthly_cost = 0.0
                
            raw_freq = get_val("frequencia", "90")
            try:
                audit_interval_days = int("".join(c for c in raw_freq if c.isdigit())) if raw_freq else 90
            except ValueError:
                audit_interval_days = 90
                
            status = get_val("status") or "Ativo"
            notes = get_val("observacoes") or ""
            pulsus = get_val("pulsus") or None
            
            lid = gen_id()
            db_entries.append((
                lid, phone, sim_card, assigned_to, dept_id, None, plan_name, monthly_cost, status, notes, audit_interval_days, None, pulsus
            ))
            batch_phones.add(phone)
            
        if db_entries:
            for entry in db_entries:
                execute_db(
                    "INSERT INTO mobile_lines(id, phone_number, sim_card, assigned_to, department_id, asset_id, plan_name, monthly_cost, status, notes, audit_interval_days, last_audited_at, pulsus_number) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    entry
                )
            imported_count = len(db_entries)
            
        return success({
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": error_count
        }, f"Importação finalizada: {imported_count} importadas, {skipped_count} duplicadas puladas, {error_count} falhas.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return error("Erro ao processar arquivo: " + str(e))

@app.route("/api/telecom/lines/<lid>/history", methods=["GET"])
@auth_required
def list_mobile_line_history(lid):
    items = query_db("SELECT * FROM mobile_lines_history WHERE mobile_line_id=? ORDER BY created_at DESC", [lid])
    return success(items)

@app.route("/api/telecom/lines/<lid>/comments", methods=["POST"])
@auth_required
def add_mobile_line_comment(lid):
    d = request.json
    author = d.get("author", "Sistema").strip() or "Sistema"
    text = d.get("text", "").strip()
    if not text: return error("Texto do comentário é obrigatório")
    
    log_line_history(lid, "Comentario", None, None, author, text)
    return success(message="Comentário adicionado")

# ─────────── AUDITORIAS DE TELEFONIA ───────────

@app.route("/api/telecom/audits", methods=["GET"])
@auth_required
def list_telecom_audits():
    items = query_db("SELECT * FROM telecom_audits ORDER BY year DESC, month DESC")
    for audit in items:
        stats = query_db("SELECT is_confirmed, COUNT(*) as cnt FROM telecom_audit_items WHERE audit_id=? GROUP BY is_confirmed", [audit["id"]])
        audit["total_items"] = sum(s["cnt"] for s in stats)
        audit["confirmed_items"] = sum(s["cnt"] for s in stats if s["is_confirmed"] == 1)
    return success(items)

@app.route("/api/telecom/audits", methods=["POST"])
@auth_required
def create_telecom_audit():
    d = request.json
    month = int(d.get("month", datetime.now().month))
    year = int(d.get("year", datetime.now().year))
    title = d.get("title", f"Auditoria Vivo - {month:02d}/{year}")
    
    # Evita duplicado para o mesmo mês/ano
    existing = query_db("SELECT id FROM telecom_audits WHERE month=? AND year=?", (month, year), one=True)
    if existing: return error(f"Já existe uma auditoria cadastrada para {month:02d}/{year}")
    
    aid = gen_id()
    execute_db("INSERT INTO telecom_audits(id, title, month, year, status) VALUES(?,?,?,?,?)", (aid, title, month, year, "Aberto"))
    
    # Copia linhas móveis ativas para a auditoria
    lines = query_db("SELECT id, assigned_to FROM mobile_lines WHERE status='Ativo'")
    for line in lines:
        execute_db(
            "INSERT INTO telecom_audit_items(id, audit_id, mobile_line_id, original_user, confirmed_user, is_confirmed, notes) VALUES(?,?,?,?,?,?,?)",
            (gen_id(), aid, line["id"], line["assigned_to"], None, 0, "")
        )
    return success({"id": aid, "items_count": len(lines)}, "Auditoria iniciada", 201)

@app.route("/api/telecom/audits/<aid>", methods=["GET"])
@auth_required
def get_telecom_audit(aid):
    audit = query_db("SELECT * FROM telecom_audits WHERE id=?", [aid], one=True)
    if not audit: return error("Auditoria não encontrada", 404)
    
    items = query_db("""
        SELECT tai.*, ml.phone_number, ml.sim_card, ml.plan_name, ml.monthly_cost, ml.status,
               d.name as dept, a.name as asset_name
        FROM telecom_audit_items tai
        JOIN mobile_lines ml ON tai.mobile_line_id = ml.id
        LEFT JOIN departments d ON ml.department_id = d.id
        LEFT JOIN assets a ON ml.asset_id = a.id
        WHERE tai.audit_id = ?
        ORDER BY tai.is_confirmed ASC, ml.phone_number ASC
    """, [aid])
    
    audit["items"] = items
    return success(audit)

@app.route("/api/telecom/audits/<aid>/items/<item_id>", methods=["PUT"])
@auth_required
def update_telecom_audit_item(aid, item_id):
    d = request.json
    is_confirmed = 1 if d.get("is_confirmed", True) else 0
    conf_user = d.get("confirmed_user", "").strip() or None
    notes = d.get("notes", "").strip() or None
    
    execute_db(
        "UPDATE telecom_audit_items SET confirmed_user=?, is_confirmed=?, notes=?, updated_at=datetime('now') WHERE id=? AND audit_id=?",
        (conf_user, is_confirmed, notes, item_id, aid)
    )
    
    # Se confirmado, opcionalmente atualiza o portador principal na tabela de mobile_lines
    if is_confirmed:
        item = query_db("SELECT mobile_line_id FROM telecom_audit_items WHERE id=?", [item_id], one=True)
        if item:
            today_str = datetime.now().strftime("%Y-%m-%d")
            if conf_user and d.get("sync_to_line", True):
                execute_db("UPDATE mobile_lines SET assigned_to=?, last_audited_at=? WHERE id=?", (conf_user, today_str, item["mobile_line_id"]))
                log_line_history(item["mobile_line_id"], "Auditoria", None, conf_user, g.user["username"], f"Linha inventariada no sistema. Portador confirmado: {conf_user}")
            else:
                execute_db("UPDATE mobile_lines SET last_audited_at=? WHERE id=?", (today_str, item["mobile_line_id"]))
                log_line_history(item["mobile_line_id"], "Auditoria", None, None, g.user["username"], "Linha inventariada no sistema. Portador existente mantido.")
            
    return success(message="Item de auditoria atualizado")

@app.route("/api/telecom/audits/<aid>/close", methods=["POST"])
@auth_required
def close_telecom_audit(aid):
    audit = query_db("SELECT * FROM telecom_audits WHERE id=?", [aid], one=True)
    if not audit: return error("Auditoria não encontrada", 404)
    execute_db("UPDATE telecom_audits SET status='Concluído' WHERE id=?", [aid])
    return success(message="Auditoria finalizada com sucesso")

@app.route("/api/telecom/audits/<aid>/import-vivo", methods=["POST"])
@auth_required
def import_vivo_invoice(aid):
    if 'file' not in request.files: return error("Arquivo não enviado")
    file = request.files['file']
    if not file.filename.endswith('.csv'): return error("Formato deve ser CSV")
    
    stream = io.StringIO(file.stream.read().decode("UTF-8", errors="ignore"), newline=None)
    
    # Sniff dialect or default to common separators
    content_sample = stream.read(2048)
    stream.seek(0)
    
    sep = ';' if ';' in content_sample else ','
    reader = csv.reader(stream, delimiter=sep)
    
    # Extrai linhas e tenta mapear colunas do relatório Vivo
    rows = list(reader)
    if not rows: return error("Arquivo CSV vazio")
    
    # Cabeçalho na primeira linha
    headers = [h.lower().strip() for h in rows[0]]
    
    # Procura índices de colunas chave
    col_line = -1
    col_dest = -1
    col_value = -1
    col_dur = -1
    col_srv = -1
    
    # Mapeamentos comuns Vivo
    line_aliases = ["linha", "telefone", "fone", "numero", "número", "celular", "origem", "phone", "terminal"]
    dest_aliases = ["destino", "chamado", "fone destino", "número chamado", "called", "destination", "nro chamado"]
    val_aliases = ["valor", "custo", "preco", "preço", "valor cobrado", "total", "cost", "value"]
    dur_aliases = ["duracao", "duração", "tempo", "minutos", "dur.", "duration"]
    srv_aliases = ["servico", "serviço", "descricao", "descrição", "tipo", "service"]
    
    for idx, h in enumerate(headers):
        if any(alias in h for alias in line_aliases): col_line = idx
        elif any(alias in h for alias in dest_aliases): col_dest = idx
        elif any(alias in h for alias in val_aliases): col_value = idx
        elif any(alias in h for alias in dur_aliases): col_dur = idx
        elif any(alias in h for alias in srv_aliases): col_srv = idx
        
    if col_line == -1:
        # Se não achou por alias, pega primeira coluna
        col_line = 0
        
    # Limpa números: remove DDD/DDI ou formatação para comparar
    def clean_phone(num):
        cleared = "".join(filter(str.isdigit, str(num)))
        if len(cleared) > 9:
            return cleared[-11:]
        return cleared
        
    line_calls = {}
    
    for row in rows[1:]:
        if not row or len(row) <= max(col_line, col_dest, col_value, col_dur, col_srv): continue
        
        line_num = clean_phone(row[col_line])
        if not line_num: continue
        
        dest_num = clean_phone(row[col_dest]) if col_dest != -1 else ""
        
        val_str = row[col_value].replace("R$", "").replace(".", "").replace(",", ".").strip() if col_value != -1 else "0"
        try:
            val = float(val_str)
        except:
            val = 0.0
            
        if line_num not in line_calls:
            line_calls[line_num] = {"total_cost": 0.0, "calls": {}, "records": 0}
            
        line_calls[line_num]["total_cost"] += val
        line_calls[line_num]["records"] += 1
        if dest_num and dest_num != line_num:
            line_calls[line_num]["calls"][dest_num] = line_calls[line_num]["calls"].get(dest_num, 0) + 1
            
    # Cruza dados da fatura da Vivo com os itens de auditoria
    audit_items = query_db("SELECT tai.id, tai.mobile_line_id, ml.phone_number FROM telecom_audit_items tai JOIN mobile_lines ml ON tai.mobile_line_id = ml.id WHERE tai.audit_id=?", [aid])
    
    updated_count = 0
    for item in audit_items:
        raw_phone = item["phone_number"]
        clean_item_phone = clean_phone(raw_phone)
        
        match = None
        for k, v in line_calls.items():
            if clean_item_phone in k or k in clean_item_phone:
                match = v
                break
                
        if match:
            cost = match["total_cost"]
            recs = match["records"]
            
            top_dest = sorted(match["calls"].items(), key=lambda x: x[1], reverse=True)[:3]
            dest_str = ", ".join([f"{num} ({cnt}x)" for num, cnt in top_dest])
            
            notes = f"Gasto na Fatura Vivo: R$ {cost:.2f} ({recs} chamadas/registros). "
            if dest_str:
                notes += f"Ligações frequentes para: {dest_str}."
            else:
                notes += "Nenhum tráfego de ligações registrado na fatura (Ociosa)."
                
            execute_db(
                "UPDATE telecom_audit_items SET notes=?, updated_at=datetime('now') WHERE id=?",
                (notes, item["id"])
            )
            updated_count += 1
            
    return success({"updated": updated_count}, f"Fatura processada! {updated_count} linhas móveis associadas e auditadas com sucesso.")

# ─────────── FRONTEND (SPA) ───────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # Serve arquivos estaticos do build React
    file_path = os.path.join(STATIC_DIR, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(STATIC_DIR, path)
    # SPA fallback — retorna index.html para qualquer rota
    index = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index):
        return send_from_directory(STATIC_DIR, "index.html")
    return "<h1>IT Manager</h1><p>Frontend nao encontrado. Execute: <code>npm run build</code> na pasta frontend.</p>", 200

if __name__=="__main__":
    print("=" * 50)
    print("  IT MANAGER v2.0")
    print("=" * 50)
    init_db(); seed_db()

    mode = os.environ.get("MODE", "development")

    if mode == "production":
        # Producao: usa Waitress (WSGI)
        try:
            from waitress import serve as waitress_serve
            print(f"[PRODUCAO] Waitress em http://{HOST}:{PORT}")
            waitress_serve(app, host=HOST, port=PORT, threads=4)
        except ImportError:
            print("[AVISO] Waitress nao instalado. Usando Flask dev server.")
            print(f"[DEV] http://{HOST}:{PORT}")
            app.run(host=HOST, port=PORT, debug=False)
    else:
        # Desenvolvimento
        print(f"[DEV] http://localhost:{PORT}")
        app.run(host=HOST, port=PORT, debug=True)
