from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parents[1]
e=json.loads((r/'tests/download-validation.json').read_text())
assert e['release_kind']=='alpha-integration' and e['runtime_device_verified']
assert e['experimental_soundcloud'] and not e['spotify_enabled']
assert not e['main_app_device_verified'], 'Do not claim unperformed Android integration validation'
for name,expected in e['runtime_sha256'].items():
 assert hashlib.sha256((r/'app/src/main/assets'/name).read_bytes()).hexdigest()==expected, 'Runtime changed since device test: '+name
assert e['evidence']['album_saved']==14 and e['evidence']['album_failed']==0
print('Verified diagnostic runtime retained. Main-app integration is alpha; SoundCloud experimental; offline test pending.')
