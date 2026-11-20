#!/bin/bash
# 用法: ./build.sh [preview]  —— 拼接为单个 HTML
cd "$(dirname "$0")"
MODE=${1:-game}
if [ "$MODE" = preview ]; then JS="src/01-core.js src/02-tex.js src/03-sky.js src/04-world.js src/10-post.js src/99-preview.js"; OUT=preview.html
else JS="src/01-core.js src/02-tex.js src/03-sky.js src/04-world.js src/05-audio.js src/06-fx.js src/07-weapon.js src/08-enemy.js src/09-hud.js src/10-post.js src/11-main.js"; OUT=die-tomorrow.html; fi
for f in $JS; do node --check "$f" || exit 1; done
{ cat src/00-head.html; printf '<script>\n'; cat ../vendor/three.min.js; printf '\n</script>\n<script>\n"use strict";\n'; cat $JS; printf '\n</script>\n</body>\n</html>\n'; } > "$OUT"
ls -la "$OUT"
