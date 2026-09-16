#!/usr/bin/env bash
# draw.io ships inside the app so diagrams work offline; vite copies public/ into the bundle.
# The servlet half (WEB-INF, META-INF) is Java for self-hosting and is dropped.
# Without this, the app's fallback serves its own index.html inside the diagram iframe.
set -euo pipefail
[ -f public/drawio/index.html ] && exit 0
curl -fsSL -o draw.war https://github.com/jgraph/drawio/releases/download/v31.4.5/draw.war
mkdir -p public/drawio
unzip -q draw.war -d public/drawio
rm -rf draw.war public/drawio/WEB-INF public/drawio/META-INF
