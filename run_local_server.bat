@echo off
cd /d "%~dp0"
set NODE_OPTIONS=--max-old-space-size=4096
npm.cmd run dev -- -p 3001 >> dev-server.out.log 2>> dev-server.err.log
