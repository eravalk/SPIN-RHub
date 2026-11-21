#!/usr/bin/env python3
"""Run actual extractor -> full file -> FFmpeg decoding; never generate a pass on network errors."""
from pathlib import Path
import hashlib,json,os,subprocess,datetime
root=Path(__file__).resolve().parents[1]
files=[root/'app/src/main/java/com/spinplayer/app'/n for n in ['NetDownloader.java','OnlineExtractor.java','OnlineDownloads.java','MainActivity.java','DownloadsReceiver.java']]+sorted((root/'app/libs').glob('*.jar'))
fingerprint=hashlib.sha256(b''.join(p.read_bytes() for p in files)).hexdigest()
report={'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'module_fingerprint':fingerprint,'release_gate':'blocked','android_download_manager_verified':False,'sources':{s:{phase:False for phase in ['search','formats','download','decode']} for s in ['SoundCloud','YouTube']}}
compiler=os.environ.get('SPIN_ECJ_JAR')
if not compiler:raise SystemExit('Set SPIN_ECJ_JAR to the Eclipse compiler jar')
output=root/'tests/output';output.mkdir(exist_ok=True);cp=os.pathsep.join(str(p) for p in (root/'app/libs').glob('*.jar'))
subprocess.run(['java','-jar',compiler,'-17','-proc:none','-warn:none','-classpath',cp,'-d',str(output),str(files[0]),str(root/'tests/DownloadProbe.java')],check=True)
process=subprocess.run(['java','-cp',str(output)+os.pathsep+cp,'DownloadProbe',str(output/'audio')],text=True,capture_output=True,timeout=240)
phases={'SEARCH':'search','FORMATS':'formats','DOWNLOADED':'download','DECODED':'decode'}
for line in process.stdout.splitlines():
 print(line)
 parts=line.split('\t')
 if len(parts)>=2 and parts[0] in phases and parts[1] in report['sources']:report['sources'][parts[1]][phases[parts[0]]]=True
 if len(parts)>=4 and parts[0]=='FAILED':report['sources'][parts[1]]['blocked_phase']=parts[2];report['sources'][parts[1]]['error_type']=parts[3]
# Android storage must additionally be verified on a device/emulator; a JVM test cannot prove it.
path=root/'tests/legacy-extractor-probe.json';path.write_text(json.dumps(report,indent=2),encoding='utf-8')
raise SystemExit(0 if report['release_gate']=='passed' else 2)
