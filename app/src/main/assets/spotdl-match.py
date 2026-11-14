"""Run real spotDL matching with native-supplied metadata; no Spotify credentials enter Python."""
import json
import logging
import math
import os
import re
import sys

os.environ['RAPIDFUZZ_IMPLEMENTATION']='python'
logging.disable(logging.CRITICAL)

def setup():
    from spotdl.types.song import Song
    from spotdl.types.result import Result
    from spotdl.utils.matching import order_results
    return Song,Result,order_results

def bounded(value,limit=1000):
    return str(value or '')[:limit]

def artists(value):
    if isinstance(value,list):return [bounded(x,200) for x in value[:20] if x]
    return [s.strip() for s in bounded(value).split(',') if s.strip()][:20]

def rank(payload):
    Song,Result,order_results=setup()
    track=payload['track']
    people=artists(track.get('artists') or track.get('artist'))
    if not people or not track.get('name'):raise ValueError('Missing track metadata')
    song=Song(name=bounded(track['name']),artists=people,artist=people[0],genres=[],disc_number=1,disc_count=1,
              album_name=bounded(track.get('album')),album_artist=people[0],duration=int(float(track.get('duration') or 0)),
              year=0,date='',track_number=0,tracks_count=0,song_id='spin',explicit=False,publisher='',
              url=bounded(track.get('url')),isrc=None,cover_url=None,copyright_text=None)
    candidates=payload.get('candidates')
    if candidates is None:
        import requests
        from ytmusicapi import YTMusic
        session=requests.Session()
        if os.environ.get('SSL_CERT_FILE'):session.verify=os.environ['SSL_CERT_FILE']
        api=YTMusic(requests_session=session,language='en')
        raw=api.search(' '.join(people)+' '+song.name,filter='songs',limit=25,ignore_spelling=True)
        candidates=[]
        for item in raw[:30]:
            video=item.get('videoId','')
            if not re.fullmatch(r'[A-Za-z0-9_-]{11}',video):continue
            duration=item.get('duration_seconds')
            if duration is None:
                parts=str(item.get('duration') or '0').split(':')
                try:duration=sum(int(x)*60**i for i,x in enumerate(reversed(parts)))
                except ValueError:duration=0
            candidates.append(dict(name=item.get('title',''),artists=[a.get('name','') for a in item.get('artists',[])],
                                   artist=', '.join(a.get('name','') for a in item.get('artists',[])),duration=duration,
                                   url='https://music.youtube.com/watch?v='+video,verified=True,kind='track',service='YouTube Music',
                                   cover=next((t.get('url','') for t in reversed(item.get('thumbnails',[]))),'')))
    results=[]
    for index,item in enumerate(candidates[:80]):
        url=bounded(item.get('url'),2048)
        if not re.fullmatch(r'https://(?:(?:www|music)\.)?youtube\.com/watch\?v=[A-Za-z0-9_-]{11}',url):continue
        duration=float(item.get('duration') or 0)
        if not math.isfinite(duration) or duration<0:continue
        people=artists(item.get('artists') or item.get('artist'))
        result=Result(source='YouTubeMusic',url=url,verified=bool(item.get('verified')),name=bounded(item.get('name')),
                      duration=duration,author=people[0] if people else '',result_id=str(index),artists=tuple(people),views=0,
                      album=bounded(item.get('album')) or None)
        results.append((result,item))
    scores=order_results([r for r,_ in results],song)
    out=[]
    for result,item in results:
        score=float(scores.get(result,0))
        copy={key:item.get(key) for key in ['name','artist','artists','url','duration','cover','verified','kind','service'] if key in item}
        copy['spotdlScore']=max(0,min(100,score));copy['matcher']='spotDL 4.6.0';out.append(copy)
    out.sort(key=lambda item:item['spotdlScore'],reverse=True)
    return {'engine':'spotDL','version':'4.6.0','items':out[:20]}

def self_test():
    result=rank({'track':{'name':'Northbound','artist':'Example Band','duration':201},'candidates':[
        {'name':'Northbound','artist':'Example Band','duration':201,'url':'https://music.youtube.com/watch?v=abcdefghijk','verified':True},
        {'name':'Northbound live remix','artist':'Other Artist','duration':30,'url':'https://music.youtube.com/watch?v=lmnopqrstuv','verified':True}]})
    assert result['items'][0]['url'].endswith('abcdefghijk')
    assert result['items'][0]['spotdlScore']>result['items'][1]['spotdlScore']
    assert result['items'][0]['matcher']=='spotDL 4.6.0'
    return {'engine':'spotDL','version':'4.6.0','self_test':True}

if __name__=='__main__':
    try:
        if '--self-test' in sys.argv:output=self_test()
        else:
            raw=sys.stdin.buffer.read(2000001)
            if len(raw)>2000000:raise ValueError('Payload too large')
            output=rank(json.loads(raw))
        print(json.dumps(output,ensure_ascii=False))
    except Exception as error:
        # Do not echo raw URLs, query strings, tokens, server bodies or third-party exception messages.
        print(json.dumps({'error':'SpotDLMatchFailed','kind':type(error).__name__}))
        sys.exit(1)
