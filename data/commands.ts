export interface CommandItem {
  command: string;
  category: "Django CLI" | "SQLite3 Direct API" | "DRF Endpoints" | "Auth & JWT";
  description: string;
  example: string;
  badge?: string;
}

export const COMMAND_REFERENCE: CommandItem[] = [
  {
    command: "django-admin startproject <name>",
    category: "Django CLI",
    description: "Initializes a new Django project directory structure.",
    example: "django-admin startproject moviereviews .",
    badge: "CLI"
  },
  {
    command: "python manage.py startapp <name>",
    category: "Django CLI",
    description: "Creates a new feature application package inside project.",
    example: "python manage.py startapp movie",
    badge: "CLI"
  },
  {
    command: "python manage.py runserver [port]",
    category: "Django CLI",
    description: "Starts the local development web server on port 8000 (default).",
    example: "python manage.py runserver",
    badge: "CLI"
  },
  {
    command: "python manage.py makemigrations",
    category: "Django CLI",
    description: "Generates new migration files based on detected changes in models.py.",
    example: "python manage.py makemigrations",
    badge: "CLI"
  },
  {
    command: "python manage.py migrate",
    category: "Django CLI",
    description: "Applies unapplied migrations to the sqlite3 database tables.",
    example: "python manage.py migrate",
    badge: "CLI"
  },
  {
    command: "python manage.py createsuperuser",
    category: "Django CLI",
    description: "Prompts to create an admin user with superuser privileges.",
    example: "python manage.py createsuperuser",
    badge: "CLI"
  },
  {
    command: "sqlite3.connect(database)",
    category: "SQLite3 Direct API",
    description: "Opens connection to SQLite DB file or in-memory DB.",
    example: "conn = sqlite3.connect('db.sqlite3')",
    badge: "Python"
  },
  {
    command: "cursor.execute(sql, params)",
    category: "SQLite3 Direct API",
    description: "Executes a single parameterized SQL query against cursor.",
    example: "cursor.execute('SELECT * FROM user WHERE id=?', (user_id,))",
    badge: "Python"
  },
  {
    command: "cursor.executemany(sql, seq)",
    category: "SQLite3 Direct API",
    description: "Executes SQL query iteratively across a sequence of parameter tuples.",
    example: "cursor.executemany('INSERT INTO table VALUES (?)', data_list)",
    badge: "Python"
  },
  {
    command: "cursor.executescript(sql_script)",
    category: "SQLite3 Direct API",
    description: "Executes multiple semicolon-separated SQL statements at once.",
    example: "cursor.executescript('CREATE TABLE a; CREATE TABLE b;')",
    badge: "Python"
  },
  {
    command: "cursor.fetchall()",
    category: "SQLite3 Direct API",
    description: "Fetches all remaining rows of a query result set as list of tuples.",
    example: "rows = cursor.fetchall()",
    badge: "Python"
  },
  {
    command: "conn.commit() / conn.rollback()",
    category: "SQLite3 Direct API",
    description: "Commits current transaction to disk or rolls back pending changes.",
    example: "conn.commit()",
    badge: "Python"
  },
  {
    command: "POST /api/token/",
    category: "DRF Endpoints",
    description: "SimpleJWT view to exchange username & password for access & refresh tokens.",
    example: "body: {'username': 'johndoe', 'password': '123'}",
    badge: "JWT"
  },
  {
    command: "POST /api/token/refresh/",
    category: "DRF Endpoints",
    description: "Exchanges valid refresh token for a brand-new access token.",
    example: "body: {'refresh': '<refresh_token>'}",
    badge: "JWT"
  },
  {
    command: "Authorization: Bearer <token>",
    category: "Auth & JWT",
    description: "HTTP header required for authenticating requests to protected DRF routes.",
    example: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn...",
    badge: "HTTP"
  }
];
