#!/usr/bin/env python3
"""Read-only, dependency-free checks for the Rega24 architecture snapshot."""
from pathlib import Path
import json
import re
import subprocess
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent


def validate():
    data = json.loads((HERE / 'evidence.json').read_text())
    # Evidence is always checked against the pinned source, not a moving HEAD.
    sha = data['sourceCommit']
    assert re.fullmatch(r'[0-9a-f]{40}', sha), 'Invalid source SHA'

    def source(path):
        assert not path.startswith('/') and '..' not in Path(path).parts
        return subprocess.check_output(['git', 'show', f'{sha}:{path}'], cwd=REPO, text=True)

    cached = {}
    def read(path):
        if path not in cached:
            cached[path] = source(path)
        return cached[path]

    xml = ET.parse(HERE / 'rega24-system.drawio').getroot()
    assert xml.tag == 'mxfile'
    pages = xml.findall('diagram')
    assert len(pages) == len(data['pages']) == 12
    records = {r['id']: r for r in data['records']}
    assert len(records) == len(data['records'])
    semantic = set()
    for page in pages:
        assert page.get('name') and page.find('mxGraphModel') is not None
        cells = page.findall('./mxGraphModel/root/mxCell')
        by_id = {c.get('id'): c for c in cells}
        assert len(by_id) == len(cells), f'Duplicate IDs in {page.get("id")}'
        rects = []
        for c in cells:
            uid = c.get('id')
            if uid in ['0', '1']:
                continue
            assert c.get('parent') in by_id
            g = c.find('mxGeometry')
            assert g is not None
            if c.get('edge') == '1':
                assert c.get('source') in by_id and c.get('target') in by_id
                assert g.get('relative') == '1'
                assert uid in records and c.get('value')
            else:
                x,y,w,h = [float(g.get(k, 0)) for k in ['x','y','width','height']]
                assert min(x,y) >= 0 and min(w,h) > 0
                assert x+w <= float(page.find('mxGraphModel').get('pageWidth'))
                assert y+h <= float(page.find('mxGraphModel').get('pageHeight'))
                if uid in records:
                    rects.append((uid,x,y,w,h))
            if uid in records:
                semantic.add(uid)
        for i,(a,x,y,w,h) in enumerate(rects):
            for b,u,v,s,t in rects[i+1:]:
                assert x+w <= u or u+s <= x or y+h <= v or v+t <= y, f'Node overlap: {a}, {b}'
    assert semantic == set(records), 'Diagram/evidence cell mismatch'
    for r in records.values():
        assert r['status'] in ['CODE','CONFIG','LIVE','PLANNED','UNKNOWN']
        assert r['evidence']
        for e in r['evidence']:
            if 'path' in e:
                lines = read(e['path']).splitlines()
                assert 1 <= e['line'] <= len(lines)
                if e['symbol'] != '(file)':
                    assert e['symbol'] in lines[e['line']-1], (r['id'], e)
            else:
                assert e['method'] == 'GET' and e['observed'] and e['live'].startswith('/')
    schema = read('prisma/schema.prisma')
    models = set(re.findall(r'^model (\w+) \{', schema, re.M))
    assert models == set(data['models'])
    diagram_models = {r['label'].split('\n')[0] for r in records.values() if r['kind']=='node' and r['page'].startswith('database')}
    assert models == diagram_models, 'Missing schema model'
    declarations = [l.strip() for l in schema.splitlines() if '@relation(' in l and 'fields:' in l]
    assert sorted(declarations) == sorted(r['declaration'] for r in data['relations'])
    relation_evidence = {e['symbol'] for r in records.values() if r['kind']=='edge' and r['page'].startswith('database') for e in r['evidence']}
    assert set(declarations) <= relation_evidence, 'Missing database FK edge'
    for path in HERE.rglob('*'):
        if not path.is_file() or path.suffix not in ['.md','.json','.drawio','.py']:
            continue
        text = path.read_text()
        if path.suffix != '.py':
            for pattern in [r'AKIA[0-9A-Z]{16}',r'sk-[A-Za-z0-9_-]{20,}',r'postgres(?:ql)?://[^:\s]+:[^\s@]+@',r'-----BEGIN [A-Z ]*PRIVATE KEY-----']:
                assert not re.search(pattern,text), f'Possible credential in {path.name}'
        if path.suffix == '.md':
            for target in re.findall(r'\[[^\]]+\]\(([^\s)]+)\)',text):
                if re.match(r'https?://|mailto:|#',target):
                    continue
                assert (path.parent/target.split('#')[0]).exists(), f'Broken local link: {target}'
    print(f'PASS: {len(pages)} pages; {len(records)} semantic cells; {len(models)} models; {len(declarations)} FK relations; evidence, geometry, links and credential patterns.')


if __name__ == '__main__':
    validate()
