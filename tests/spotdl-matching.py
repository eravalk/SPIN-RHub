"""Offline integration against the actual packaged spotDL modules, not a mock."""
import hashlib,json,os,subprocess,sys,tempfile,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets'
manifest=json.loads((assets/'spotdl-manifest.json').read_text())
assert hashlib.sha256((assets/'spotdl-runtime.zip').read_bytes()).hexdigest()==manifest['bundle_sha256']
with tempfile.TemporaryDirectory(prefix='spin-spotdl-') as scratch:
    for archive in ['spotdl-runtime.zip','yt-engine.zip']:
        with zipfile.ZipFile(assets/archive) as z:
            assert not any(n.endswith(('.so','.pyd')) or '..' in Path(n).parts for n in z.namelist())
            z.extractall(scratch)
    env=dict(os.environ,PYTHONPATH=scratch,PYTHONNOUSERSITE='1',RAPIDFUZZ_IMPLEMENTATION='python')
    script=assets/'spotdl-match.py'
    def run(payload=None,*args):
        p=subprocess.run([sys.executable,str(script),*args],input=json.dumps(payload) if payload is not None else '',text=True,capture_output=True,env=env,timeout=30)
        return p,json.loads(p.stdout)
    p,data=run(None,'--self-test');assert p.returncode==0 and data['self_test']
    track={'name':'Northbound','artist':'Example Band','duration':201}
    candidates=[{'name':'Northbound','artist':'Example Band','duration':201,'url':'https://music.youtube.com/watch?v=abcdefghijk','verified':True},
                {'name':'Northbound live remix','artist':'Someone Else','duration':30,'url':'https://music.youtube.com/watch?v=lmnopqrstuv'},
                {'name':'Northbound','artist':'Example Band','duration':201,'url':'https://evil.example/watch?v=abcdefghijk'}]
    p,data=run({'track':track,'candidates':candidates});assert p.returncode==0
    assert len(data['items'])==2 and data['items'][0]['spotdlScore']>=80 and data['items'][0]['url'].endswith('abcdefghijk')
    assert all(item['matcher']=='spotDL 4.6.0' for item in data['items'])
    p,data=run({'track':{},'candidates':[]});assert p.returncode!=0 and data['error']=='SpotDLMatchFailed' and 'Traceback' not in p.stdout
    # The embedded package deliberately prohibits Python Spotify authentication.
    p=subprocess.run([sys.executable,'-c','from spotdl.utils.spotify import SpotifyClient; SpotifyClient()'],env=env,capture_output=True,text=True)
    assert p.returncode!=0 and 'sessions are disabled' in p.stderr
print('PASS: real bundled spotDL matching, SHA256, score, URL guard, sanitized failures and disabled Python Spotify authentication')
