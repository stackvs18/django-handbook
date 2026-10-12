Django's ORM hides SQL from you, and most of the time that's exactly what you want. But it's worth knowing what's underneath. Python includes a built-in module, **`sqlite3`**, for talking to SQLite databases directly with SQL. It follows Python's standard database interface (**DB-API 2.0**), so the same ideas (`connect`, `cursor`, `execute`, `fetch`, `commit`) apply to PostgreSQL and MySQL drivers too.

This chapter covers every important `sqlite3` method, with a short example for each.

## The big picture

```flow
connect() | Open (or create) a database file and get a Connection
cursor() | Get a Cursor: the object that runs SQL and holds results
execute() / executemany() / executescript() | Run SQL statements
fetchone() / fetchmany() / fetchall() | Read rows returned by a SELECT
commit() or rollback() | Save or undo changes made since the last commit
close() | Release the connection
```

| Object | Method / attribute | Purpose |
|---|---|---|
| `sqlite3` module | `connect(path)` | Open a database, returns a `Connection` |
| `Connection` | `cursor()` | Create a `Cursor` |
| | `commit()` | Save the current transaction |
| | `rollback()` | Undo uncommitted changes |
| | `close()` | Close the connection |
| | `total_changes` | Rows changed since the connection opened |
| | `execute()`, `executemany()`, `executescript()` | Shortcuts that create a cursor for you |
| `Cursor` | `execute(sql, params)` | Run one statement |
| | `executemany(sql, seq)` | Run one statement for many parameter sets |
| | `executescript(sql)` | Run several statements at once |
| | `fetchone()` / `fetchmany(n)` / `fetchall()` | Read result rows |
| | `rowcount`, `lastrowid` | Rows affected, id of the last inserted row |

## connect()

```python
import sqlite3

conn = sqlite3.connect("school.db")      # creates the file if it doesn't exist
mem = sqlite3.connect(":memory:")        # a temporary database in RAM
```

You can open your Django project's database the same way: `sqlite3.connect("db.sqlite3")`.

## cursor()

```python
cur = conn.cursor()
```

A cursor runs statements and keeps track of results. You can have several cursors on one connection.

## execute()

Runs a **single** SQL statement:

```python
cur.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        name  TEXT NOT NULL,
        marks INTEGER
    )
""")

cur.execute("INSERT INTO students (name, marks) VALUES (?, ?)", ("Asha", 91))
print(cur.lastrowid)     # id of the new row, e.g. 1
conn.commit()
```

### Placeholders: always use them

```python
# ? placeholders with a tuple
cur.execute("SELECT * FROM students WHERE name = ?", (name,))

# named placeholders with a dict
cur.execute("SELECT * FROM students WHERE marks > :min", {"min": 80})
```

> [!CAUTION] Never format values into SQL
> `cur.execute(f"SELECT * FROM students WHERE name = '{name}'")` is an **SQL injection** hole. Placeholders send values separately so they can never be run as SQL. Note the comma in `(name,)`: a one-item tuple needs it.

## executemany()

Runs the same statement once per item in a sequence. Faster and cleaner than a loop of `execute()` calls:

```python
students = [("Ravi", 78), ("Meera", 88), ("John", 65), ("Sara", 95)]
cur.executemany("INSERT INTO students (name, marks) VALUES (?, ?)", students)
conn.commit()
print(cur.rowcount)      # 4 rows inserted
```

## executescript()

Runs **several** SQL statements separated by semicolons, all at once. Handy for setup scripts. It doesn't accept parameters.

```python
cur.executescript("""
    DROP TABLE IF EXISTS courses;
    CREATE TABLE courses (
        id    INTEGER PRIMARY KEY,
        title TEXT NOT NULL
    );
    INSERT INTO courses (title) VALUES ('Python');
    INSERT INTO courses (title) VALUES ('Django');
""")
```

> [!NOTE]
> In Python's default transaction mode, `executescript()` first commits any pending transaction, then runs the script as written. Never build its text from user input.

## fetchone(), fetchmany(), fetchall()

After a `SELECT`, the cursor holds the result rows. Read them in one of three ways:

```python
cur.execute("SELECT id, name, marks FROM students ORDER BY marks DESC")

top = cur.fetchone()          # the next single row, or None when no rows are left
print(top)                    # (5, 'Sara', 95)

next_two = cur.fetchmany(2)   # a list of up to 2 rows
print(next_two)               # [(1, 'Asha', 91), (3, 'Meera', 88)]

rest = cur.fetchall()         # a list of ALL remaining rows ([] if none)
print(rest)                   # [(2, 'Ravi', 78), (4, 'John', 65)]
```

| Method | Returns | When nothing is left |
|---|---|---|
| `fetchone()` | One row (a tuple) | `None` |
| `fetchmany(size)` | A list of up to `size` rows | `[]` |
| `fetchall()` | A list of all remaining rows | `[]` |

Each call continues where the previous one stopped. A cursor is also iterable, which is memory-friendly for big results:

```python
for row in cur.execute("SELECT name, marks FROM students"):
    print(row)
```

### Rows as dictionaries

By default rows are tuples. Set `row_factory` to access columns by name:

```python
conn.row_factory = sqlite3.Row
cur = conn.cursor()
row = cur.execute("SELECT * FROM students WHERE id = ?", (1,)).fetchone()
print(row["name"], row["marks"])    # Asha 91
print(dict(row))                    # {'id': 1, 'name': 'Asha', 'marks': 91}
```

## commit()

Changes from `INSERT`, `UPDATE` and `DELETE` happen inside a **transaction**. They're invisible to other connections and **lost when you close** unless you commit:

```python
cur.execute("UPDATE students SET marks = marks + 5 WHERE name = ?", ("John",))
conn.commit()      # now saved permanently
```

## rollback()

Undo every change made since the last `commit()`:

```python
try:
    cur.execute("UPDATE students SET marks = 0")           # oops, no WHERE!
    cur.execute("INSERT INTO students (name) VALUES (NULL)")   # fails: NOT NULL
    conn.commit()
except sqlite3.Error as e:
    print("Error:", e)
    conn.rollback()     # the first UPDATE is undone too
```

This all-or-nothing behaviour is what makes transactions safe.

## total_changes

A **connection** attribute: the total number of rows inserted, updated or deleted since the connection was opened.

```python
conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE t (x INTEGER)")
conn.executemany("INSERT INTO t VALUES (?)", [(1,), (2,), (3,)])
conn.execute("UPDATE t SET x = x * 10 WHERE x > 1")
print(conn.total_changes)    # 5  -> 3 inserts + 2 updates
```

Compare with `cursor.rowcount`, which reports rows affected by the **last** statement on that cursor.

## close()

```python
cur.close()
conn.close()
```

Closing does **not** commit. Uncommitted changes are discarded.

## Using with-blocks

A connection used in a `with` block **commits** if the block succeeds and **rolls back** if it raises. It does *not* close the connection, so close it yourself (or use `contextlib.closing`):

```python
import sqlite3
from contextlib import closing

with closing(sqlite3.connect("school.db")) as conn:
    with conn:                                      # transaction
        conn.execute("INSERT INTO students (name, marks) VALUES (?, ?)", ("Kiran", 82))
        conn.execute("UPDATE students SET marks = 99 WHERE name = ?", ("Kiran",))
    # committed here; if anything had failed, both statements would be rolled back
```

## A complete CRUD program

```python title="students_crud.py"
import sqlite3

DB = "school.db"


def setup():
    with sqlite3.connect(DB) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS students (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT NOT NULL,
                marks INTEGER CHECK (marks BETWEEN 0 AND 100)
            );
        """)


def create(name, marks):
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("INSERT INTO students (name, marks) VALUES (?, ?)", (name, marks))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def read_all():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM students ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def read_one(student_id):
    conn = sqlite3.connect(DB)
    row = conn.execute("SELECT id, name, marks FROM students WHERE id = ?", (student_id,)).fetchone()
    conn.close()
    return row          # a tuple, or None


def update(student_id, marks):
    conn = sqlite3.connect(DB)
    cur = conn.execute("UPDATE students SET marks = ? WHERE id = ?", (marks, student_id))
    conn.commit()
    conn.close()
    return cur.rowcount   # 1 if updated, 0 if no such id


def delete(student_id):
    conn = sqlite3.connect(DB)
    cur = conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
    conn.commit()
    conn.close()
    return cur.rowcount


if __name__ == "__main__":
    setup()
    sid = create("Asha", 91)
    print("Created", sid)
    print("All:", read_all())
    print("Updated rows:", update(sid, 95))
    print("One:", read_one(sid))
    print("Deleted rows:", delete(sid))
```

## sqlite3 and Django

Django uses the same `sqlite3` module internally when `ENGINE` is `django.db.backends.sqlite3`. A few ways the two meet:

**Peek inside your Django database:**

```python
import sqlite3

conn = sqlite3.connect("db.sqlite3")
tables = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
print(tables)       # [('django_migrations',), ('auth_user',), ('playerapp_player',), ...]
print(conn.execute("SELECT id, name, runs FROM playerapp_player").fetchall())
conn.close()
```

**Open the database shell:** `python manage.py dbshell` (needs the `sqlite3` command-line program installed).

**Raw SQL inside Django** uses Django's own connection, with `%s` placeholders whatever the database:

```python
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("UPDATE playerapp_player SET runs = runs + %s WHERE id = %s", [50, 1])
    cursor.execute("SELECT name, runs FROM playerapp_player WHERE runs > %s", [5000])
    rows = cursor.fetchall()
```

| | Python `sqlite3` | Django ORM |
|---|---|---|
| Language | SQL strings | Python methods |
| Placeholders | `?` or `:name` | Automatic (`%s` in raw Django SQL) |
| Transactions | `commit()` / `rollback()` yourself | Autocommit; `transaction.atomic()` for blocks |
| Databases | SQLite only | SQLite, PostgreSQL, MySQL, Oracle... |
| Results | Tuples (or `sqlite3.Row`) | Model instances |

## Summary

| Method | Belongs to | Does |
|---|---|---|
| `connect()` | module | Opens a database |
| `cursor()` | connection | Creates a cursor |
| `execute()` | cursor / connection | Runs one statement |
| `executemany()` | cursor / connection | Runs one statement for many parameter sets |
| `executescript()` | cursor / connection | Runs multiple statements |
| `fetchone()` | cursor | Next row or `None` |
| `fetchmany(n)` | cursor | Up to n rows |
| `fetchall()` | cursor | All remaining rows |
| `commit()` | connection | Saves the transaction |
| `rollback()` | connection | Undoes uncommitted changes |
| `total_changes` | connection | Total rows changed since opening |
| `close()` | connection / cursor | Closes it (doesn't commit) |

## Check yourself

<details>
<summary>What's the difference between <code>execute()</code>, <code>executemany()</code> and <code>executescript()</code>?</summary>

`execute()` runs one statement (with optional parameters). `executemany()` runs one statement repeatedly, once per parameter set. `executescript()` runs several semicolon-separated statements in one go, without parameters.
</details>

<details>
<summary>What does <code>fetchone()</code> return when there are no more rows?</summary>

`None`. (`fetchmany()` and `fetchall()` return an empty list.)
</details>

<details>
<summary>You inserted rows, closed the connection, and the rows are gone. Why?</summary>

You didn't call `conn.commit()`. Closing a connection discards uncommitted changes.
</details>

<details>
<summary>What's the difference between <code>total_changes</code> and <code>rowcount</code>?</summary>

`connection.total_changes` counts all rows modified since the connection opened. `cursor.rowcount` counts rows affected by the most recent statement on that cursor.
</details>
