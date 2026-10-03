#!/usr/bin/env python3
"""Облегчённые ролики для однофайловой сборки.

На сайте с отдельными файлами играют полные hero-wide/hero-tall.mp4.
В chugun.html всё лежит внутри одного файла, и там ролики — самая тяжёлая
часть: больше 40 % веса. Потолок сборки — 2 МБ (выше просмотрщики молча
обрезают файл и страница выглядит сломанной), поэтому для неё делаем
отдельные лёгкие копии.

Настройки разные нарочно. Вертикальный ролик — это то, что видно на
телефоне, то есть почти всегда; его жмём мягче. Горизонтальный идёт
фоном под затемнением и крупным заголовком на широком экране — там
лишняя деталь всё равно не читается.

Запуск:  python3 tools/make-lite-video.py
"""
import os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID  = os.path.join(ROOT, 'assets/video')

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = 'ffmpeg'

# исходник, результат, ширина, высота, кадров в секунду, crf
CLIPS = [
    ('hero-tall.mp4', 'hero-tall-lite.mp4', 480, 854, 25, 34),
    ('hero-wide.mp4', 'hero-wide-lite.mp4', 854, 480, 25, 35),
]

def lite(src, dst, w, h, fps, crf):
    out = os.path.join(VID, dst)
    subprocess.run([FF, '-v', 'error', '-y', '-i', os.path.join(VID, src),
                    '-an', '-r', str(fps),
                    '-vf', 'scale=%d:%d:flags=lanczos' % (w, h),
                    '-c:v', 'libx264', '-profile:v', 'main', '-crf', str(crf),
                    '-preset', 'veryslow', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', out], check=True)
    return os.path.getsize(out)

if __name__ == '__main__':
    total = 0
    for c in CLIPS:
        n = lite(*c)
        total += n
        print('%-20s %dx%d crf%d  %5.0f КБ' % (c[1], c[2], c[3], c[5], n / 1024))
    print('итого %.0f КБ' % (total / 1024))
