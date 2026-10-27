"""Verify a private export in in-memory SQLite, including every row's typed hash."""
import hashlib
import json
import re
import sqlite3
import struct
import sys
from decimal import Decimal
from pathlib import Path


def verify(folder):
    root = Path(__file__).resolve().parent.parent
    manifest = json.loads((folder / "manifest.json").read_text())
    sql = (folder / "data.sql").read_bytes()
    assert manifest["format"] == 1 and manifest["project"] == "REGA", "Wrong export identity"
    assert hashlib.sha256(sql).hexdigest() == manifest["sqlSha256"], "Export checksum mismatch"
    assert hashlib.sha256((root / "prisma/schema.prisma").read_bytes()).hexdigest() == manifest["schemaSha256"], "Source schema changed; regenerate candidate and export"
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript((root / "prisma/d1/migrations/0001_initial.sql").read_text())
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert tables == {t["name"] for t in manifest["tables"]}, "Table coverage mismatch"

    # The data file can only insert into this memory database; reject file access/schema changes.
    def authorize(action, arg1, arg2, _database, _trigger):
        if action in {sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH, sqlite3.SQLITE_CREATE_TABLE,
                      sqlite3.SQLITE_DROP_TABLE, sqlite3.SQLITE_ALTER_TABLE, sqlite3.SQLITE_CREATE_TRIGGER,
                      sqlite3.SQLITE_DROP_TRIGGER, sqlite3.SQLITE_UPDATE, sqlite3.SQLITE_DELETE}:
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_PRAGMA and not (arg1 == "defer_foreign_keys" and str(arg2).lower() in {"on", "1"}):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_FUNCTION and arg2 == "load_extension":
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    db.set_authorizer(authorize)
    db.executescript("BEGIN;\n" + sql.decode("utf8"))
    db.set_authorizer(None)
    assert db.execute("PRAGMA foreign_key_check").fetchall() == [], "Foreign-key mismatch"
    db.commit()
    total = 0
    for table in manifest["tables"]:
        names = [table["name"]] + [f["name"] for f in table["fields"]]
        assert all(re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", n) for n in names), "Invalid identifier"
        columns = ",".join('"' + f["name"] + '"' for f in table["fields"])
        hashes = []
        for row in db.execute(f'SELECT {columns} FROM "{table["name"]}"'):
            cells = []
            for field, value in zip(table["fields"], row):
                if value is None:
                    cell = "null"
                elif field["type"] == "Float":
                    cell = "f:" + struct.pack(">d", 0 if value == 0 else value).hex()
                elif field["type"] == "Decimal":
                    cell = "d:" + format(Decimal(str(value)).quantize(Decimal("0.01")), "f")
                else:
                    cell = ("i:" if isinstance(value, int) else "s:") + str(value)
                cells.append(cell)
            raw = json.dumps(cells, ensure_ascii=False, separators=(",", ":")).encode("utf8")
            hashes.append(hashlib.sha256(raw).hexdigest())
        assert len(hashes) == table["count"], f'Row-count mismatch: {table["name"]}'
        assert hashlib.sha256("\n".join(sorted(hashes)).encode()).hexdigest() == table["sha256"], f'Typed row-hash mismatch: {table["name"]}'
        total += len(hashes)
    print(f"PASS: {len(tables)} tables, {total} rows, every typed row hash, export checksum and foreign keys. Local rehearsal only.")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("private export directory required")
        verify(Path(sys.argv[1]))
    except Exception:
        # Never echo database exceptions, SQL or data values into logs.
        print("Export verification FAILED; inspect the private source and manifest locally. No remote changes.", file=sys.stderr)
        sys.exit(1)
