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

def init_db():
    db = sqlite3.connect(DATABASE)
    db.executescript("""
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, manager TEXT, cost_center TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS vendors (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, email TEXT, phone TEXT, website TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, serial_number TEXT UNIQUE, asset_tag TEXT UNIQUE, brand TEXT, model TEXT, specifications TEXT, purchase_date TEXT, warranty_end TEXT, cost REAL DEFAULT 0, residual_value REAL DEFAULT 0, useful_life_months INTEGER DEFAULT 60, status TEXT DEFAULT 'Ativo', condition TEXT DEFAULT 'Bom', assigned_to TEXT, department_id TEXT REFERENCES departments(id), location TEXT, vendor_id TEXT REFERENCES vendors(id), notes TEXT, image_url TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, name TEXT NOT NULL, vendor_id TEXT REFERENCES vendors(id), vendor_name TEXT, license_type TEXT DEFAULT 'Assinatura', category TEXT, license_key TEXT, total_seats INTEGER DEFAULT 1, used_seats INTEGER DEFAULT 0, cost_per_seat REAL DEFAULT 0, total_cost REAL DEFAULT 0, billing_cycle TEXT DEFAULT 'Mensal', start_date TEXT, end_date TEXT, auto_renew INTEGER DEFAULT 0, status TEXT DEFAULT 'Ativa', compliance_notes TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS asset_licenses (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE, assigned_at TEXT DEFAULT (datetime('now')), UNIQUE(asset_id, license_id));
    CREATE TABLE IF NOT EXISTS budget (id TEXT PRIMARY KEY, year INTEGER NOT NULL, month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12), category TEXT NOT NULL, planned REAL DEFAULT 0, actual REAL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(year, month, category));
    CREATE TABLE IF NOT EXISTS asset_history (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, action TEXT NOT NULL, from_value TEXT, to_value TEXT, performed_by TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS maintenance (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, type TEXT, description TEXT, vendor TEXT, cost REAL DEFAULT 0, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'Aberta', notes TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS inventories (id TEXT PRIMARY KEY, name TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, status TEXT DEFAULT 'Aberto', responsible TEXT, notes TEXT, started_at TEXT DEFAULT (datetime('now')), closed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY, inventory_id TEXT NOT NULL REFERENCES inventories(id) ON DELETE CASCADE, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, status TEXT DEFAULT 'Pendente', checked_by TEXT, checked_at TEXT, location_found TEXT, condition_found TEXT, notes TEXT, image_url TEXT, UNIQUE(inventory_id, asset_id));
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'admin', token TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_a_cat ON assets(category);
    CREATE INDEX IF NOT EXISTS idx_a_st ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_a_dept ON assets(department_id);
    CREATE INDEX IF NOT EXISTS idx_l_st ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_l_end ON licenses(end_date);
    CREATE INDEX IF NOT EXISTS idx_b_ym ON budget(year, month);
    CREATE INDEX IF NOT EXISTS idx_ah_asset ON asset_history(asset_id);
    CREATE INDEX IF NOT EXISTS idx_inv_ym ON inventories(year, month);
    CREATE INDEX IF NOT EXISTS idx_invi_inv ON inventory_items(inventory_id);
    """)
    # Migracao simples para bases existentes
    try:
        db.execute("ALTER TABLE assets ADD COLUMN image_url TEXT")
    except: pass
    try:
        db.execute("ALTER TABLE inventory_items ADD COLUMN image_url TEXT")
    except: pass

    # Garante usuário admin padrao admin/admin
    pwd_hash = hashlib.sha256("admin".encode()).hexdigest()
    db.execute("INSERT OR IGNORE INTO users(id,username,password,role) VALUES(?,?,?,?)", (gen_id(), "admin", pwd_hash, "admin"))

    db.commit(); db.close()
    print("DB inicializado!")

def seed_db():
    db = sqlite3.connect(DATABASE)
    if db.execute("SELECT COUNT(*) FROM assets").fetchone()[0] > 0: db.close(); return
    year = datetime.now().year
    db.executemany("INSERT INTO departments(id,name,manager,cost_center) VALUES(?,?,?,?)", [("dept_ti","TI","Rafael Souza","CC-100"),("dept_rh","RH","Juliana Alves","CC-200"),("dept_fin","Financeiro","Marcos Pereira","CC-300"),("dept_com","Comercial","Ana Costa","CC-400"),("dept_mkt","Marketing","Maria Santos","CC-500"),("dept_dir","Diretoria","Carlos Mendes","CC-700")])
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
    return success({"kpis":{"total_assets":ac,"active":active,"value":tv,"licenses":lc,"expiring":exp,"budget_planned":bp,"budget_actual":ba},"charts":{"by_category":by_cat,"by_status":by_st}})

# ─────────── ASSETS ───────────
@app.route("/api/assets",methods=["GET"])
@auth_required
def list_assets():
    s=request.args.get("search",""); cat=request.args.get("category",""); st=request.args.get("status","")
    q="SELECT a.*,d.name as dept FROM assets a LEFT JOIN departments d ON a.department_id=d.id WHERE 1=1"; p=[]
    if s: q+=" AND (a.name LIKE ? OR a.serial_number LIKE ? OR a.brand LIKE ?)"; w="%"+s+"%"; p.extend([w]*3)
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
    
    # Mapeamento de colunas (Portugues -> Interno)
    mapping = {
        'nome': 'name', 'categoria': 'category', 'status': 'status',
        'n_serie': 'serial_number', 'serial': 'serial_number', 'serial_number': 'serial_number',
        'patrimonio': 'asset_tag', 'tag': 'asset_tag', 'asset_tag': 'asset_tag',
        'marca': 'brand', 'modelo': 'model',
        'condicao': 'condition', 'condition': 'condition',
        'responsavel': 'assigned_to', 'assigned_to': 'assigned_to',
        'localizacao': 'location', 'location': 'location',
        'custo': 'cost', 'cost': 'cost', 'notas': 'notes', 'observacoes': 'notes'
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
            
            aid = gen_id()
            execute_db("""INSERT INTO assets(id,name,category,serial_number,asset_tag,brand,model,cost,status,condition,assigned_to,location,notes) 
                          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                       (aid, d['name'], d['category'], d.get('serial_number'), d.get('asset_tag'), 
                        d.get('brand'), d.get('model'), float(d.get('cost', 0) or 0), 
                        d.get('status', 'Ativo'), d.get('condition', 'Bom'), 
                        d.get('assigned_to'), d.get('location'), d.get('notes')))
            count += 1
        except Exception as e:
            errors.append(f"Linha {reader.line_num}: {str(e)}")
            
    return success({"count": count, "errors": errors}, f"{count} ativos importados" if not errors else f"{count} importados com {len(errors)} erros")

@app.route("/api/assets/template")
def download_template():
    # Retorna os cabecalhos como texto CSV com alguns exemplos
    headers = "nome,categoria,n_serie,patrimonio,marca,modelo,status,condicao,responsavel,localizacao,custo,notas\n"
    e1 = "Dell Optiplex 7090,Computador,DL-7090-001,PAT-001,Dell,Optiplex,Ativo,Bom,Joao Silva,Sala TI,5200,Desktop principal\n"
    e2 = "MacBook Pro 14,Notebook,AP-MBP-002,PAT-002,Apple,M3 Pro,Ativo,Novo,Maria Santos,Home Office,18500,\n"
    e3 = "iPhone 15 Pro,Celular,AP-IP15-003,PAT-003,Apple,15 Pro,Em Manutencao,Bom,Carlos Mendes,TI,8999,Tela trincada\n"
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
    
    execute_db("INSERT INTO assets(id,name,category,serial_number,asset_tag,brand,model,specifications,purchase_date,warranty_end,cost,residual_value,useful_life_months,status,condition,assigned_to,department_id,location,vendor_id,notes,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (aid,d["name"],d["category"],sn,tag,d.get("brand"),d.get("model"),json.dumps(d.get("specifications",{})),d.get("purchase_date"),d.get("warranty_end"),d.get("cost",0),d.get("residual_value",0),d.get("useful_life_months",60),d.get("status","Ativo"),d.get("condition","Novo"),d.get("assigned_to"),dept_id,d.get("location"),vend_id,d.get("notes"),d.get("image_url")))
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
        "warranty_end", "residual_value", "useful_life_months", "vendor_id"
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
        "vendor_id": "Fornecedor"
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
    execute_db("INSERT INTO maintenance(id,asset_id,type,description,vendor,cost,start_date,end_date,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
               (mid, aid, d.get("type","Corretiva"), d.get("description",""), d.get("vendor",""), d.get("cost",0), d.get("start_date",""), d.get("end_date"), d.get("status","Aberta"), d.get("notes","")))
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
    for i in items: i["util"]=round(i["used_seats"]/i["total_seats"]*100,1) if i["total_seats"]>0 else 0
    return success(items)

@app.route("/api/licenses",methods=["POST"])
@auth_required
def create_license():
    d=request.json; lid=gen_id()
    execute_db("INSERT INTO licenses(id,name,vendor_id,vendor_name,license_type,category,license_key,total_seats,used_seats,cost_per_seat,total_cost,billing_cycle,start_date,end_date,auto_renew,status,compliance_notes,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(lid,d["name"],d.get("vendor_id"),d.get("vendor_name"),d.get("license_type","Assinatura"),d.get("category"),d.get("license_key"),d.get("total_seats",1),d.get("used_seats",0),d.get("cost_per_seat",0),d.get("total_cost",0),d.get("billing_cycle","Mensal"),d.get("start_date"),d.get("end_date"),d.get("auto_renew",0),d.get("status","Ativa"),d.get("compliance_notes"),d.get("notes")))
    return success({"id":lid},"Criado",201)

@app.route("/api/licenses/<lid>",methods=["DELETE"])
@auth_required
def delete_license(lid):
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
    if ext not in ['jpg','jpeg','png','gif','webp']: return error("Formato nao permitido")
    fname = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], fname))
    return success({"url": f"/uploads/{fname}"})

@app.route("/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

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
