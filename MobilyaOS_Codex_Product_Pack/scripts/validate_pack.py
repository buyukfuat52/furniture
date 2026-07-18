#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import json
import re
import sys
import tomllib

try:
    import yaml
except ImportError:
    yaml = None

root = Path(__file__).resolve().parents[1]
errors: list[str] = []
IGNORED_PARTS = {
    ".git",
    ".mypy_cache",
    ".next",
    ".pytest_cache",
    ".ruff_cache",
    "__pycache__",
    "node_modules",
}


def rel(path: Path) -> str:
    return str(path.relative_to(root))


def is_ignored(path: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return False
    return any(part in IGNORED_PARTS for part in relative.parts)


# JSON syntax.
for path in root.rglob("*.json"):
    if is_ignored(path):
        continue
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Invalid JSON {rel(path)}: {exc}")

# YAML syntax.
yaml_documents: dict[Path, object] = {}
if yaml:
    for path in root.rglob("*.yaml"):
        if is_ignored(path):
            continue
        try:
            yaml_documents[path] = yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"Invalid YAML {rel(path)}: {exc}")
else:
    print("PyYAML not installed; YAML semantic validation skipped", file=sys.stderr)

# Prompt registry references and tool allowlists.
registry = root / "prompts/registry.yaml"
tool_catalog_path = root / "tools/tool_catalog.json"
if yaml and registry.exists():
    data = yaml_documents.get(registry)
    if not isinstance(data, dict):
        errors.append("prompts/registry.yaml must contain an object")
    else:
        refs = [data.get("base_prompt", {}).get("path"), data.get("base_prompt", {}).get("output_schema")]
        refs += [a.get("path") for a in data.get("agents", [])]
        refs += list(data.get("templates", {}).values())
        for ref in filter(None, refs):
            if not (root / str(ref)).exists():
                errors.append(f"Missing registry reference: {ref}")

        if tool_catalog_path.exists():
            catalog = json.loads(tool_catalog_path.read_text(encoding="utf-8"))
            tool_names = {tool.get("name") for tool in catalog.get("tools", [])}
            for agent in data.get("agents", []):
                for tool_name in agent.get("allowed_tools", []):
                    if tool_name not in tool_names:
                        errors.append(
                            f"Unknown tool {tool_name!r} in registry agent {agent.get('id', '<missing id>')}"
                        )

# Custom agent TOML schema.
custom_agent_names: set[str] = set()
for path in sorted((root / ".codex/agents").glob("*.toml")):
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Invalid TOML {rel(path)}: {exc}")
        continue
    for field in ("name", "description", "developer_instructions"):
        if not isinstance(data.get(field), str) or not data[field].strip():
            errors.append(f"Missing or empty {field} in {rel(path)}")
    name = data.get("name")
    if isinstance(name, str):
        if name in custom_agent_names:
            errors.append(f"Duplicate custom agent name: {name}")
        custom_agent_names.add(name)

# Orchestration workflow and ownership consistency.
if yaml:
    workflow_path = root / ".codex/orchestration/workflow.yaml"
    ownership_path = root / ".codex/orchestration/file-ownership.yaml"
    if workflow_path.exists():
        workflow = yaml_documents.get(workflow_path)
        if isinstance(workflow, dict):
            workflow_agents = set(workflow.get("agents", []))
            missing = workflow_agents - custom_agent_names
            extra = custom_agent_names - workflow_agents
            for name in sorted(missing):
                errors.append(f"Workflow references missing custom agent: {name}")
            for name in sorted(extra):
                errors.append(f"Custom agent missing from workflow: {name}")
            phase_ids = [phase.get("id") for phase in workflow.get("phases", [])]
            if len(phase_ids) != len(set(phase_ids)):
                errors.append("Duplicate phase IDs in orchestration workflow")
            gate_ids = [phase.get("gate", {}).get("id") for phase in workflow.get("phases", [])]
            if len(gate_ids) != len(set(gate_ids)):
                errors.append("Duplicate gate IDs in orchestration workflow")
        else:
            errors.append(".codex/orchestration/workflow.yaml must contain an object")
    else:
        errors.append("Missing .codex/orchestration/workflow.yaml")

    if ownership_path.exists():
        ownership = yaml_documents.get(ownership_path)
        if isinstance(ownership, dict):
            ownership_agents = set(ownership.get("ownership", {}).keys())
            for name in sorted(ownership_agents - custom_agent_names):
                errors.append(f"File ownership references missing custom agent: {name}")
            for name in sorted(custom_agent_names - ownership_agents):
                errors.append(f"Custom agent missing file ownership entry: {name}")
        else:
            errors.append(".codex/orchestration/file-ownership.yaml must contain an object")
    else:
        errors.append("Missing .codex/orchestration/file-ownership.yaml")

# Skill frontmatter must include name and description.
for path in root.glob(".agents/skills/*/SKILL.md"):
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        errors.append(f"Missing YAML frontmatter in {rel(path)}")
        continue
    if yaml:
        try:
            metadata = yaml.safe_load(match.group(1))
        except Exception as exc:
            errors.append(f"Invalid skill frontmatter {rel(path)}: {exc}")
            continue
        if not isinstance(metadata, dict):
            errors.append(f"Skill frontmatter must be an object in {rel(path)}")
            continue
        for field in ("name", "description"):
            if not isinstance(metadata.get(field), str) or not metadata[field].strip():
                errors.append(f"Missing or empty skill {field} in {rel(path)}")

# Required orchestration files and source-of-truth links.
required_paths = [
    "docs/11_DEVELOPMENT_AGENT_ORCHESTRATION.md",
    ".codex/orchestration/workflow.yaml",
    ".codex/orchestration/file-ownership.yaml",
    ".codex/orchestration/handoff.schema.json",
    ".codex/orchestration/templates/assignment.md",
    ".codex/orchestration/templates/result.md",
]
for ref in required_paths:
    if not (root / ref).exists():
        errors.append(f"Missing orchestration file: {ref}")

if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print("Prompt/product/orchestration pack validation passed.")
