#!/bin/bash
# 给任意一个历史版本重新截图（静音无头浏览器）
# 用法: releases/shot.sh <版本目录名> [输出目录]
#   v1.x 走 test/run.mjs，v2.x 走 v2/test/play.mjs + models.mjs
cd "$(dirname "$0")/.."
V="$1"; OUT="${2:-releases/$V}"; mkdir -p "$OUT"
HTML=$(ls "$PWD/releases/$V"/*.html | head -1)
case "$V" in
  v1*) node test/run.mjs "$HTML" "$PWD/$OUT" ;;
  *)   node v2/test/play.mjs "$HTML" "$PWD/$OUT"; grep -q poseAll "$HTML" && node v2/test/models.mjs "$HTML" "$PWD/$OUT" ;;
esac
