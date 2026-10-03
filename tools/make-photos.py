#!/usr/bin/env python3
"""Кадры из ролика → фотографии для карточек отрубов и галереи.

Снимать нечего и стоков под рукой нет: сеть окружения их не пускает.
Зато есть исходный ролик — настоящее мясо, соль в воздухе, нож и корочка.
Берём из него десять разных моментов и кадрируем под сетку сайта.
Обработка одна на все: лёгкий контраст, чуть меньше насыщенности
(сырое мясо иначе лезет в малиновый), виньетка под тёмную вёрстку.

Запуск:  python3 tools/make-photos.py
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets/video/hero-tall.mp4')     # 720×1280, полный кадр
OUT  = os.path.join(ROOT, 'assets/img')
SRCDIR = os.path.join(ROOT, 'assets/img/src')   # присланные оригиналы

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = 'ffmpeg'

GRADE = 'eq=contrast=1.14:saturation=0.94:brightness=0.04,vignette=PI/5.5,unsharp=3:3:0.5'

# имя, момент, (ширина, высота, сдвиг по X, сдвиг по Y, итоговая ширина)
# Кадры нарочно разные по крупности: четыре одинаковых плана сырого мяса
# рядом читаются как одна картинка, продублированная четыре раза.
# Кадры из ролика: карточки отрубов теперь не отсюда — туда пошла
# присланная съёмка, — а галерея и «История» остаются.
SHOTS = [
    # Кадр кадрируем теснее исходного и ставим мясо в верхнюю половину:
    # у карточки низ залит почти чёрным градиентом под подпись, и снятое
    # «как в ролике» уходило ровно под него.
    ('gallery-01',     3.55, (480, 600, 120, 560, 720)),   # соль на мясе, макро
    ('gallery-02',     6.85, (720, 480,   0, 560, 720)),   # корочка макро
    ('gallery-03',     7.95, (720, 480,   0, 600, 720)),   # разрез
    ('gallery-04',     4.40, (520, 650,  60, 600, 720)),   # мрамор макро
    ('gallery-05',     0.60, (720, 480,   0, 700, 720)),   # доска и мясо
    ('gallery-06',     5.60, (576, 720,  72, 400, 720)),   # нож входит, вертикально
]

def shot(name, t, box):
    w, h, x, y, outw = box
    dst = os.path.join(OUT, name + '.webp')
    vf = 'crop=%d:%d:%d:%d,scale=%d:-2:flags=lanczos,%s' % (w, h, x, y, outw, GRADE)
    cmd = [FF, '-v', 'error', '-y', '-ss', str(t), '-i', SRC,
           '-frames:v', '1', '-vf', vf, '-q:v', '78', dst]
    subprocess.run(cmd, check=True)
    return dst, os.path.getsize(dst)

# Присланные снимки блюд. Они почти квадратные, а карточка отруба — 4:5,
# поэтому обрезаем по бокам ровно под это отношение: иначе у каждого файла
# своя высота, атрибуты width/height врут и страница дёргается при загрузке.
# Исходники небольшие (около 410 px), поэтому тянем умеренно и добавляем
# резкости, а не раздуваем до размера сетки.
PHOTOS = [
    # исходник, имя, центр кадра по X и Y (доли), ширина на выходе,
    # отношение сторон (по умолчанию 4:5 — под карточку отруба)
    ('tbone.jpg',     'dish-tbone',     0.50, 0.50, 560),
    ('tomahawk.jpg',  'dish-tomahawk',  0.46, 0.50, 560),
    ('ribeye.jpg',    'dish-ribeye',    0.50, 0.50, 560),
    ('striploin.jpg', 'dish-striploin', 0.50, 0.52, 560),
    ('cocktail.jpg',  'story-fire',     0.50, 0.42, 720, (3, 4)),
]

PGRADE = 'eq=contrast=1.05:saturation=0.98,unsharp=5:5:0.6'

def photo(src, name, cx, cy, outw, ratio=(4, 5)):
    dst = os.path.join(OUT, name + '.webp')
    # Ровно заданное отношение: берём наибольший вписанный прямоугольник
    # и двигаем его внутри кадра долями cx и cy.
    # запятые внутри min() экранируем: без этого ffmpeg принимает их
    # за разделители фильтров и ругается на «нет такого фильтра»
    rw, rh = ratio
    cw = r"min(iw\,ih*%d/%d)" % (rw, rh)
    ch = r"min(ih\,iw*%d/%d)" % (rh, rw)
    vf = ("crop=%s:%s:(iw-%s)*%g:(ih-%s)*%g,scale=%d:%d:flags=lanczos,%s"
          % (cw, ch, cw, cx, ch, cy, outw, round(outw * rh / rw), PGRADE))
    subprocess.run([FF, '-v', 'error', '-y', '-i', os.path.join(SRCDIR, src),
                    '-frames:v', '1', '-vf', vf, '-q:v', '74', dst], check=True)
    return dst, os.path.getsize(dst)

def main():
    total = 0
    for name, t, box in SHOTS:
        dst, n = shot(name, t, box)
        total += n
        print('%-16s %4.2f с  %5.0f КБ' % (name + '.webp', t, n / 1024))
    for item in PHOTOS:
        dst, n = photo(*item)
        total += n
        print('%-16s %-14s %5.0f КБ' % (item[1] + '.webp', item[0], n / 1024))
    print('итого %.0f КБ' % (total / 1024))

if __name__ == '__main__':
    main()
