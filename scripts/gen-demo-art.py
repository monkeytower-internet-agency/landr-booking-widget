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
            '<circle cx="-28" cy="-72" r="13" fill="#ffd2a8" stroke-width="4"/><circle cx="26" cy="-72" r="13" fill="#c68b5d" stroke-width="4"/>'
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


# ---- extra props -----------------------------------------------------------
def calendar(x, y):
    g = f'<rect x="{x}" y="{y}" width="150" height="130" rx="10" fill="#fff" stroke="{INK}" stroke-width="4"/><rect x="{x}" y="{y}" width="150" height="34" rx="10" fill="#ff5d73" stroke="{INK}" stroke-width="4"/>'
    for r in range(3):
        for c in range(5):
            g += f'<rect x="{x+12+c*26}" y="{y+46+r*26}" width="18" height="16" fill="{"#2dd4a0" if (r*5+c)%2 else "#d9e2f5"}"/>'
    return g

def lplate(x, y):
    return f'<rect x="{x}" y="{y}" width="46" height="46" rx="5" fill="#fff" stroke="{INK}" stroke-width="4"/><path d="M{x+14} {y+10} v26 h20" stroke="#e2483d" stroke-width="8" fill="none"/>'

def clipboard(x, y):
    return (f'<rect x="{x}" y="{y}" width="90" height="120" rx="8" fill="#c98a52" stroke="{INK}" stroke-width="4"/><rect x="{x+10}" y="{y+16}" width="70" height="96" fill="#fff"/>'
            f'<path d="M{x+20} {y+40} h50 M{x+20} {y+60} h50 M{x+20} {y+80} h30" stroke="{INK}" stroke-width="4"/><path d="M{x+52} {y+88} l10 10 l18 -22" stroke="#2dd4a0" stroke-width="6" fill="none"/>')

def cone(x, y):
    return f'<path d="M{x-22} {y} L{x} {y-60} L{x+22} {y}z" fill="#ff7a3d" stroke="{INK}" stroke-width="4"/><path d="M{x-12} {y-28} h24" stroke="#fff" stroke-width="6"/><rect x="{x-30}" y="{y}" width="60" height="10" fill="{INK}"/>'

def trafficlight(x, y):
    return (f'<rect x="{x-6}" y="{y}" width="12" height="150" fill="{INK}"/><rect x="{x-24}" y="{y-80}" width="48" height="96" rx="10" fill="#2b2b3a" stroke="{INK}" stroke-width="4"/>'
            f'<circle cx="{x}" cy="{y-56}" r="11" fill="#e2483d"/><circle cx="{x}" cy="{y-28}" r="11" fill="#555"/><circle cx="{x}" cy="{y}" r="11" fill="#2dd4a0"/>')

def stars(rnd):
    return ''.join(f'<circle cx="{rnd.randint(20,780)}" cy="{rnd.randint(20,300)}" r="{rnd.choice([2,3,4])}" fill="#fff"/>' for _ in range(24))

def easel(x, y):
    return (f'<path d="M{x-70} {y+150} L{x} {y} L{x+70} {y+150} M{x} {y} V{y+150}" stroke="{INK}" stroke-width="7" fill="none"/>'
            f'<rect x="{x-80}" y="{y+10}" width="160" height="120" fill="#fff" stroke="{INK}" stroke-width="5"/>'
            f'<circle cx="{x-30}" cy="{y+50}" r="16" fill="#ffd23d"/><path d="M{x-70} {y+125} L{x-20} {y+80} L{x+10} {y+110} L{x+40} {y+70} L{x+78} {y+125}z" fill="#2dd4a0" stroke="{INK}" stroke-width="3"/>')

def pottery(x, y):
    return (f'<path d="M{x-30} {y} q-24 -40 0 -70 h60 q24 30 0 70z" fill="#c46a3d" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M{x+60} {y} q-14 -24 0 -44 h34 q14 20 0 44z" fill="#e2a06a" stroke="{INK}" stroke-width="4"/>')

def parachute_reserve(x, y):
    return (f'<path d="M{x-60} {y} Q{x} {y-70} {x+60} {y} z" fill="#ffd23d" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M{x-60} {y} L{x} {y+80} L{x+60} {y}" stroke="{INK}" stroke-width="3" fill="none"/>'
            f'<rect x="{x-18}" y="{y+80}" width="36" height="36" rx="6" fill="#ff5d73" stroke="{INK}" stroke-width="4"/>')

def booth(x, y, col):
    return (f'<rect x="{x}" y="{y}" width="240" height="150" fill="#fff" stroke="{INK}" stroke-width="5"/>'
            f'<path d="M{x-14} {y} h268 l-18 -48 h-232z" fill="{col}" stroke="{INK}" stroke-width="5"/>'
            f'<rect x="{x+20}" y="{y+30}" width="200" height="40" rx="6" fill="{col}" opacity=".85"/>'
            + person(x + 120, y + 150, "#3b82f6", .9))

def bunting():
    return f'<path d="M0 60 Q400 120 800 60" stroke="{INK}" stroke-width="3" fill="none"/>' + ''.join(
        f'<path d="M{x} {60 + 60*(1-((x-400)/400)**2)} l16 0 l-8 26z" fill="{["#ff5d73","#ffd23d","#3b82f6","#2dd4a0"][i%4]}" stroke="{INK}" stroke-width="2"/>' for i, x in enumerate(range(40, 780, 52)))

def beach(p):
    return f'<path d="M0 470 Q400 440 800 470 V600 H0z" fill="#f2dca0" stroke="{INK}" stroke-width="4"/>'

def sun_rays(p):
    return ''.join(f'<path d="M400 300 L{400+420*__import__("math").cos(a/8*6.283):.0f} {300+420*__import__("math").sin(a/8*6.283):.0f}" stroke="#fff" opacity=".35" stroke-width="22"/>' for a in range(8))

def group_people(x, y, n=4, s=.8):
    cols = ["#3b82f6", "#ff5d73", "#2dd4a0", "#ffd23d", "#a78bfa"]
    return ''.join(person(x + i * 70, y, cols[i % 5], s) for i in range(n))

def scene(kind, v, seed, props=()):
    rnd = random.Random(seed)
    p = PALS[v % 3]
    night = "night" in props
    if night:
        p = dict(PALS[2], sky1="#12183a", sky2="#2b3478", hill1="#26306a", hill2="#1c2455", hill3="#141a40")
    outdoors = kind in {"glide", "ground", "thermal", "van", "camper", "sign", "festival", "kayak", "kayakrental", "kayaklong", "kayakbasics", "bike", "ebike", "citybike", "trail", "car", "reserve", "booth"}
    s = sky(p, v % 3, rnd) if outdoors else room(p, v % 3)
    if night:
        s += stars(rnd)
    o = [0, 70, -60][v % 3]
    if kind in ("glide", "thermal"):
        s += hills(p, 400)
        s += glider(300 + o, 150 + (v * 25), PALS[(v + 1) % 3]["acc"], 1.0 if kind == "glide" else .85)
        if kind == "thermal":
            s += glider(600 - o, 100, "#3b82f6", .5, False) + glider(110 + o, 210, "#2dd4a0", .45, False)
        if "group" in props:
            s += glider(640 - o, 220, "#ffd23d", .55) + glider(120 + o, 150, "#2dd4a0", .5)
    elif kind == "ground":
        s += hills(p, 400) + person(300 + o, 470, "#ff5d73", 1.4, True)
        s += f'<path d="M{150+o} 440 Q{320+o} 250 {520+o} 440z" fill="{p["acc"]}" stroke="{INK}" stroke-width="4"/>'
        if "two" in props:
            s += person(560 + o, 480, "#3b82f6", 1.1)
    elif kind == "reserve":
        s += hills(p, 420) + parachute_reserve(400 + o, 170) + person(180 - o, 500, "#ff5d73", 1.2) + clipboard(600, 380)
    elif kind == "festival":
        s += hills(p, 420) + bunting()
        for i, c in enumerate((p["acc"], "#3b82f6", "#2dd4a0")):
            s += tent(160 + i * 240, 500, c, 1.3)
        s += glider(420 + o, 120, "#ffd23d", .6, False) + glider(180 - o, 170, "#ff5d73", .45, False)
    elif kind == "booth":
        s += hills(p, 430) + bunting() + booth(280 + o, 340, p["acc"]) + glider(660 - o, 150, "#3b82f6", .45, False)
    elif kind in ("van", "camper"):
        s += hills(p, 380) + road(p, 450) + van(400 + o, 470, p["acc"] if v else "#3b82f6", 1.5, kind == "camper")
        if kind == "camper":
            s += tent(130, 440, "#2dd4a0", .9)
    elif kind == "sign":
        s += hills(p, 380) + sign(380 + o, 250) + person(210 - o, 520, "#ff5d73", 1.3)
    elif kind in ("kayak", "kayaklong"):
        s += hills(p, 330) + waves(p, 390) + kayak(300 + o, 470, p["acc"], 1.6) + kayak(600 - o, 540, "#2dd4a0", 1.1)
        if kind == "kayaklong":
            s += kayak(130 + o, 430, "#a78bfa", .8)
    elif kind == "kayakrental":
        s += hills(p, 330) + waves(p, 390) + beach(p)
        for i, c in enumerate((p["acc"], "#3b82f6", "#2dd4a0")):
            s += f'<g transform="translate({150+i*250} 540) rotate(-8)"><path d="M-110 0 Q0 24 110 0 Q0 -22 -110 0z" fill="{c}" stroke="{INK}" stroke-width="4"/></g>'
    elif kind == "kayakbasics":
        s += hills(p, 330) + waves(p, 400) + beach(p) + person(160 + o, 520, "#ff5d73", 1.3) + kayak(560 - o, 470, p["acc"], 1.2)
        s += f'<path d="M230 470 L330 450" stroke="{INK}" stroke-width="5"/>'
    elif kind in ("bike", "ebike"):
        s += hills(p, 400) + f'<rect y="510" width="800" height="90" fill="#9aa0b0"/>' + f'<path d="M0 510 H800" stroke="{INK}" stroke-width="4"/>'
        s += bike(300 + o, 500, p["acc"], 1.7, kind == "ebike")
        if "far" in props:
            s += bike(560 - o, 500, "#2dd4a0", 1.0)
    elif kind == "trail":
        s += hills(p, 300) + f'<path d="M0 600 Q300 470 500 520 T800 430 V600z" fill="#c9a36a" stroke="{INK}" stroke-width="4"/>' + bike(330 + o, 520, p["acc"], 1.3, True)
    elif kind == "citybike":
        s += f'<g transform="translate(0 20)">{skyline(p)}</g><rect y="520" width="800" height="80" fill="#9aa0b0"/>' + bike(260 + o, 510, p["acc"], 1.4) + bike(520 - o, 510, "#2dd4a0", 1.4)
    elif kind == "car":
        s += hills(p, 400) + road(p, 450) + car(420 + o, 505, p["acc"] if v != 2 else "#3b82f6", 1.7)
        if "L" in props:
            s += lplate(80, 250)
        if "light" in props:
            s += trafficlight(690, 330)
        if "calendar" in props:
            s += calendar(560, 170)
        if "clip" in props:
            s += clipboard(110, 250)
        if "cones" in props:
            s += cone(120, 540) + cone(660, 540) + cone(720, 560)
        if "two" in props:
            s += car(150, 400, "#3b82f6", .6)
    elif kind == "theory":
        s += board(250 + o, 130 + 40) + table(220 - o // 2, 440)
    elif kind == "class":
        s += board(60 + o // 3, 130) + group_people(110, 560, 5, 1.25) + f'<rect x="80" y="470" width="600" height="14" fill="#c98a52" stroke="{INK}" stroke-width="4"/>'
    elif kind == "craft":
        s += table(220 + o, 420) + pottery(300 + o, 410) + plant(90, 440)
    elif kind == "taster":
        s += easel(400 + o, 200) + person(220 - o // 2, 520, "#ff5d73", 1.4) + plant(700, 440)
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
    elif kind == "twin":
        s += bed(40 + o // 3, 330, "#a78bfa") + bed(430 - o // 3, 330, "#2dd4a0") + plant(380, 450)
    elif kind == "yoga":
        s += mat(400 + o, 470, "#2dd4a0") + plant(110, 440) + plant(700, 440)
        if "two" in props:
            s += mat(220 - o, 520, "#ff9a7a")
    elif kind == "workshop":
        s += table(220 + o, 420) + plant(90, 440)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img">{s}</svg>'

def shot(svg, i):
    """Three genuinely different frames: wide, close-up, mirrored."""
    if i == 1:
        return svg.replace(f'viewBox="0 0 {W} {H}"', 'viewBox="130 120 560 420"')
    if i == 2:
        return svg.replace('role="img">', f'role="img"><g transform="translate({W} 0) scale(-1 1)">', 1).replace('</svg>', '</g></svg>')
    return svg

K = lambda kind, *props: (kind, props)
KINDS = {
    "apartment": {"studio": K("studio"), "family-apartment": K("family"), "rooftop-loft": K("loft"), "bike-rental": K("citybike")},
    "bike": {"half-day-rental": K("bike"), "day-rental": K("bike", "far"), "ebike-rental": K("ebike"), "guided-city-tour": K("citybike"), "trail-day-tour": K("trail")},
    "course": {"course": K("class"), "weekend-workshop": K("craft"), "taster-session": K("taster")},
    "driving_school": {"trial-lesson": K("car", "L"), "intensive-week": K("car", "calendar"), "driving-lesson": K("car", "light"), "double-lesson": K("car", "two"), "special-drive": K("car", "night"), "test-drive": K("car", "clip", "cones"), "theory-class": K("theory")},
    "flight_school": {"beginner-course": K("ground"), "ground-handling-day": K("ground", "two"), "refresher-day": K("glide"), "thermal-clinic": K("thermal"), "safety-training": K("reserve"), "tandem-intro": K("glide", "group")},
    "kayak": {"half-day-tour": K("kayak"), "full-day-tour": K("kayaklong"), "sunset-paddle": K("kayak"), "paddling-basics": K("kayakbasics"), "rental": K("kayakrental")},
    "retreat": {"retreat-programme": K("yoga", "two"), "day-workshop": K("craft"), "private-session": K("yoga"), "private-room": K("room"), "twin-room": K("twin")},
    "site_day_pass": {"site-pass": K("glide", "group"), "shuttle-pass": K("van"), "camper-pass": K("camper"), "site-briefing": K("sign")},
    "tandem": {"tandem-flight": K("glide"), "thermal-tandem": K("thermal"), "sunset-tandem": K("glide")},
    "tandem_company": {"tandem-flight": K("glide"), "thermal-tandem": K("thermal"), "sunset-tandem": K("glide"), "group-tandem-day": K("glide", "group")},
    "testival": {"testival-day": K("festival"), "testival-weekend": K("festival", "night"), "exhibitor-registration": K("booth")},
}
# sunset-ish products start on the golden-hour palette; others on a spread so siblings differ
START = {"sunset-tandem": 1, "sunset-paddle": 2}

def start_of(slug, n):
    return START.get(slug, n % 3)

if __name__ == "__main__":
    root = os.path.join(os.path.dirname(__file__), "..", "public", "demo")
    n = 0
    for tpl, prods in KINDS.items():
        os.makedirs(os.path.join(root, tpl), exist_ok=True)
        for pi, (slug, (kind, props)) in enumerate(prods.items()):
            for i in range(3):
                svg = shot(scene(kind, (start_of(slug, pi) + i) % 3, f"{tpl}/{slug}/{i}", props), i)
                with open(os.path.join(root, tpl, f"{slug}-{i + 1}.svg"), "w") as f:
                    f.write(svg)
                n += 1
    print(n, "files")
