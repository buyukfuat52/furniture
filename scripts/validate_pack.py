#!/usr/bin/env python3
from pathlib import Path
import json, sys
try:
    import yaml
except ImportError:
    yaml = None

root = Path(__file__).resolve().parents[1]
errors = []

for path in root.rglob('*.json'):
    try:
        json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f"Invalid JSON {path.relative_to(root)}: {exc}")

if yaml:
    for path in root.rglob('*.yaml'):
        try:
            yaml.safe_load(path.read_text(encoding='utf-8'))
        except Exception as exc:
            errors.append(f"Invalid YAML {path.relative_to(root)}: {exc}")
else:
    print('PyYAML not installed; YAML syntax validation skipped', file=sys.stderr)

registry = root / 'prompts/registry.yaml'
if yaml and registry.exists():
    data = yaml.safe_load(registry.read_text(encoding='utf-8'))
    refs = [data['base_prompt']['path'], data['base_prompt']['output_schema']]
    refs += [a['path'] for a in data.get('agents', [])]
    refs += list(data.get('templates', {}).values())
    for ref in refs:
        if not (root / ref).exists():
            errors.append(f"Missing registry reference: {ref}")

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('Prompt/product pack validation passed.')
