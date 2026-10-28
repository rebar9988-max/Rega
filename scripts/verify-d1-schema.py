"""Exercise the staged schema in disposable, in-memory SQLite; no network access."""
import re
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parent.parent
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript((root / "prisma/d1/migrations/0001_initial.sql").read_text())
source = (root / "prisma/schema.prisma").read_text()
models = re.findall(r"model (\w+) \{(.*?)\n\}", source, re.S)
scalars = {"String", "DateTime", "Int", "Float", "Decimal", "Boolean", "Json", "Role"}
for name, body in models:
    expected = {m[0] for m in re.findall(r"^\s+(\w+)\s+(\w+)[?\[\]]*\s", body, re.M) if m[1] in scalars}
    actual = {row[1] for row in db.execute(f'PRAGMA table_info("{name}")')}
    assert expected == actual, (name, expected - actual, actual - expected)

db.execute('INSERT INTO "Business" (id,slug,name,updatedAt) VALUES (?,?,?,?)', ("test", "test", "ڕێگا", "2026-10-27"))
assert db.execute('SELECT tags,languages,photos,name FROM "Business"').fetchone() == ("[]", "[]", "[]", "ڕێگا")
db.execute('INSERT INTO "Offer" (id,businessId,title,startsAt,endsAt,updatedAt) VALUES (?,?,?,?,?,?)', ("o", "test", "test", "2026-10-27", "2026-10-28", "2026-10-27"))
for query in [
    'UPDATE "Offer" SET endsAt=startsAt',
    "UPDATE Offer SET discountType='percent',discountValue=91",
    "UPDATE Offer SET discountType='amount',discountValue=1",
    "UPDATE Offer SET businessId='missing'",
    "INSERT INTO User (id,email,role,updatedAt) VALUES ('u','test@example.invalid','UNKNOWN','2026-10-27')",
]:
    try:
        db.execute(query)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError(f"Constraint failed to reject: {query}")
db.execute("DELETE FROM Business WHERE id='test'")
assert db.execute("SELECT count(*) FROM Offer").fetchone()[0] == 0
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
print(f"PASS: {len(models)} models/all scalar columns, JSON defaults, Kurdish text, Offer/role constraints, FK rejection and cascade.")
print("SQLite rehearsal only; remote D1 and application runtime have not been certified.")
