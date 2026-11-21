import importlib.util
from pathlib import Path

source = Path(__file__).resolve().parents[1] / 'tools/version.py'
spec = importlib.util.spec_from_file_location('spin_version', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.bump('1.2.3.4', 'hotfix') == '1.2.3.5'
assert module.bump('1.2.3.4', 'fix') == '1.2.4.0'
assert module.bump('1.2.3.4', 'feature') == '1.3.0.0'
assert module.bump('1.2.3.4', 'final') == '2.0.0.0'
for value in ['1.2.3', '1.2.3.4.5', '-1.2.3.4', '1.02.3.4', '1.2.3.4-beta']:
    assert not module.PATTERN.fullmatch(value)
print('PASS: four-component version validation and resetting subordinate components')
