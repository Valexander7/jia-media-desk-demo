#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p firebase-hosting
cp index.html live.html live.js live-config.js jia-logo-green.png firebase-hosting/
