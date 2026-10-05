#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p firebase-hosting
cp index.html demo.html live.html live.js live-config.js program.html program.js sunday-reminders.js tally.html visuals.html roadmap.html register.html register.js qrcode.js tally.js signin-help.js jia.css jia-logo-green.png jia-logo-176.png firebase-hosting/
