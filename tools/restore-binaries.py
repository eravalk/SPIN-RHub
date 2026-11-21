#!/usr/bin/env python3
"""Restore pinned binary dependencies for a Git checkout; no credentials required."""
import hashlib,json,os,tempfile,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'tools/binary-dependencies.json').read_text())
missing=[]
for name,digest in manifest['files'].items():
    p=ROOT/name
    if p.is_file():
        if hashlib.sha256(p.read_bytes()).hexdigest()!=digest:raise SystemExit('Local binary differs from pinned dependency: '+name)
    else:missing.append(name)
if not missing:
    print('Pinned binary dependencies already present');raise SystemExit(0)
with tempfile.TemporaryDirectory(prefix='spin-dependencies-') as tmp:
    archive=Path(tmp)/'source.zip';request=urllib.request.Request(manifest['source_url'],headers={'User-Agent':'SPIN-RHub-source-build'})
    with urllib.request.urlopen(request,timeout=60) as src,archive.open('wb') as out:
        while True:
            chunk=src.read(1024*1024)
            if not chunk:break
            out.write(chunk)
            if out.tell()>120*1024*1024:raise SystemExit('Dependency archive exceeds limit')
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=manifest['source_sha256']:raise SystemExit('Dependency archive SHA256 mismatch')
    with zipfile.ZipFile(archive) as z:
        for name in missing:
            target=ROOT/name
            if not target.resolve().is_relative_to(ROOT):raise SystemExit('Invalid dependency path')
            data=z.read('SPIN-RHub/'+name)
            if hashlib.sha256(data).hexdigest()!=manifest['files'][name]:raise SystemExit('Dependency SHA256 mismatch: '+name)
            target.parent.mkdir(parents=True,exist_ok=True)
            part=target.with_name(target.name+'.part');part.write_bytes(data);os.replace(part,target)
print('Restored',len(missing),'pinned binary dependencies')
