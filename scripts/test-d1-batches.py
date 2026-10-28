"""Regression: CRLFs inside quoted SQL values must survive preparation byte for byte."""
import importlib.util
import sqlite3
from pathlib import Path

spec = importlib.util.spec_from_file_location("prepare_d1_batches", Path(__file__).with_name("prepare-d1-batches.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
value = "ڕێگا\r\nO'Reilly\r\nline two\nline three\rfinal"
sql = "INSERT INTO sample(value) VALUES ('" + value.replace("'", "''") + "');\n"
raw = ("-- Generated private test fixture\nPRAGMA defer_foreign_keys=ON;\n" + sql * 3).encode("utf8")
parts = module.batches(raw, max_bytes=160)
db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE sample(value TEXT NOT NULL)")
for part in parts:
    db.executescript(part.decode("utf8"))
assert db.execute("SELECT value FROM sample").fetchall() == [(value,)] * 3
assert len(parts) > 1
print("PASS: batch splitting preserves CRLF, LF, CR, Unicode and escaped quotes across chunks.")
