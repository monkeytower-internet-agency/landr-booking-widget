#!/usr/bin/env python3
"""Generate the comic demo-product art: public/demo/<template>/<product>-<n>.svg.

Demo mode only (src/api/demo.ts). Run from the repo root: python3 scripts/gen-demo-art.py
"""
import os, random

W, H = 800, 600
INK = "#1f2a44"
PALS = [  # day, golden hour, dusk
    dict(sky1="#7cc4ff", sky2="#d8f0ff", sun="#ffe27a", hill1="#5fbf7a", hill2="#3e9e68", hill3="#2f7d57", water="#4aa8d8", wall="#fff4e0", floor="#d9a066", acc="#ff7a3d"),
    dict(sky1="#ffb36b", sky2="#ffe3b0", sun="#fff2a8", hill1="#e0a35a", hill2="#b9783f", hill3="#8a5a35", water="#f0a070", wall="#ffe9cf", floor="#c98a52", acc="#e2483d"),
    dict(sky1="#5b4fa8", sky2="#f2a0b8", sun="#ffd6a0", hill1="#46528f", hill2="#323c78", hill3="#262d5e", water="#6a62b8", wall="#e6dcf5", floor="#8a6a9a", acc="#ffb23d"),
]

def cloud(x, y, s=1.0):
    return (f'<g transform="translate({x} {y}) scale({s})" fill="#fff" stroke="{INK}" stroke-width="3">'
            '<path d="M0 30 a22 22 0 0 1 20-24 a28 28 0 0 1 52 4 a20 20 0 0 1 6 40 H14 a16 16 0 0 1-14-20z"/></g>')

def sky(p, v, rnd):
    s = f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{p["sky1"]}"/><stop offset="1" stop-color="{p["sky2"]}"/></linearGradient></defs>'
    s += f'<rect width="{W}" height="{H}" fill="url(#g)"/>'
    sx = [620, 160, 400][v]
    s += f'<circle cx="{sx}" cy="{[110, 330, 300][v]}" r="52" fill="{p["sun"]}" stroke="{INK}" stroke-width="4"/>'
    for _ in range(3):
        s += cloud(rnd.randint(20, 640), rnd.randint(40, 220), rnd.uniform(.8, 1.5))
    return s

def hills(p, base=380):
    return (f'<path d="M0 {base} Q150 {base-130} 320 {base-40} T640 {base-90} T800 {base-20} V600 H0z" fill="{p["hill1"]}" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M0 {base+70} Q200 {base-30} 420 {base+40} T800 {base+10} V600 H0z" fill="{p["hill2"]}" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M0 {base+150} Q260 {base+60} 520 {base+130} T800 {base+100} V600 H0z" fill="{p["hill3"]}" stroke="{INK}" stroke-width="4"/>')

def person(x, y, shirt, s=1.0, arms_up=False):
    a = (f'<path d="M-14 -34 L-30 -64 M14 -34 L30 -64" stroke="{INK}" stroke-width="5" fill="none" stroke-linecap="round"/>' if arms_up
         else f'<path d="M-14 -34 L-24 -10 M14 -34 L24 -10" stroke="{INK}" stroke-width="5" fill="none" stroke-linecap="round"/>')
    return (f'<g transform="translate({x} {y}) scale({s})">{a}'
            f'<rect x="-16" y="-48" width="32" height="40" rx="10" fill="{shirt}" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M-9 -8 V24 M9 -8 V24" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>'
            f'<circle cx="0" cy="-64" r="15" fill="#ffd2a8" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M-15 -68 a15 15 0 0 1 30 0z" fill="{INK}"/></g>')

def glider(x, y, col, s=1.0, tandem=True):
    lines = ''.join(f'<path d="M{x+dx*s} {y+4*s} L{x+(dx*.15)*s} {y+110*s}" stroke="{INK}" stroke-width="1.6"/>' for dx in (-120, -60, 0, 60, 120))
    canopy = (f'<path d="M{x-135*s} {y+10*s} Q{x} {y-70*s} {x+135*s} {y+10*s} Q{x} {y+30*s} {x-135*s} {y+10*s}z" fill="{col}" stroke="{INK}" stroke-width="4"/>'
              f'<path d="M{x-70*s} {y-14*s} Q{x-65*s} {y+12*s} {x-60*s} {y+22*s} M{x} {y-24*s} V{y+26*s} M{x+70*s} {y-14*s} Q{x+65*s} {y+12*s} {x+60*s} {y+22*s}" stroke="{INK}" stroke-width="3" fill="none"/>')
    body = person(x, y + 150 * s, "#ff5d73", .62 * s)
    if tandem:
        body += person(x + 34 * s, y + 154 * s, "#3b82f6", .55 * s)
    return lines + canopy + body

def kayak(x, y, col, s=1.0):
    return (f'<g transform="translate({x} {y}) scale({s})"><path d="M-120 0 Q0 24 120 0 Q0 -22 -120 0z" fill="{col}" stroke="{INK}" stroke-width="4"/>'
            + person(0, -8, "#ffd23d", .7).replace('<g transform', '<g transform') +
            f'<path d="M-60 -40 L70 20" stroke="{INK}" stroke-width="5"/><ellipse cx="-62" cy="-42" rx="14" ry="7" fill="{col}" stroke="{INK}" stroke-width="3"/><ellipse cx="72" cy="22" rx="14" ry="7" fill="{col}" stroke="{INK}" stroke-width="3"/></g>')

def waves(p, y0=380):
    s = f'<rect y="{y0}" width="{W}" height="{H-y0}" fill="{p["water"]}"/>'
    for i in range(5):
        y = y0 + 25 + i * 38
        s += f'<path d="M0 {y} q40 -18 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>'
    return s

def bike(x, y, col, s=1.0, electric=False):
    g = f'<g transform="translate({x} {y}) scale({s})" stroke="{INK}" stroke-width="5" fill="none" stroke-linecap="round">'
    g += '<circle cx="-70" cy="0" r="46" fill="#fff"/><circle cx="70" cy="0" r="46" fill="#fff"/>'
    g += f'<path d="M-70 0 L-20 -70 L50 -70 L70 0 M-20 -70 L10 0 L-70 0 M10 0 L50 -70" stroke="{col}" stroke-width="7"/>'
    g += f'<path d="M-30 -86 H-5 M50 -70 L44 -96 H66" />'
    if electric:
        g += f'<rect x="-12" y="-58" width="34" height="18" rx="5" fill="#2dd4a0" stroke="{INK}" stroke-width="4"/>'
    return g + '</g>'

def car(x, y, col, s=1.0):
    return (f'<g transform="translate({x} {y}) scale({s})" stroke="{INK}" stroke-width="5" stroke-linejoin="round">'
            f'<path d="M-130 0 V-40 Q-120 -52 -90 -56 L-55 -96 H45 L85 -56 Q125 -52 135 -38 V0z" fill="{col}"/>'
            '<path d="M-48 -88 H-8 V-58 H-78z M8 -88 H38 L70 -58 H8z" fill="#cfeeff"/>'
            '<circle cx="-75" cy="2" r="26" fill="#2b2b3a"/><circle cx="85" cy="2" r="26" fill="#2b2b3a"/>'
            '<circle cx="-75" cy="2" r="10" fill="#ddd"/><circle cx="85" cy="2" r="10" fill="#ddd"/>'
            '<rect x="-44" y="-132" width="60" height="22" rx="4" fill="#fff"/><path d="M-36 -121 H8" stroke-width="4"/></g>')

def road(p, y0=400):
    s = f'<rect y="{y0}" width="{W}" height="{H-y0}" fill="#4a4f60"/>'
    s += f'<path d="M0 {y0+90} H800" stroke="#fff" stroke-width="6" stroke-dasharray="40 30"/>'
    return s

def room(p, v):
    s = f'<rect width="{W}" height="{H}" fill="{p["wall"]}"/><rect y="440" width="{W}" height="160" fill="{p["floor"]}" stroke="{INK}" stroke-width="4"/>'
    wx = [470, 90, 300][v]
    s += (f'<rect x="{wx}" y="90" width="260" height="230" rx="10" fill="{p["sky1"]}" stroke="{INK}" stroke-width="6"/>'
          f'<path d="M{wx+130} 90 V320 M{wx} 205 H{wx+260}" stroke="{INK}" stroke-width="5"/>')
    s += f'<circle cx="{wx+60}" cy="150" r="22" fill="{p["sun"]}"/>'
    return s

def bed(x, y, col):
    return (f'<rect x="{x}" y="{y+70}" width="300" height="70" rx="10" fill="#8a5a35" stroke="{INK}" stroke-width="4"/>'
            f'<rect x="{x+10}" y="{y+20}" width="280" height="70" rx="14" fill="{col}" stroke="{INK}" stroke-width="4"/>'
            f'<rect x="{x+20}" y="{y}" width="90" height="42" rx="14" fill="#fff" stroke="{INK}" stroke-width="4"/>'
            f'<rect x="{x+120}" y="{y+4}" width="90" height="42" rx="14" fill="#fff" stroke="{INK}" stroke-width="4"/>')

def sofa(x, y, col):
    return (f'<rect x="{x}" y="{y}" width="300" height="90" rx="22" fill="{col}" stroke="{INK}" stroke-width="4"/>'
            f'<rect x="{x-20}" y="{y+40}" width="60" height="90" rx="18" fill="{col}" stroke="{INK}" stroke-width="4"/>'
            f'<rect x="{x+260}" y="{y+40}" width="60" height="90" rx="18" fill="{col}" stroke="{INK}" stroke-width="4"/>'
            f'<rect x="{x+10}" y="{y+50}" width="280" height="70" rx="14" fill="{col}" stroke="{INK}" stroke-width="4" opacity=".92"/>')

def plant(x, y):
    return (f'<rect x="{x-18}" y="{y}" width="36" height="46" rx="6" fill="#c46a3d" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M{x} {y} Q{x-40} {y-50} {x-24} {y-86} Q{x} {y-50} {x} {y} M{x} {y} Q{x+44} {y-40} {x+30} {y-92} Q{x+4} {y-50} {x} {y}" fill="#3e9e68" stroke="{INK}" stroke-width="4"/>')

def skyline(p):
    s = ''
    for i, (x, h) in enumerate([(40, 160), (140, 220), (260, 130), (360, 260), (480, 180), (590, 230), (700, 150)]):
        s += f'<rect x="{x}" y="{440-h}" width="90" height="{h}" fill="{["#8aa0c8", "#9fb4d6", "#7d93bd"][i%3]}" stroke="{INK}" stroke-width="4"/>'
        for r in range(3, h // 40):
            for c in range(2):
                s += f'<rect x="{x+14+c*38}" y="{440-h+r*32-18}" width="22" height="18" fill="#ffe27a" opacity=".85"/>'
    return s

def tent(x, y, col, s=1.0):
    return (f'<g transform="translate({x} {y}) scale({s})" stroke="{INK}" stroke-width="4"><path d="M-80 0 L0 -90 L80 0z" fill="{col}"/>'
            '<path d="M0 -90 L-14 0 H14z" fill="#2b2b3a"/><path d="M-80 0 H80" /></g>')

def van(x, y, col, s=1.0, camper=False):
    r = (f'<g transform="translate({x} {y}) scale({s})" stroke="{INK}" stroke-width="5" stroke-linejoin="round">'
         f'<path d="M-140 0 V-90 Q-140 -108 -120 -108 H60 Q90 -108 110 -70 L140 -40 V0z" fill="{col}"/>'
         '<path d="M70 -96 Q86 -96 96 -70 L112 -48 H70z" fill="#cfeeff"/><rect x="-100" y="-86" width="60" height="38" rx="6" fill="#cfeeff"/>'
         '<circle cx="-80" cy="2" r="26" fill="#2b2b3a"/><circle cx="85" cy="2" r="26" fill="#2b2b3a"/>')
    if camper:
        r += '<path d="M-140 -108 q80 -60 200 0" fill="#fff"/>'
    return r + '</g>'

def sign(x, y):
    return (f'<rect x="{x-8}" y="{y}" width="16" height="170" fill="#8a5a35" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M{x-100} {y+14} h120 l24 20 l-24 20 h-120z" fill="#fff4e0" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M{x+100} {y+70} h-120 l-24 20 l24 20 h120z" fill="#ffd23d" stroke="{INK}" stroke-width="4"/>')

def mat(x, y, col):
    return (f'<ellipse cx="{x}" cy="{y}" rx="130" ry="26" fill="{col}" stroke="{INK}" stroke-width="4"/>'
            + person(x, y - 10, "#a78bfa", 1.0).replace('M-9 -8 V24 M9 -8 V24', 'M-9 -8 L-30 4 M9 -8 L30 4'))

def table(x, y):
    s = f'<rect x="{x}" y="{y}" width="360" height="26" rx="8" fill="#c98a52" stroke="{INK}" stroke-width="4"/><path d="M{x+24} {y+26} v110 M{x+336} {y+26} v110" stroke="{INK}" stroke-width="8"/>'
    for i, c in enumerate(("#3b82f6", "#ff5d73", "#2dd4a0")):
        s += person(x + 60 + i * 120, y - 4, c, .8)
    return s

def board(x, y):
    return (f'<rect x="{x}" y="{y}" width="320" height="190" rx="8" fill="#2f6f5e" stroke="#8a5a35" stroke-width="10"/>'
            f'<path d="M{x+30} {y+50} h150 M{x+30} {y+90} h200 M{x+30} {y+130} h120" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'
            f'<path d="M{x+230} {y+120} l30 -50 l30 50z" fill="none" stroke="#ffd23d" stroke-width="5"/>')

def scene(kind, v, seed):
    rnd = random.Random(seed)
    p = PALS[v % 3]
    outdoors = kind in {"glide", "ground", "thermal", "van", "camper", "sign", "festival", "kayak", "kayakrental", "bike", "ebike", "citybike", "car"}
    if outdoors:
        s = sky(p, v % 3, rnd)
    else:
        s = room(p, v % 3)
    o = [0, 70, -60][v % 3]
    if kind in ("glide", "thermal"):
        s += hills(p, 400)
        s += glider(300 + o, 150 + (v * 25), PALS[(v + 1) % 3]["acc"], 1.0 if kind == "glide" else .85)
        if kind == "thermal":
            s += glider(600 - o, 100, "#3b82f6", .5, False) + glider(110 + o, 210, "#2dd4a0", .45, False)
    elif kind == "ground":
        s += hills(p, 400) + person(300 + o, 470, "#ff5d73", 1.4, True)
        s += f'<path d="M{150+o} 440 Q{320+o} 250 {520+o} 440z" fill="{p["acc"]}" stroke="{INK}" stroke-width="4"/>'
    elif kind == "festival":
        s += hills(p, 420)
        for i, c in enumerate((p["acc"], "#3b82f6", "#2dd4a0")):
            s += tent(160 + i * 240, 500, c, 1.3)
        s += glider(420 + o, 120, "#ffd23d", .6, False) + glider(180 - o, 170, "#ff5d73", .45, False)
        s += f'<path d="M0 300 Q400 340 800 300" stroke="{INK}" stroke-width="3" fill="none"/>' + ''.join(f'<path d="M{x} {300 + (x-400)**2/ -4000 + 40} l14 0 l-7 24z" fill="{["#ff5d73","#ffd23d","#3b82f6"][i%3]}"/>' for i, x in enumerate(range(60, 760, 56)))
    elif kind in ("van", "camper"):
        s += hills(p, 380) + road(p, 450) + van(400 + o, 470, p["acc"] if v else "#3b82f6", 1.5, kind == "camper")
        if kind == "camper":
            s += tent(130, 440, "#2dd4a0", .9)
    elif kind == "sign":
        s += hills(p, 380) + sign(380 + o, 250) + person(210 - o, 520, "#ff5d73", 1.3)
    elif kind in ("kayak", "kayakrental"):
        s += hills(p, 330) + waves(p, 390)
        s += kayak(300 + o, 470, p["acc"], 1.6)
        if kind == "kayak":
            s += kayak(600 - o, 540, "#2dd4a0", 1.1)
    elif kind in ("bike", "ebike"):
        s += hills(p, 400) + f'<path d="M0 510 H800" stroke="{INK}" stroke-width="4"/>' + f'<rect y="510" width="800" height="90" fill="#9aa0b0"/>'
        s += bike(300 + o, 500, p["acc"], 1.7, kind == "ebike") + person(310 + o, 365, "#3b82f6", .01)
    elif kind == "citybike":
        s += f'<g transform="translate(0 20)">{skyline(p)}</g><rect y="520" width="800" height="80" fill="#9aa0b0"/>' + bike(260 + o, 510, p["acc"], 1.4) + bike(520 - o, 510, "#2dd4a0", 1.4)
    elif kind == "car":
        s += hills(p, 400) + road(p, 450) + car(420 + o, 505, p["acc"] if v != 2 else "#3b82f6", 1.7)
    elif kind == "theory":
        s += board(250 + o, 130 + 40) + table(220 - o // 2, 440)
    elif kind in ("studio", "family"):
        s += bed(60 + o // 2, 330, "#7aa5ff" if v != 1 else "#ff9a7a") + plant(690, 440)
        if kind == "family":
            s += bed(400 - o // 2, 330, "#7affb0") + person(560, 450, "#ff5d73", .9)
        s += f'<rect x="60" y="150" width="140" height="170" fill="#fff" stroke="{INK}" stroke-width="4"/>'
    elif kind == "loft":
        s += skyline(p) + f'<rect x="0" y="440" width="{W}" height="160" fill="{p["floor"]}" stroke="{INK}" stroke-width="4"/>' + sofa(250 + o, 400, "#ff9a7a") + plant(110, 460)
        s += f'<path d="M0 140 H800" stroke="{INK}" stroke-width="10"/>'
    elif kind == "room":
        s += bed(260 + o, 330, "#a78bfa") + plant(110, 440)
    elif kind in ("yoga", "workshop"):
        if kind == "yoga":
            s += f'<rect x="0" y="0" width="{W}" height="{H}" fill="{p["wall"]}" opacity=".0"/>' + mat(400 + o, 470, "#2dd4a0") + plant(110, 440) + plant(700, 440)
        else:
            s += table(220 + o, 420) + plant(90, 440)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img">{s}</svg>'

KINDS = {
    "apartment": {"studio": "studio", "family-apartment": "family", "rooftop-loft": "loft"},
    "bike": {"half-day-rental": "bike", "day-rental": "bike", "ebike-rental": "ebike", "guided-city-tour": "citybike", "trail-day-tour": "ebike"},
    "course": {"course": "workshop", "weekend-workshop": "workshop", "taster-session": "workshop"},
    "driving_school": {"trial-lesson": "car", "intensive-week": "car", "driving-lesson": "car", "double-lesson": "car", "special-drive": "car", "test-drive": "car", "theory-class": "theory"},
    "flight_school": {"beginner-course": "ground", "ground-handling-day": "ground", "refresher-day": "glide", "thermal-clinic": "thermal", "safety-training": "glide", "tandem-intro": "glide"},
    "kayak": {"half-day-tour": "kayak", "full-day-tour": "kayak", "sunset-paddle": "kayak", "paddling-basics": "kayakrental", "rental": "kayakrental"},
    "retreat": {"retreat-programme": "yoga", "day-workshop": "workshop", "private-session": "yoga", "private-room": "room", "twin-room": "room"},
    "site_day_pass": {"site-pass": "glide", "shuttle-pass": "van", "camper-pass": "camper", "site-briefing": "sign"},
    "tandem": {"tandem-flight": "glide", "thermal-tandem": "thermal", "sunset-tandem": "glide"},
    "tandem_company": {"tandem-flight": "glide", "thermal-tandem": "thermal", "sunset-tandem": "glide", "group-tandem-day": "thermal"},
    "testival": {"testival-day": "festival", "testival-weekend": "festival", "exhibitor-registration": "festival"},
}
# sunset-ish products start on the golden-hour palette
START = {"sunset-tandem": 1, "sunset-paddle": 2}

if __name__ == "__main__":
    root = os.path.join(os.path.dirname(__file__), "..", "public", "demo")
    n = 0
    for tpl, prods in KINDS.items():
        os.makedirs(os.path.join(root, tpl), exist_ok=True)
        for slug, kind in prods.items():
            for i in range(3):
                svg = scene(kind, (START.get(slug, 0) + i) % 3, f"{tpl}/{slug}/{i}")
                with open(os.path.join(root, tpl, f"{slug}-{i + 1}.svg"), "w") as f:
                    f.write(svg)
                n += 1
    print(n, "files")
