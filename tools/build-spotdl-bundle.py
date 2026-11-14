"""Package pinned pure-Python matching dependencies, without Android-incompatible native wheels."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('archives',type=Path)
parser.add_argument('spotdl_wheel',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets'
manifest=json.loads((args.archives/'manifest.json').read_text())
files={}
for item in manifest:
    archive=args.archives/item['file']
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==item['sha256'],item['name']
    if archive.suffix=='.whl':
        with zipfile.ZipFile(archive) as z:
            for name in z.namelist():
                if name.endswith('/') or name.endswith(('.so','.pyd','.pyc')): continue
                if '..' in Path(name).parts or Path(name).is_absolute(): raise ValueError(name)
                files[name]=z.read(name)
    else:
        with tarfile.open(archive) as tar:
            for entry in tar.getmembers():
                if not entry.isfile():continue
                name='/'.join(entry.name.split('/')[1:])
                if name.startswith('src/rapidfuzz/'): name=name[4:]
                keep=(name.startswith('rapidfuzz/') or name.startswith('jaconv/')) and not name.endswith(('.so','.pyd','.pyc','.cpp','.hpp','.h','.pyx','.pxd'))
                if keep:files[name]=tar.extractfile(entry).read()
                elif Path(name).name.lower().startswith(('license','copying')):files['licenses/'+item['name']+'-'+Path(name).name]=tar.extractfile(entry).read()
used=['types/song.py','types/result.py','utils/formatter.py','utils/matching.py','utils/logging.py']
with zipfile.ZipFile(args.spotdl_wheel) as z:
    for name in used:files['spotdl/'+name]=z.read('spotdl/'+name)
    for name in z.namelist():
        if '.dist-info/' in name and not name.endswith('/'):files[name]=z.read(name)
for name in ['spotdl/__init__.py','spotdl/types/__init__.py','spotdl/utils/__init__.py']:
    files[name]=b'"""SPIN embedded spotDL matching subset, version 4.6.0."""\n'
files['spotdl/utils/spotify.py']=b'class SpotifyClient:\n    def __new__(cls,*args,**kwargs):\n        raise RuntimeError("SPIN resolves catalog metadata natively; Python Spotify sessions are disabled")\n'
dest=assets/'spotdl-runtime.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for name,data in sorted(files.items()):z.writestr(name,data)
manifest.append({'name':'spotdl','version':'4.6.0','sha256':hashlib.sha256(args.spotdl_wheel.read_bytes()).hexdigest(),'modules':used,'scope':'unmodified matching modules with native catalog adapter'})
(assets/'spotdl-manifest.json').write_text(json.dumps({'engine':'spotDL','version':'4.6.0','bundle_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'dependencies':manifest},indent=2)+'\n')
print('Packaged',len(files),'pure-Python files;',dest.stat().st_size,'bytes')
