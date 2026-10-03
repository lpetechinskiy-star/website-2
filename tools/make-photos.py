#!/usr/bin/env python3
"""Присланные снимки (и один кадр из ролика) → фотографии под сетку сайта.

Кадрирование здесь не «по вкусу», а по форме исходника: почти квадратный
снимок без потерь садится в высокую карточку 4:5, широкий — в карточку 3:2.
Если делать наоборот, от кадра приходится отрезать половину, и от съёмки
остаётся кусок мяса без композиции.

Обработка одна на все: лёгкий контраст, чуть меньше насыщенности
(сырое мясо иначе лезет в малиновый), слабое подавление шума — оно и
картинку чистит, и webp потом сжимает заметно лучше.

Вес здесь не мелочь: всё это уезжает в однофайловую сборку chugun.html,
а у неё жёсткий потолок в 2 МБ (выше просмотрщики молча обрезают файл).
Поэтому у каждой фотографии свои размер и качество, а не одно на всех.

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
# Карточки отрубов и почти вся галерея — присланная съёмка; из ролика
# остался один кадр, которого в присланном нет: нож входит в корочку.
SHOTS = [
    ('gallery-06',     6.85, (720, 480,   0, 560, 720)),   # угольная корочка, макро
]

def shot(name, t, box):
    w, h, x, y, outw = box
    dst = os.path.join(OUT, name + '.webp')
    vf = 'crop=%d:%d:%d:%d,scale=%d:-2:flags=lanczos,%s' % (w, h, x, y, outw, GRADE)
    cmd = [FF, '-v', 'error', '-y', '-ss', str(t), '-i', SRC,
           '-frames:v', '1', '-vf', vf, '-quality', '74', dst]
    subprocess.run(cmd, check=True)
    return dst, os.path.getsize(dst)

# Присланные снимки. Поля: откуда, во что, центр кадра по X и Y (доли),
# ширина на выходе, отношение сторон, срез кромки сверху/снизу,
# качество webp и сила «резкости».
#
# Резкость даём только тем кадрам, которые приходится немного растягивать
# (исходники меньше сетки). Уменьшенным она не нужна: lanczos и так держит
# край, а каждая единица unsharp стоит 5–7 КБ на файл.
PHOTOS = [
    # Карточки отрубов. Исходники около 410 px — тянем умеренно.
    dict(src='tbone.jpg',     out='dish-tbone',     cx=.50, cy=.50, w=560, sharp=.6, q=70),
    dict(src='tomahawk.jpg',  out='dish-tomahawk',  cx=.46, cy=.50, w=560, sharp=.6, q=70),
    dict(src='ribeye.jpg',    out='dish-ribeye',    cx=.50, cy=.50, w=560, sharp=.6, q=70),
    dict(src='striploin.jpg', out='dish-striploin', cx=.50, cy=.52, w=560, sharp=.6, q=70),

    # «История» — коктейль, вертикаль 3:4.
    dict(src='cocktail.jpg',  out='story-fire',     cx=.50, cy=.42, w=720, ratio=(3, 4), q=70),

    # Галерея. Два почти квадратных кадра и вертикальный срез с солью идут
    # в высокие карточки, два широких — в карточки 3:2. Подписи подобраны
    # под кадры, а не наоборот.
    dict(src='gal-marble.jpg', out='gallery-01', cx=.50, cy=.50, w=576, ratio=(4, 5), q=65, sharp=.4),
    dict(src='gal-slice.jpg',  out='gallery-02', cx=.45, cy=.50, w=576, ratio=(4, 5), q=65, sharp=.4),
    # соль сыплется сверху — вертикальный кадр ловит весь столб, широкий резал бы его
    dict(src='gal-salt.jpg',   out='gallery-03', cx=.50, cy=.50, w=576, ratio=(4, 5), q=65),
    dict(src='gal-board.jpg',  out='gallery-04', cx=.55, cy=.50, w=720, ratio=(3, 2), q=65),
    # у этого кадра сверху тонкая чёрная кромка — срезаем, иначе попадёт в карточку
    dict(src='gal-serve.jpg',  out='gallery-05', cx=.45, cy=.50, w=720, ratio=(3, 2), q=65, trim=(10, 0)),

    # Фон блока брони. Он лежит под заливкой в 88–94 % черноты: там
    # различимы только крупные пятна света, и платить за детали нечем.
    # Отдельный файл, а не ссылка на карточку галереи: в однофайловой
    # сборке один и тот же снимок в двух местах вшивается дважды.
    dict(src='gal-board.jpg',  out='res-bg',     cx=.55, cy=.50, w=640, ratio=(16, 9), q=45),
]

PGRADE = 'hqdn3d=2:2:6:6,eq=contrast=1.05:saturation=0.98'

def photo(src, out, cx, cy, w, ratio=(4, 5), trim=(0, 0), q=70, sharp=0):
    dst = os.path.join(OUT, out + '.webp')
    # Ровно заданное отношение: берём наибольший вписанный прямоугольник
    # и двигаем его внутри кадра долями cx и cy.
    # запятые внутри min() экранируем: без этого ffmpeg принимает их
    # за разделители фильтров и ругается на «нет такого фильтра»
    rw, rh = ratio
    cw = r"min(iw\,ih*%d/%d)" % (rw, rh)
    ch = r"min(ih\,iw*%d/%d)" % (rh, rw)
    # сначала срезаем кромку, иначе она попадёт в кадр и даст чёрную полосу
    pre = 'crop=iw:ih-%d:0:%d,' % (trim[0] + trim[1], trim[0]) if any(trim) else ''
    post = (',unsharp=5:5:%g' % sharp) if sharp else ''
    vf = ("%scrop=%s:%s:(iw-%s)*%g:(ih-%s)*%g,scale=%d:%d:flags=lanczos,%s%s"
          % (pre, cw, ch, cw, cx, ch, cy, w, round(w * rh / rw), PGRADE, post))
    subprocess.run([FF, '-v', 'error', '-y', '-i', os.path.join(SRCDIR, src),
                    '-frames:v', '1', '-vf', vf,
                    '-quality', str(q), '-compression_level', '6', dst], check=True)
    return dst, os.path.getsize(dst)

def main():
    total = 0
    for name, t, box in SHOTS:
        dst, n = shot(name, t, box)
        total += n
        print('%-16s %4.2f с  %5.0f КБ' % (name + '.webp', t, n / 1024))
    for item in PHOTOS:
        dst, n = photo(**item)
        total += n
        print('%-16s %-16s %5.0f КБ' % (item['out'] + '.webp', item['src'], n / 1024))
    print('итого %.0f КБ' % (total / 1024))

if __name__ == '__main__':
    main()
