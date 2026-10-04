#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p firebase-hosting
cp index.html demo.html live.html live.js live-config.js program.html program.js sunday-reminders.js tally.html visuals.html tally.js signin-help.js jia.css jia-logo-green.png firebase-hosting/
