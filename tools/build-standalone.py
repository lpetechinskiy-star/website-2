#!/usr/bin/env python3
"""Собирает index.html и всё, что он тянет, в один автономный файл.

Зачем: index.html — это только разметка, а стили, шрифты, картинки,
скрипты и видео лежат рядом в assets/. Если открыть один index.html
без этой папки, браузеру нечего применять — получается синий текст
по белому. Здесь всё содержимое папки вшивается прямо в файл как
data: URI, и результат открывается откуда угодно, в том числе без сети.

Запуск:  python3 tools/build-standalone.py
Итог:    chugun.html в корне проекта
"""
import base64, io, mimetypes, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'index.html')
OUT  = os.path.join(ROOT, 'chugun.html')

MIME = {'.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4'}

def data_uri(rel):
    """Файл из проекта → data: URI. base64 для всего, включая SVG:
    процентное кодирование короче, но в наших плитках хватает кавычек
    и решёток, на которых оно ломается незаметно."""
    path = os.path.join(ROOT, rel)
    with open(path, 'rb') as f:
        raw = f.read()
    ext = os.path.splitext(rel)[1].lower()
    mime = MIME.get(ext) or mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return 'data:%s;base64,%s' % (mime, base64.b64encode(raw).decode('ascii')), len(raw)

def lite(rel):
    """Для одного файла берём облегчённые ролики, если они есть.

    В base64 видео раздувается на треть, и полные версии давали файл
    на 4 МБ — его обрезают просмотрщики, и страница выглядит сломанной,
    хотя сломан не сайт, а показ. Облегчённые — 480 и 854 px по ширине,
    25 кадров: вместе 0,5 МБ вместо 2,3. Делает их tools/make-lite-video.py.
    На сайте с отдельной папкой assets/ по-прежнему играют полные.
    """
    if rel.startswith('assets/video/') and rel.endswith('.mp4') and '-lite' not in rel:
        alt = rel[:-4] + '-lite.mp4'
        if os.path.exists(os.path.join(ROOT, alt)):
            return alt
    return rel

def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()

def main():
    html = read('index.html')
    used = {}

    # ── 1. CSS: шрифты и фактура зерна внутрь, потом оба файла в один <style>
    css = read('assets/css/fonts.css') + '\n' + read('assets/css/styles.css')

    def css_url(m):
        rel = m.group(1).strip('\'"')
        if rel.startswith('data:'):
            return m.group(0)
        asset = os.path.normpath(os.path.join('assets/css', rel)).replace(os.sep, '/')
        uri, n = data_uri(asset)
        used[asset] = n
        return 'url("%s")' % uri

    # Комментарии из стилей в сборку не едут. В репозитории они нужны —
    # половина правил без объяснения выглядит случайной, — а здесь это
    # 20 КБ, которые в base64 становятся почти 30 и съедают запас до
    # потолка в 2 МБ. Режем до вставки картинок: закомментированная
    # url() иначе утащила бы в файл ненужный ассет.
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\n[ \t]*\n+', '\n', css)

    css = re.sub(r'url\(\s*((?:"[^"]*"|\'[^\']*\'|[^)\'"]+))\s*\)', css_url, css)

    # preload для data: URI бессмыслен — шрифт уже в файле
    html = re.sub(r'\n\s*<link rel="preload" as="font"[^>]*>', '', html)
    html = re.sub(
        r'\s*<link rel="stylesheet" href="assets/css/fonts\.css">\s*'
        r'<link rel="stylesheet" href="assets/css/styles\.css">',
        '\n<style>\n' + css.strip() + '\n</style>', html, count=1)
    assert '<style>' in html, 'не нашёл ссылки на таблицы стилей'

    # ── 2. Картинки, иконка и видео в атрибутах разметки
    # og:image оставляем относительной ссылкой: как data: URI он всё равно
    # не работает ни в одной соцсети, а рядом с assets/ на хостинге — работает
    SKIP = {'assets/img/og-cover.jpg'}

    def attr_asset(m):
        pre, rel, post = m.group(1), m.group(2), m.group(3)
        if rel in SKIP:
            return m.group(0)
        rel = lite(rel)
        uri, n = data_uri(rel)
        used[rel] = n
        return pre + uri + post

    html = re.sub(r'(=")(assets/(?:img|video)/[^"]+)(")', attr_asset, html)

    # ── 3. Скрипты в конец body, в том же порядке
    def inline_script(m):
        rel = m.group(1)
        js = read(rel)
        assert '</script' not in js.lower(), rel + ' содержит закрывающий тег'
        used[rel] = len(js.encode('utf-8'))
        return '<script>\n' + js.strip() + '\n</script>'

    html, n = re.subn(r'<script src="([^"]+)" defer></script>', inline_script, html)
    assert n == 3, 'ожидалось три подключаемых скрипта, найдено %d' % n

    # ── 4. Метка целостности. Хвост файла — самое уязвимое место: если его
    # обрежет почтовик или встроенный просмотрщик, страница выглядит
    # сломанной, хотя не открылась целиком. Пусть скажет об этом прямо.
    guard = ('<script>addEventListener("DOMContentLoaded",function(){setTimeout(function(){'
             'if(window.__chugunTail)return;var d=document.createElement("div");'
             'd.setAttribute("role","alert");d.style.cssText="position:fixed;inset:auto 0 0;'
             'z-index:99999;padding:14px 18px;background:#D4A03C;color:#0C0A09;'
             'font:600 14px/1.45 system-ui,sans-serif;text-align:center";'
             'd.textContent="\u0424\u0430\u0439\u043b \u043e\u0442\u043a\u0440\u044b\u0442 '
             '\u043d\u0435 \u0446\u0435\u043b\u0438\u043a\u043e\u043c \u2014 '
             '\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0449\u0438\u043a '
             '\u0435\u0433\u043e \u043e\u0431\u0440\u0435\u0437\u0430\u043b. '
             '\u0421\u043a\u0430\u0447\u0430\u0439\u0442\u0435 chugun.html '
             '\u0438 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 '
             '\u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435.";'
             'document.body.appendChild(d)},3000)})</script>')
    html = html.replace('</head>', guard + '\n</head>', 1)
    html = html.replace('</body>', '<script>window.__chugunTail=1</script>\n</body>', 1)

    with io.open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    size = os.path.getsize(OUT)
    # Порог не из головы: на 4 МБ встроенный просмотрщик обрезал файл молча
    assert size < 2 * 1048576, 'файл вырос до %.1f МБ — его начнут обрезать' % (size / 1048576)
    print('chugun.html — %.2f МБ' % (size / 1048576))
    print('вшито файлов: %d, исходных байт %.0f КБ' % (len(used), sum(used.values()) / 1024))
    left = sorted(set(re.findall(r'"(assets/[^"]+)"', html)) - SKIP)
    print('осталось внешних ссылок на assets: %s' % (left or 'нет — кроме og:image, она и не рисуется'))

if __name__ == '__main__':
    main()
