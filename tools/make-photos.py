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

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = 'ffmpeg'

GRADE = 'eq=contrast=1.14:saturation=0.94:brightness=0.04,vignette=PI/5.5,unsharp=3:3:0.5'

# имя, момент, (ширина, высота, сдвиг по X, сдвиг по Y, итоговая ширина)
# Кадры нарочно разные по крупности: четыре одинаковых плана сырого мяса
# рядом читаются как одна картинка, продублированная четыре раза.
SHOTS = [
    # Кадр кадрируем теснее исходного и ставим мясо в верхнюю половину:
    # у карточки низ залит почти чёрным градиентом под подпись, и снятое
    # «как в ролике» уходило ровно под него.
    ('dish-tbone',     1.10, (560, 700,  80, 560, 720)),   # доска, соль пошла
    ('dish-tomahawk',  2.60, (560, 700,  80, 470, 720)),   # руки и соляной шторм
    ('dish-ribeye',    6.25, (560, 700, 100, 500, 720)),   # корочка и нож
    ('dish-striploin', 7.45, (520, 650, 100, 520, 720)),   # разрез крупно
    ('gallery-01',     3.55, (480, 600, 120, 560, 720)),   # соль на мясе, макро
    ('gallery-02',     6.85, (720, 480,   0, 560, 720)),   # корочка макро
    ('gallery-03',     7.95, (720, 480,   0, 600, 720)),   # разрез
    ('gallery-04',     4.40, (520, 650,  60, 600, 720)),   # мрамор макро
    ('gallery-05',     0.60, (720, 480,   0, 700, 720)),   # доска и мясо
    ('gallery-06',     5.60, (720, 480,   0, 460, 720)),   # нож входит
]

def shot(name, t, box):
    w, h, x, y, outw = box
    dst = os.path.join(OUT, name + '.webp')
    vf = 'crop=%d:%d:%d:%d,scale=%d:-2:flags=lanczos,%s' % (w, h, x, y, outw, GRADE)
    cmd = [FF, '-v', 'error', '-y', '-ss', str(t), '-i', SRC,
           '-frames:v', '1', '-vf', vf, '-q:v', '78', dst]
    subprocess.run(cmd, check=True)
    return dst, os.path.getsize(dst)

def main():
    total = 0
    for name, t, box in SHOTS:
        dst, n = shot(name, t, box)
        total += n
        print('%-16s %4.2f с  %5.0f КБ' % (name + '.webp', t, n / 1024))
    print('итого %.0f КБ' % (total / 1024))

if __name__ == '__main__':
    main()
