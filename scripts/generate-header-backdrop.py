"""Generate header decoration from public-domain Natural Earth 110m land polygons.
Usage: python3 scripts/generate-header-backdrop.py /path/to/ne_110m_land.geojson
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
"""
import json,math,sys
from pathlib import Path
geo=json.load(open(sys.argv[1]))
rings=[]
for f in geo['features']:
 cs=f['geometry']['coordinates']; cs=cs if f['geometry']['type']=='MultiPolygon' else [cs]
 for poly in cs:rings.append(poly[0])
def path(points):return 'M'+' '.join(f'{x:.1f},{y:.1f}' for x,y in points)+'Z'
world=' '.join(path([(180+(x+180)*2.4,10+(90-y)*1.35) for x,y in ring]) for ring in rings)
def project(lon,lat):
 lo,la=math.radians(lon-25),math.radians(lat); tilt=math.radians(27)
 front=math.sin(tilt)*math.sin(la)+math.cos(tilt)*math.cos(la)*math.cos(lo)
 return 1030+245*math.cos(la)*math.sin(lo),170-245*(math.cos(tilt)*math.sin(la)-math.sin(tilt)*math.cos(la)*math.cos(lo)),front
lands=[]
for ring in rings:
 pts=[(x,y) for lon,lat in ring for x,y,z in [project(lon,lat)] if z>0]
 if len(pts)>2:lands.append(path(pts))
s='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 426" preserveAspectRatio="xMidYMid slice">
<defs>
 <radialGradient id="red"><stop stop-color="#ef0018"/><stop offset=".5" stop-color="#a5000b"/><stop offset="1" stop-color="#5f0006"/></radialGradient>
 <radialGradient id="earth" cx=".7" cy=".15"><stop stop-color="#f7757f"/><stop offset=".5" stop-color="#b80a20"/><stop offset="1" stop-color="#6d0010"/></radialGradient>
 <linearGradient id="silver" x2=".2" y2="1"><stop stop-color="#fff"/><stop offset=".4" stop-color="#f8e7e8"/><stop offset="1" stop-color="#d89ca3"/></linearGradient>
 <linearGradient id="ribbon" x2=".3" y2="1"><stop stop-color="#ff5d6d"/><stop offset=".3" stop-color="#f4001b"/><stop offset=".7" stop-color="#940009"/><stop offset="1" stop-color="#ff5667"/></linearGradient>
 <radialGradient id="light"><stop stop-color="#fff"/><stop offset=".15" stop-color="#ffe4e8"/><stop offset=".4" stop-color="#ff5267" stop-opacity=".6"/><stop offset="1" stop-color="#ff304f" stop-opacity="0"/></radialGradient>
 <pattern id="dots" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#ffd1d7"/></pattern>
 <clipPath id="map"><path d="WORLD"/></clipPath>
 <clipPath id="orb"><circle cx="1030" cy="170" r="245"/></clipPath>
</defs>
<path fill="url(#red)" d="M0 0h1280v426H0z"/>
<rect width="1280" height="300" fill="url(#dots)" opacity=".18" clip-path="url(#map)"/>
<circle cx="1030" cy="170" r="245" fill="url(#earth)" stroke="#ffb8c1" stroke-width="2"/>
<g clip-path="url(#orb)">
 <path d="LANDS" fill="#f3c4cc" opacity=".48" stroke="#fff0f3" stroke-width=".6"/>
 <path d="LANDS" fill="url(#dots)" opacity=".8"/>
 <g fill="none" stroke="#ffbec8" opacity=".15">GRIDS</g>
</g>
<g fill="none" stroke="#ffdce1"><path d="M595 139Q824 -76 1110 75M683 80Q930 20 1234 220" opacity=".5" stroke-dasharray="3 5"/><path d="M782 165A250 250 0 0 1 1190 -13" stroke-width="3" opacity=".8"/></g>
LIGHTS
<path d="M0 0h325Q102 44 0 113Z" fill="url(#ribbon)"/><path d="M0 53Q160 1 325 0" fill="none" stroke="#ff8e98" opacity=".8"/>
<path d="M0 218Q178 377 490 294T915 338Q1095 340 1280 269V426H0Z" fill="url(#ribbon)"/>
<path d="M0 250Q153 356 392 332T782 362Q1022 413 1280 277V426H0Z" fill="url(#silver)"/>
<path d="M0 294Q190 401 401 366T748 412Q987 474 1280 326V426H0Z" fill="#fff" opacity=".65"/>
<path d="M0 301Q253 304 485 356T756 426H644Q442 366 207 351T0 329Z" fill="url(#ribbon)"/>
<path d="M0 250Q153 356 392 332T782 362Q1022 413 1280 277" fill="none" stroke="#fff5f5" stroke-width="3"/>
</svg>'''.replace('WORLD',world).replace('LANDS',' '.join(lands))
grids=[]
for lat in [-60,-30,0,30,60]:
 pts=[project(lo,lat) for lo in range(-155,206,3)];segs=[]
 for x,y,z in pts:
  if z>0:segs.append((x,y))
 if segs:grids.append('<path d="'+path(segs)[:-1]+'"/>')
for lon in range(-125,206,30):
 pts=[project(lon,la) for la in range(-90,91,3)]; segs=[(x,y) for x,y,z in pts if z>0]
 if segs:grids.append('<path d="'+path(segs)[:-1]+'"/>')
s=s.replace('GRIDS',''.join(grids)).replace('LIGHTS',''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#light)"/><circle cx="{x}" cy="{y}" r="2" fill="#fff"/>' for x,y,r in [(831,53,40),(1102,32,55),(970,119,28),(1230,157,38),(680,76,20)]))
Path('public/brand/rega24-header-backdrop.svg').write_text(s)
