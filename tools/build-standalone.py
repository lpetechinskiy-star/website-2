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

    with io.open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    size = os.path.getsize(OUT)
    print('chugun.html — %.2f МБ' % (size / 1048576))
    print('вшито файлов: %d, исходных байт %.0f КБ' % (len(used), sum(used.values()) / 1024))
    left = sorted(set(re.findall(r'"(assets/[^"]+)"', html)) - SKIP)
    print('осталось внешних ссылок на assets: %s' % (left or 'нет — кроме og:image, она и не рисуется'))

if __name__ == '__main__':
    main()
