from flask import Flask, render_template, g, request, jsonify, session
from werkzeug.exceptions import HTTPException
import sqlite3
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('PLANNER_SECRET', 'dev-secret')
APP_PASSWORD = os.environ.get('APP_PASSWORD', 'Planner2026$%&')

# Configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
IS_POSTGRES = DATABASE_URL is not None and DATABASE_URL.startswith('postgres')
DATABASE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'planner.db')

class DBWrapper:
    def __init__(self, conn, is_postgres=False):
        self.conn = conn
        self.is_postgres = is_postgres

    def execute(self, query, params=()):
        if self.is_postgres:
            # Convert ? to %s for Postgres
            query = query.replace('?', '%s')
            # Handle rowid replacement for Postgres (not supported, usually logic needs change)
            # But we handle logic changes in the routes.
        
        try:
            if self.is_postgres:
                cur = self.conn.cursor()
                cur.execute(query, params)
                return cur
            else:
                return self.conn.execute(query, params)
        except Exception as e:
            # self.conn.rollback() # Optional: auto-rollback
            raise e

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        if IS_POSTGRES:
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
            db = g._database = DBWrapper(conn, is_postgres=True)
        else:
            conn = sqlite3.connect(DATABASE_FILE)
            conn.row_factory = sqlite3.Row
            db = g._database = DBWrapper(conn, is_postgres=False)
    return db

def ensure_tasks_columns(db):
    if db.is_postgres:
        # Postgres column check (simplified for now, assuming fresh deploy usually)
        # Or check information_schema if needed. 
        # For this task, we skip schema migration on Postgres for simplicity 
        # unless we want to be very robust.
        return

    # SQLite logic
    cols = {row[1] for row in db.execute('PRAGMA table_info(tasks)').fetchall()}
    to_add = []
    if 'description' not in cols:
        to_add.append("ALTER TABLE tasks ADD COLUMN description TEXT")
    if 'status' not in cols:
        to_add.append("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'To Do'")
    if 'priority' not in cols:
        to_add.append("ALTER TABLE tasks ADD COLUMN priority TEXT")
    if 'due_date' not in cols:
        to_add.append("ALTER TABLE tasks ADD COLUMN due_date TEXT")
    if 'user_id' not in cols:
        to_add.append("ALTER TABLE tasks ADD COLUMN user_id INTEGER")
    if 'created_by' not in cols:
        to_add.append("ALTER TABLE tasks ADD COLUMN created_by INTEGER")
    for stmt in to_add:
        db.execute(stmt)
    if to_add:
        db.commit()

def init_db():
    db = get_db()
    
    if db.is_postgres:
        # Postgres Schema
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(first_name, last_name)
            );
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'To Do',
                priority TEXT,
                due_date TEXT,
                user_id INTEGER,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                task_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
    else:
        # SQLite Schema
        db.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(first_name, last_name)
            );
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        ensure_tasks_columns(db)
        
    db.commit()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

@app.before_request
def check_app_lock():
    # Allow static resources
    if request.path.startswith('/static/'):
        return None
    
    # Allow unlock endpoint
    if request.path == '/api/unlock':
        return None
        
    # Check if app is unlocked
    if not session.get('app_unlocked'):
        # If accessing root, render lock page
        if request.path == '/':
            return render_template('lock.html')
        # Block API calls
        if request.path.startswith('/api/'):
            return jsonify({"error": "App bloccata. Inserire password."}), 403
            
        # For any other route, also show lock page (or redirect to /)
        return render_template('lock.html')

@app.route('/')
def index():
    return render_template('index.html')

@app.post('/api/unlock')
def api_unlock():
    data = request.get_json(silent=True) or {}
    pwd = data.get('password')
    
    if pwd == APP_PASSWORD:
        session['app_unlocked'] = True
        return jsonify({"message": "App sbloccata"}), 200
    
    return jsonify({"error": "Password errata"}), 401

@app.post('/api/signup')
def api_signup():
    data = request.get_json(silent=True) or {}
    full_name = (data.get('fullName') or '').strip()
    pwd = (data.get('password') or '')
    confirm = (data.get('confirmPassword') or '')

    if not full_name:
        return jsonify({"error": "Il Nome Cognome è obbligatorio"}), 400
    if not pwd or not confirm:
        return jsonify({"error": "Tutti i campi sono obbligatori"}), 400
    if pwd != confirm:
        return jsonify({"error": "Le password non coincidono"}), 400
    if len(pwd) < 6:
        return jsonify({"error": "La password deve essere almeno di 6 caratteri"}), 400

    if ' ' in full_name:
        parts = full_name.rsplit(' ', 1)
        first = parts[0].strip()
        last = parts[1].strip()
    else:
        first = full_name
        last = '-'
    
    if not first: first = '-'
    if not last: last = '-'

    pwd_hash = generate_password_hash(pwd)
    try:
        db = get_db()
        db.execute(
            'INSERT INTO users (first_name, last_name, password_hash) VALUES (?, ?, ?)',
            (first, last, pwd_hash)
        )
        db.commit()
    except (sqlite3.IntegrityError, psycopg2.IntegrityError):
        return jsonify({"error": "Utente già esistente"}), 409

    return jsonify({"message": "Registrazione completata"}), 201

@app.post('/api/signin')
def api_signin():
    data = request.get_json(silent=True) or {}
    full_name = (data.get('fullName') or '').strip()
    first = (data.get('firstName') or '').strip()
    last = (data.get('lastName') or '').strip()
    pwd = (data.get('password') or '')

    if not pwd:
        return jsonify({"error": "La password è obbligatoria"}), 400

    db = get_db()
    row = None
    
    if full_name:
        row = db.execute(
            "SELECT id, first_name, last_name, password_hash FROM users WHERE (first_name || ' ' || last_name) = ?",
            (full_name,)
        ).fetchone()
    elif first and last:
        row = db.execute(
            'SELECT id, first_name, last_name, password_hash FROM users WHERE first_name=? AND last_name=?',
            (first, last)
        ).fetchone()
    else:
        return jsonify({"error": "Nome utente (Nome Cognome) obbligatorio"}), 400

    if not row or not check_password_hash(row['password_hash'], pwd):
        return jsonify({"error": "Credenziali non valide"}), 401

    session['user_id'] = row['id']
    session['user_name'] = f"{row['first_name']} {row['last_name']}"
    return jsonify({"message": "Accesso effettuato", "user": session['user_name'], "user_id": session['user_id']})

@app.post('/api/signout')
def api_signout():
    session.clear()
    return jsonify({"message": "Logout effettuato"})

@app.get('/api/session')
def api_session():
    if 'user_id' in session:
        return jsonify({"authenticated": True, "user": session.get('user_name'), "user_id": session.get('user_id')})
    return jsonify({"authenticated": False})

@app.get('/api/users')
def api_users_list():
    if 'user_id' not in session:
        return jsonify({"users": []})
    db = get_db()
    rows = db.execute('SELECT id, first_name, last_name FROM users ORDER BY first_name, last_name').fetchall()
    users = [{"id": row["id"], "name": f"{row['first_name']} {row['last_name']}"} for row in rows]
    return jsonify({"users": users})

@app.delete('/api/users/<int:user_id>')
def api_users_delete(user_id):
    if 'user_id' not in session:
        return jsonify({"error": "Autenticazione richiesta"}), 401
    
    data = request.get_json(silent=True) or {}
    password = data.get('password')
    
    if password != "Quargentan67&":
        return jsonify({"error": "Password amministratore errata"}), 403
        
    db = get_db()
    user = db.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({"error": "Utente non trovato"}), 404
        
    try:
        db.execute('DELETE FROM users WHERE id = ?', (user_id,))
        db.commit()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
    return jsonify({"message": "Utente cancellato con successo"}), 200

@app.get('/api/tasks')
def api_tasks_list():
    if 'user_id' not in session:
        return jsonify({"tasks": []})
    db = get_db()
    
    query = """
        SELECT 
            t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.user_id, t.created_by,
            u.first_name || ' ' || u.last_name as assigned_to_name
        FROM tasks t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.user_id = ? OR t.created_by = ?
        ORDER BY t.created_at DESC
    """
    rows = db.execute(query, (session['user_id'], session['user_id'])).fetchall()
    
    tasks = [dict(row) for row in rows]
    
    if tasks:
        task_ids = [str(t['id']) for t in tasks]
        placeholders = ','.join(['?'] * len(task_ids))
        comments_query = f"""
            SELECT c.task_id, c.id, c.content, c.created_at, u.first_name, u.last_name
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.task_id IN ({placeholders})
            ORDER BY c.created_at ASC
        """
        comments_rows = db.execute(comments_query, task_ids).fetchall()
        
        comments_map = {}
        for row in comments_rows:
            tid = row['task_id']
            if tid not in comments_map:
                comments_map[tid] = []
            comments_map[tid].append({
                "id": row["id"],
                "content": row["content"],
                "created_at": str(row["created_at"]), # Ensure string serialization for PG timestamps
                "user_name": f"{row['first_name']} {row['last_name']}"
            })
            
        for t in tasks:
            t['comments'] = comments_map.get(t['id'], [])
            # Also ensure task timestamps are strings
            t['created_at'] = str(t['created_at'])
            
    return jsonify({"tasks": tasks})

@app.post('/api/tasks')
def api_tasks_create():
    if 'user_id' not in session:
        return jsonify({"error": "Autenticazione richiesta"}), 401
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    status = (data.get('status') or '').strip()
    priority = (data.get('priority') or '').strip()
    due_date = (data.get('dueDate') or '').strip()
    assign_to = data.get('assignTo')

    if not title:
        return jsonify({"error": "Il nome task è obbligatorio"}), 400
    if status not in ("To Do", "ToDo", "todo"):
        return jsonify({"error": "Stato non valido (usa 'To Do')"}), 400
    if priority not in ("Bassa", "Media", "Alta"):
        return jsonify({"error": "Priorità non valida"}), 400
    
    target_user_id = session['user_id']
    if assign_to:
        try:
            target_user_id = int(assign_to)
        except ValueError:
            pass

    db = get_db()
    
    if db.is_postgres:
        cur = db.execute(
            'INSERT INTO tasks (title, description, status, priority, due_date, user_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
            (title, description, 'To Do', priority, due_date, target_user_id, session['user_id'])
        )
        new_id = cur.fetchone()['id']
    else:
        cur = db.execute(
            'INSERT INTO tasks (title, description, status, priority, due_date, user_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (title, description, 'To Do', priority, due_date, target_user_id, session['user_id'])
        )
        new_id = cur.lastrowid
        
    db.commit()

    row = db.execute(
        '''SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.user_id, t.created_by,
           u.first_name || ' ' || u.last_name as assigned_to_name
           FROM tasks t 
           LEFT JOIN users u ON t.user_id = u.id
           WHERE t.id = ?''',
           (new_id,)
    ).fetchone()
    
    # Convert Row/RealDict to dict and handle date serialization
    res_task = dict(row)
    res_task['created_at'] = str(res_task['created_at'])
    
    return jsonify({"task": res_task}), 201

@app.put('/api/tasks/<int:task_id>')
def api_tasks_update(task_id):
    if 'user_id' not in session:
        return jsonify({"error": "Autenticazione richiesta"}), 401
    
    db = get_db()
    task = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    
    if not task:
        return jsonify({"error": "Task non trovata"}), 404

    current_user_id = session['user_id']
    is_creator = (task['created_by'] == current_user_id)
    is_assignee = (task['user_id'] == current_user_id)

    if not (is_creator or is_assignee):
        return jsonify({"error": "Permessi insufficienti"}), 403

    data = request.get_json(silent=True) or {}
    
    status = data.get('status')
    title = data.get('title')
    description = data.get('description')
    priority = data.get('priority')
    due_date = data.get('dueDate')
    
    updating_restricted_fields = (title is not None) or (description is not None) or (priority is not None) or (due_date is not None)
    
    if updating_restricted_fields and not is_creator:
        return jsonify({"error": "Solo chi ha creato la task può modificarne i dettagli"}), 403

    updates = []
    params = []
    
    if status:
        updates.append("status = ?")
        params.append(status)
    if title:
        updates.append("title = ?")
        params.append(title.strip())
    if description is not None: 
        updates.append("description = ?")
        params.append(description.strip())
    if priority:
        updates.append("priority = ?")
        params.append(priority)
    if due_date is not None:
        updates.append("due_date = ?")
        params.append(due_date)
        
    if not updates:
        return jsonify({"message": "Nessuna modifica"}), 200
        
    params.append(task_id)
    
    query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
    db.execute(query, params)
    db.commit()
    
    updated_task = db.execute(
        '''SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.user_id, t.created_by,
           u.first_name || ' ' || u.last_name as assigned_to_name,
           last_c.content as last_comment,
           last_u.first_name || ' ' || last_u.last_name as last_comment_user
           FROM tasks t 
           LEFT JOIN users u ON t.user_id = u.id
           LEFT JOIN comments last_c ON last_c.id = (
                SELECT MAX(id) FROM comments WHERE task_id = t.id
           )
           LEFT JOIN users last_u ON last_c.user_id = last_u.id
           WHERE t.id = ?''', 
        (task_id,)
    ).fetchone()
    
    res_task = dict(updated_task)
    res_task['created_at'] = str(res_task['created_at'])
    
    return jsonify({"message": "Task aggiornata", "task": res_task}), 200

@app.delete('/api/tasks/<int:task_id>')
def api_tasks_delete(task_id):
    if 'user_id' not in session:
        return jsonify({"error": "Autenticazione richiesta"}), 401
        
    db = get_db()
    result = db.execute(
        'DELETE FROM tasks WHERE id = ? AND created_by = ?', 
        (task_id, session['user_id'])
    )
    db.commit()
    
    if result.rowcount == 0:
        task = db.execute('SELECT id FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if task:
            return jsonify({"error": "Solo chi ha creato la task può cancellarla"}), 403
        return jsonify({"error": "Task non trovata"}), 404
        
    return jsonify({"message": "Task eliminata"}), 200

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

@app.get('/api/tasks/<int:task_id>/comments')
def api_tasks_comments(task_id):
    if 'user_id' not in session:
        return jsonify({"error": "Autenticazione richiesta"}), 401
    
    db = get_db()
    task = db.execute(
        'SELECT id FROM tasks WHERE id = ? AND (user_id = ? OR created_by = ?)', 
        (task_id, session['user_id'], session['user_id'])
    ).fetchone()
    if not task:
        return jsonify({"error": "Task non trovata o accesso negato"}), 404
        
    rows = db.execute('''
        SELECT c.id, c.content, c.created_at, u.first_name, u.last_name
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.task_id = ?
        ORDER BY c.created_at ASC
    ''', (task_id,)).fetchall()
    
    comments = []
    for r in rows:
        comments.append({
            "id": r["id"],
            "content": r["content"],
            "created_at": str(r["created_at"]),
            "user_name": f"{r['first_name']} {r['last_name']}"
        })
    return jsonify({"comments": comments})

@app.post('/api/tasks/<int:task_id>/comments')
def api_tasks_add_comment(task_id):
    if 'user_id' not in session:
        return jsonify({"error": "Autenticazione richiesta"}), 401
    
    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({"error": "Contenuto obbligatorio"}), 400
        
    db = get_db()
    task = db.execute(
        'SELECT id FROM tasks WHERE id = ? AND (user_id = ? OR created_by = ?)', 
        (task_id, session['user_id'], session['user_id'])
    ).fetchone()
    if not task:
        return jsonify({"error": "Task non trovata o accesso negato"}), 404
        
    db.execute(
        'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)',
        (task_id, session['user_id'], content)
    )
    db.commit()
    
    return jsonify({"message": "Commento aggiunto"}), 201

if __name__ == '__main__':
    # Initialize DB (creates tables if needed)
    with app.app_context():
        init_db()
    app.run(host='127.0.0.1', port=5011, debug=True)
