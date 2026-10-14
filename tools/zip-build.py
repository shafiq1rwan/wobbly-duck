"""Zip a production build for upload (e.g. the Poki Inspector): index.html at the zip root.

Usage:  python tools/zip-build.py <build_dir> <name>      (npm run build:poki does this)
The zip is named <name>-v<version>-<commit>.zip (plus "-dirty" with uncommitted changes), matching
the version shown on the game's menu.
"""
import json
import os
import subprocess
import sys
import zipfile


def version() -> str:
    v = json.load(open('package.json', encoding='utf-8'))['version']
    try:
        commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], text=True).strip()
        dirty = subprocess.check_output(['git', 'status', '--porcelain'], text=True).strip() != ''
        return f'v{v}-{commit}' + ('-dirty' if dirty else '')
    except (OSError, subprocess.CalledProcessError):
        return f'v{v}'


def main() -> int:
    src = sys.argv[1]
    out = f'{sys.argv[2]}-{version()}.zip'
    if not os.path.isfile(os.path.join(src, 'index.html')):
        print(f'{src}/index.html not found — build first', file=sys.stderr)
        return 1
    total = count = 0
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for folder, _, files in os.walk(src):
            for name in sorted(files):
                path = os.path.join(folder, name)
                arc = os.path.relpath(path, src).replace(os.sep, '/')
                z.write(path, arc)
                total += os.path.getsize(path)
                count += 1
    print(f'{out}: {count} files, {total // 1024} KB unzipped, {os.path.getsize(out) // 1024} KB zipped')
    return 0


if __name__ == '__main__':
    sys.exit(main())
