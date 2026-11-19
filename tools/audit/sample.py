"""Sequential, one-request-per-second archive corpus acquisition through our cache only."""
import json,time,urllib.request,urllib.parse,pathlib,random
ROOT=pathlib.Path('/tmp/dialup-audit'); ROOT.mkdir(exist_ok=True)
last=0

def request(path):
 global last
 time.sleep(max(0,1-(time.monotonic()-last)));last=time.monotonic()
 with urllib.request.urlopen('http://localhost:8080'+path,timeout=90) as r:return r.read()
def api(path):return json.loads(request('/api/public/archive/json?path='+urllib.parse.quote(path,safe='')))
manifest=[]
years=api('/v1/year/')
years=sorted(int(y) for y in years if int(y)>=1990)
for year in years:
 try:
  packs=api(f'/v1/year/{year}?pagesize=60&page=1')['results']
  if not packs: packs=api(f'/v1/year/{year}?pagesize=60&page=2')['results']
  random.Random(year).shuffle(packs)
  remaining= max(9,round(304/len(years)))
  for p in packs[:8]:
   pack=p['name']; info=api(f'/v1/pack/{pack}?sauce=true&filesize=true')['results'][0]
   candidates=list(info.get('files',{}).items())
   random.Random(pack).shuffle(candidates)
   candidates.sort(key=lambda kv: 0 if pathlib.Path(kv[0]).suffix.lower() in ('.ans','.ice','.asc','.pcb','.avt','.bin','.xb','.adf','.idf','.tnd','') else 1)
   for name,meta in candidates[:min(remaining,4)]:
    try:
     data=request('/api/public/archive/raw?'+urllib.parse.urlencode({'pack':pack,'file':name}))
     ident=f'{len(manifest):03d}.raw';(ROOT/ident).write_bytes(data)
     manifest.append({'year':year,'pack':pack,'file':name,'local':ident,'meta':meta})
     (ROOT/'manifest.json').write_text(json.dumps(manifest))
     print(len(manifest),year,pack,name,len(data),flush=True);remaining-=1
    except Exception as e:print('FILE ERROR',pack,name,str(e),flush=True)
    if remaining<=0:break
   if remaining<=0:break
 except Exception as e: print('YEAR ERROR',year,str(e),flush=True)
print('DONE',len(manifest),flush=True)
