@echo off
echo ====================================
echo 启动12306代理服务器
echo ====================================
cd /d "%~dp0\Proxy"
echo 正在启动服务器...
node server.js
pause
