import { settings } from "./project";
import { bool, num, py, str, type Lab, type LabState } from "./types";

// ===========================================================================
// Python's sqlite3 module (no Django involved)
// ===========================================================================

function sqliteCode(s: LabState) {
  const op = str(s, "operation");
  let part = "";
  if (op === "fetch") {
    const mode = str(s, "fetchMode");
    part = `cur.execute("SELECT id, name, marks FROM students ORDER BY marks DESC")
${
  mode === "fetchone"
    ? `print("fetchone():", cur.fetchone())
print("fetchone():", cur.fetchone())`
    : mode === "fetchmany"
      ? `print("fetchmany(${num(s, "n")}):", cur.fetchmany(${num(s, "n")}))
print("fetchmany(${num(s, "n")}) again:", cur.fetchmany(${num(s, "n")}))`
      : `print("fetchall():", cur.fetchall())
print("fetchall() again:", cur.fetchall())`
}`;
  } else if (op === "insert") {
    part =
      str(s, "insertMode") === "execute"
        ? `cur.execute("INSERT INTO students (name, marks) VALUES (?, ?)", ("Kiran", 82))
print("lastrowid:", cur.lastrowid)
print("rowcount:", cur.rowcount)
conn.commit()`
        : `new_students = [("Kiran", 82), ("Dev", 71), ("Ira", 99)]
cur.executemany("INSERT INTO students (name, marks) VALUES (?, ?)", new_students)
print("rowcount:", cur.rowcount)
conn.commit()`;
  } else if (op === "script") {
    part = `cur.executescript("""
    CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT);
    INSERT INTO courses (title) VALUES ('Python');
    INSERT INTO courses (title) VALUES ('Django');
""")
print("courses:", cur.execute("SELECT * FROM courses").fetchall())`;
  } else if (op === "transaction") {
    part = `cur.execute("UPDATE students SET marks = 0")      # oops: no WHERE clause
print("inside the transaction:", cur.execute("SELECT name, marks FROM students").fetchall())
conn.${str(s, "txMode") === "commit" ? "commit()      # make it permanent" : "rollback()    # undo everything since the last commit"}`;
  } else if (op === "changes") {
    part = `cur.execute("UPDATE students SET marks = marks + 5 WHERE marks < 90")
print("rowcount (last statement):", cur.rowcount)
cur.execute("DELETE FROM students WHERE name = 'John'")
print("rowcount (last statement):", cur.rowcount)
print("total_changes (whole connection):", conn.total_changes)
conn.commit()`;
  } else {
    part = bool(s, "safe")
      ? `name = ${py(str(s, "name"))}
# Safe: the value travels separately from the SQL
cur.execute("SELECT name, marks FROM students WHERE name = ?", (name,))
print("rows:", cur.fetchall())`
      : `name = ${py(str(s, "name"))}
# UNSAFE: the value is pasted into the SQL text
sql = f"SELECT name, marks FROM students WHERE name = '{name}'"
print("SQL sent:", sql)
cur.execute(sql)
print("rows:", cur.fetchall())`;
  }
  return `import os
import sqlite3

if os.path.exists("school.db"):
    os.remove("school.db")

conn = sqlite3.connect("school.db")
cur = conn.cursor()

# Set up a table with five students (this part is the same in every example)
cur.execute("CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, marks INTEGER)")
cur.executemany(
    "INSERT INTO students (name, marks) VALUES (?, ?)",
    [("Asha", 91), ("Ravi", 78), ("Meera", 88), ("John", 65), ("Sara", 95)],
)
conn.commit()

# ---- The part this example is about -----------------------------------
${part}
# ------------------------------------------------------------------------

conn.close()
`;
}

const sqliteLab: Lab = {
  slug: "sqlite3",
  title: "Python's sqlite3 module",
  file: "sqlite_demo.py",
  group: "Python",
  summary: "connect, cursor, execute, executemany, executescript, fetch*, commit, rollback, total_changes and SQL injection, one switch at a time.",
  chapter: "sqlite3",
  initial: { operation: "fetch", fetchMode: "fetchmany", n: 2, insertMode: "executemany", txMode: "rollback", safe: false, name: "' OR '1'='1" },
  controls: [
    {
      type: "select",
      key: "operation",
      label: "Show me",
      options: [
        { value: "fetch", label: "fetchone / fetchmany / fetchall" },
        { value: "insert", label: "execute vs executemany" },
        { value: "script", label: "executescript" },
        { value: "transaction", label: "commit vs rollback" },
        { value: "changes", label: "rowcount vs total_changes" },
        { value: "injection", label: "SQL injection & placeholders" },
      ],
    },
    {
      type: "segmented",
      key: "fetchMode",
      label: "Fetch with",
      options: ["fetchone", "fetchmany", "fetchall"].map((v) => ({ value: v, label: `${v}()` })),
      when: (s) => str(s, "operation") === "fetch",
    },
    { type: "number", key: "n", label: "fetchmany size", min: 1, max: 5, when: (s) => str(s, "operation") === "fetch" && str(s, "fetchMode") === "fetchmany" },
    {
      type: "segmented",
      key: "insertMode",
      label: "Insert with",
      options: [
        { value: "execute", label: "execute (one row)" },
        { value: "executemany", label: "executemany (many rows)" },
      ],
      when: (s) => str(s, "operation") === "insert",
    },
    {
      type: "segmented",
      key: "txMode",
      label: "Finish with",
      options: [
        { value: "commit", label: "conn.commit()" },
        { value: "rollback", label: "conn.rollback()" },
      ],
      when: (s) => str(s, "operation") === "transaction",
    },
    { type: "toggle", key: "safe", label: "Use a ? placeholder", when: (s) => str(s, "operation") === "injection" },
    { type: "text", key: "name", label: "Name typed by a user", mono: true, when: (s) => str(s, "operation") === "injection" },
  ],
  build: (s) => ({
    focus: "sqlite_demo.py",
    files: {
      "config/settings.py": settings({ apps: [] }),
      "config/urls.py": `urlpatterns = []
`,
      "sqlite_demo.py": sqliteCode(s),
    },
  }),
  probe: () => String.raw`
import io, os, sqlite3
from contextlib import redirect_stdout

os.chdir("/home/pyodide")
code = open("/home/pyodide/project/sqlite_demo.py").read()
out = io.StringIO()
error = None
with redirect_stdout(out):
    try:
        exec(compile(code, "sqlite_demo.py", "exec"), {"__name__": "__main__"})
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"

tables = {}
if os.path.exists("school.db"):
    check = sqlite3.connect("school.db")
    for (name,) in check.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
        cur = check.execute(f"SELECT * FROM {name}")
        tables[name] = [[d[0] for d in cur.description], [[str(v) for v in row] for row in cur.fetchall()]]
    check.close()
result = {"output": out.getvalue(), "error": error, "tables": tables}
`,
  present: (r) => {
    const tables = r.tables as Record<string, [string[], string[][]]>;
    return [
      { kind: "code", title: "Output", lang: "text", text: String(r.output) + (r.error ? `\n${r.error}` : "") },
      ...Object.entries(tables).map(([name, [columns, rows]]) => ({
        kind: "table" as const,
        title: `${name} table`,
        caption: "Read back with a brand-new connection after the script finished: this is what was really saved.",
        columns,
        rows,
      })),
    ];
  },
  notes: (s) => {
    const op = str(s, "operation");
    const notes: Record<string, string[]> = {
      fetch: [
        "After execute(), the cursor holds the result rows. Each fetch call continues where the previous one stopped.",
        "fetchone() returns one tuple or None; fetchmany(n) a list of up to n rows; fetchall() everything that's left (an empty list once used up).",
      ],
      insert: [
        "execute() runs one statement. lastrowid is the id of the inserted row.",
        "executemany() runs the same statement once per item in the list: faster and tidier than a loop.",
      ],
      script: ["executescript() runs several semicolon-separated statements at once. It doesn't take parameters, so never build it from user input."],
      transaction: [
        str(s, "txMode") === "commit"
          ? "commit() made the UPDATE permanent: every mark really is 0 now."
          : "rollback() undid the UPDATE: reading the table again shows the original marks.",
        "Changes are invisible to other connections and are lost on close() unless you commit().",
      ],
      changes: ["cursor.rowcount counts rows changed by the last statement; connection.total_changes counts every row changed since the connection opened (including the setup inserts)."],
      injection: [
        bool(s, "safe")
          ? "With a ? placeholder the input is only ever data: the strange name simply matches nobody."
          : "Pasting user input into SQL lets it rewrite the query: ' OR '1'='1 makes the WHERE clause always true, so every row leaks.",
        "Django's ORM always uses placeholders for you.",
      ],
    };
    return notes[op] ?? [];
  },
};

export const PYTHON_LABS = [sqliteLab];
