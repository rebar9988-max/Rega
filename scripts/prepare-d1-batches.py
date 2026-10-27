"""Split an already generated private SQL export without changing embedded CR/LF text."""
import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path


def batches(raw, max_bytes=25000):
    statements = []
    pending = ""
    for line in raw.decode("utf8").splitlines(keepends=True):
        pending += line
        if sqlite3.complete_statement(pending):
            statements.append(pending)
            pending = ""
    if pending.strip():
        raise ValueError("Incomplete generated SQL statement")
    prefix = "PRAGMA defer_foreign_keys=ON;\n"
    result, current = [], prefix
    for statement in statements:
        if "INSERT INTO" not in statement:
            continue
        if len((current + statement).encode("utf8")) > max_bytes and current != prefix:
            result.append(current.encode("utf8"))
            current = prefix
        current += statement
    if current != prefix:
        result.append(current.encode("utf8"))
    return result


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare-d1-batches.py private-export-folder private-output-folder")
    source, target = map(Path, sys.argv[1:])
    manifest = json.loads((source / "manifest.json").read_bytes())
    raw = (source / "data.sql").read_bytes()
    if hashlib.sha256(raw).hexdigest() != manifest["sqlSha256"]:
        raise SystemExit("Export checksum mismatch; no batches written")
    target.mkdir(mode=0o700, parents=True, exist_ok=False)
    os.chmod(target, 0o700)
    records = []
    for i, content in enumerate(batches(raw)):
        path = target / f"batch-{i:03d}.sql"
        path.write_bytes(content)
        os.chmod(path, 0o600)
        records.append({"file": path.name, "sha256": hashlib.sha256(content).hexdigest()})
    (target / "batches.json").write_text(json.dumps(records))
    os.chmod(target / "batches.json", 0o600)
    print(f"Prepared {len(records)} byte-preserving private import batches.")
