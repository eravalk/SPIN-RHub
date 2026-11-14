#!/usr/bin/env python3
"""Single source of version truth: final.feature.fix.hotfix + Android build counter."""
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERN = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\Z")

def bump(version, kind):
    if not PATTERN.fullmatch(version):
        raise ValueError("Version must contain four non-negative integer components")
    parts = [int(p) for p in version.split('.')]
    index = {"final": 0, "feature": 1, "fix": 2, "hotfix": 3}[kind]
    parts[index] += 1
    parts[index + 1:] = [0] * (3 - index)
    return '.'.join(map(str, parts))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bump', choices=['final', 'feature', 'fix', 'hotfix'])
    parser.add_argument('--values', action='store_true')
    args = parser.parse_args()
    config = dict(line.split('=', 1) for line in (ROOT / 'version.properties').read_text().splitlines() if '=' in line and not line.startswith('#'))
    version, code = config['versionName'], int(config['versionCode'])
    if not PATTERN.fullmatch(version) or not 0 < code <= 2100000000:
        raise SystemExit('Invalid version.properties')
    if args.bump:
        version, code = bump(version, args.bump), code + 1
        if code > 2100000000:
            raise SystemExit('Android versionCode limit exceeded')
        (ROOT / 'version.properties').write_text(f'versionName={version}\nversionCode={code}\n')
    (ROOT / 'app/src/main/assets/app-version.js').write_text(f'window.SPIN_VERSION = "{version}";\nwindow.SPIN_VERSION_CODE = {code};\n')
    print(f'{version} {code}' if args.values else version)

if __name__ == '__main__':
    main()
