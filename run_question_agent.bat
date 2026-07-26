@echo off
setlocal
cd /d "%~dp0"

if "%QUESTION_AGENT_API_URL%"=="" set QUESTION_AGENT_API_URL=http://localhost:3001/api/agent/refresh
if "%QUESTION_AGENT_INTERVAL_MINUTES%"=="" set QUESTION_AGENT_INTERVAL_MINUTES=60
if "%QUESTION_AGENT_ENABLE_WEB_SEARCH%"=="" set QUESTION_AGENT_ENABLE_WEB_SEARCH=1

echo Starting AI Question Bank refresh agent...
echo API: %QUESTION_AGENT_API_URL%
echo Queue: scripts\question-agent-queue.json
echo.

node scripts\question-agent.js
