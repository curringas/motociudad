#!/usr/bin/env python3
"""PreToolUse(Bash) hook — bloquea `openspec archive <change>` si falta la evidencia
de verificacion E2E en .claude/verify-runs/<change>.md (la escribe verify-all-platforms).
Enforcement de la regla de cierre: no se archiva un change sin verificar (regla #7)."""
import sys, os, re, json

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

cmd = (data.get("tool_input") or {}).get("command", "") or ""
m = re.search(r"openspec\s+archive\s+([^\s-][^\s]*)", cmd)
if not m:
    sys.exit(0)

change = m.group(1)
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
ev = os.path.join(root, ".claude", "verify-runs", f"{change}.md")
if os.path.isfile(ev):
    sys.exit(0)

reason = (
    f"Falta la evidencia de verificacion E2E: .claude/verify-runs/{change}.md. "
    f"Antes de archivar '{change}', ejecuta el skill verify-all-platforms "
    f"(subagente e2e-verifier): web + Android + iOS (o solo web si es panel admin), "
    f"login como usuario y admin donde aplique, y limpieza de datos. Regla no negociable #7."
)
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": reason,
}}))
sys.exit(0)
