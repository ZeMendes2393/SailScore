import sqlite3, os
db_path = os.path.abspath("test.db")
con = sqlite3.connect(db_path)
cur = con.cursor()

# Lista tabelas temporárias do Alembic
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '_alembic_tmp%';")
tmp_tables = [r[0] for r in cur.fetchall()]
print("TMP tables:", tmp_tables)

# Apaga todas as _alembic_tmp_* (inclui a _alembic_tmp_hearings)
for t in tmp_tables:
    cur.execute(f'DROP TABLE IF EXISTS "{t}"')

con.commit()
con.close()
print("OK: temporárias limpas.")
