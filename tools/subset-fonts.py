#!/usr/bin/env python3
"""Сжимает self-hosted шрифты до реально нужного набора глифов.

Берёт всё, что встречается в index.html и main.js, и добавляет запас:
полную кириллицу, латиницу, цифры, пунктуацию и ₽ — чтобы тексты на сайте
можно было спокойно править, не пересобирая шрифты.

Запуск после правки текстов:  python3 tools/subset-fonts.py
Требует:  pip install fonttools brotli
"""
import pathlib, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT  = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / 'assets' / 'fonts'

# 1. всё, что уже есть в разметке и скриптах
used = set()
for f in (ROOT / 'index.html', ROOT / 'assets' / 'js' / 'main.js'):
    used |= set(f.read_text(encoding='utf-8'))

# 2. запас на редактирование
ranges = [
    (0x20, 0x7E),      # базовая латиница, цифры, пунктуация
    (0x0410, 0x044F),  # А-я
    (0x00A0, 0x00BF),  # « » ° · © ® и неразрывный пробел
]
extra = ('ЁёЙй№—–−…«»“”„‘’•·×÷→←↑↓✓✗⚠◆◇■□°±№₽€$₸₴' 'ÀÁÂÄÇÈÉÊËÎÏÔÖÙÛÜŸàáâäçèéêëîïôöùûüÿ')
for a, b in ranges:
    used |= {chr(c) for c in range(a, b + 1)}
used |= set(extra)
used.discard('\n'); used.discard('\r'); used.discard('\t')

opts = subset.Options()
opts.layout_features = ['kern', 'liga', 'clig', 'calt', 'ccmp', 'locl', 'mark', 'mkmk',
                        'tnum', 'lnum', 'onum', 'pnum', 'frac', 'case']
opts.flavor = 'woff2'
opts.desubroutinize = False
opts.hinting = True
opts.notdef_outline = True
opts.name_IDs = ['*']
opts.name_legacy = True
opts.recalc_bounds = True
opts.drop_tables += ['DSIG']

before = after = 0
rows = []
for path in sorted(FONTS.glob('*.woff2')):
    size0 = path.stat().st_size
    font = TTFont(path)
    have = set()
    for table in font['cmap'].tables:
        have |= set(table.cmap.keys())
    keep = sorted({ord(c) for c in used} & have)
    if len(keep) < 2:
        rows.append((path.name, size0, 0, f'нет нужных глифов — файл оставлен как есть ({len(keep)})'))
        font.close(); before += size0; after += size0
        continue
    font.close()

    subsetter = subset.Subsetter(options=opts)
    f2 = subset.load_font(str(path), opts)
    subsetter.populate(unicodes=keep)
    subsetter.subset(f2)
    subset.save_font(f2, str(path), opts)
    f2.close()

    size1 = path.stat().st_size
    before += size0; after += size1
    rows.append((path.name, size0, size1, f'{len(keep)} глифов'))

w = max(len(r[0]) for r in rows)
for name, s0, s1, note in rows:
    if s1:
        print(f'  {name:<{w}}  {s0/1024:6.1f} → {s1/1024:5.1f} KB   {note}')
    else:
        print(f'  {name:<{w}}  {s0/1024:6.1f} KB   {note}')
print(f'\n  итого {before/1024:.1f} → {after/1024:.1f} KB  '
      f'({(1 - after/before) * 100:.0f}% меньше)')
