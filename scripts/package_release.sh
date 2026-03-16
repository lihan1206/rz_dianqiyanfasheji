#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_NAME="dianqiyanfasheji"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT_DIR/release"
OUT_FILE="$OUT_DIR/${PROJECT_NAME}_release_${STAMP}.tar.gz"

mkdir -p "$OUT_DIR"

# 仅打包发布必需文件，统一排除无关目录与自动化测试文件。
tar -czf "$OUT_FILE" \
  --exclude='.git' \
  --exclude='release' \
  --exclude='**/node_modules' \
  --exclude='**/.venv' \
  --exclude='**/venv' \
  --exclude='**/target' \
  --exclude='**/__pycache__' \
  --exclude='**/.pytest_cache' \
  --exclude='**/tests' \
  --exclude='**/__tests__' \
  --exclude='**/*.test.*' \
  --exclude='**/*.spec.*' \
  --exclude='**/*test*' \
  --exclude='**/*.py' \
  --exclude='*.tar.gz' \
  --exclude='Prompt.md' \
  --exclude='user_rule.md' \
  --exclude='mb1.docx' \
  .

echo "打包完成: $OUT_FILE"
