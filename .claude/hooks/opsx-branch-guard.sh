#!/usr/bin/env bash
# PreToolUse hook (matcher: Skill).
# Cuando se invoca una skill de OpenSpec que ESCRIBE artefactos (propose) o
# implementa (apply), inyecta contexto para forzar el trabajo en una rama
# dedicada con nombre estándar `change/<change-id>`, creada desde main.
#
# `opsx:explore` NO dispara rama a propósito: es reflexión de solo-lectura.
# El nombrado se delega en el modelo porque en el momento de `propose` el
# change-id todavía no existe (lo crea la propia skill).
set -euo pipefail

payload=$(cat)
skill=$(printf '%s' "$payload" | jq -r '.tool_input.skill // empty')

case "$skill" in
  opsx:propose | opsx:apply)
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "desconocida")
    msg="[flujo-ramas MotoCiudad] Vas a ejecutar ${skill}. Rama actual: ${branch}. \
Antes de escribir cambios de la feature, asegúrate de estar en una rama dedicada \
con nombre '<tipo>/<change-id>', creada desde main. El <tipo> sigue Conventional Commits \
segun la naturaleza de lo explorado: feat (por defecto, mejoras), fix (correcciones), \
o chore|docs|test|refactor|perf segun corresponda. El <change-id> es el de OpenSpec en kebab-case. \
Si estas en 'main' o 'finalproject-CMH', crea y cambiate a esa rama ANTES de tocar ficheros \
(en propose, en cuanto la skill haya creado el change-id). Deja finalproject-CMH intacta. \
Registra la nueva linea de trabajo en entrega-final-mejorasposteriores-CMH.md \
(rama, que/por que/como, estado)."
    jq -n --arg m "$msg" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: $m
      }
    }'
    ;;
  *)
    : # cualquier otra skill: no hacemos nada
    ;;
esac
