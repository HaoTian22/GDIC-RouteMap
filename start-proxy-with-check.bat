@echo off
chcp 65001 >nul 2>&1
echo ====================================
echo 12306代理服务器环境检查
echo ====================================

echo.
echo 1. 检查Node.js是否安装...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装或未添加到PATH
    echo.
    echo 请按以下步骤安装Node.js:
    echo 1. 访问 https://nodejs.org/
    echo 2. 下载LTS版本
    echo 3. 安装时勾选 "Add to PATH"
    echo 4. 重启命令提示符后重新运行此文件
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js 已安装: %NODE_VERSION%

echo.
echo 2. 检查NPM是否可用...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ NPM 不可用
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ NPM 已安装: %NPM_VERSION%

echo.
echo 3. 进入Proxy目录...
cd /d "%~dp0Proxy"
if %errorlevel% neq 0 (
    echo ❌ 无法进入Proxy目录
    pause
    exit /b 1
)
echo ✅ 已进入Proxy目录

echo.
echo 4. 检查依赖是否已安装...
if not exist node_modules (
    echo 📦 正在安装依赖包...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ 依赖已存在
)

echo.
echo 5. 启动代理服务器...
echo ====================================
echo 代理服务器正在启动...
echo 请保持此窗口打开
echo 如需停止服务器，按 Ctrl+C
echo ====================================
echo.

node server.js

echo.
echo 服务器已停止运行
pause
