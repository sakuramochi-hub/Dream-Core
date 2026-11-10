@echo off
setlocal
cd /d "%~dp0"
title Galgame8 - Local Server

chcp 65001 >nul

echo ========================================
echo   放課後の8回目 - ローカルサーバー
echo ========================================
echo.

echo サーバーを起動しています...
echo 起動後、このウィンドウは閉じずに残ります。
echo ブラウザが自動で開かない場合は、次のURLを開いてください。
echo http://127.0.0.1:8000/
echo.

where py >nul 2>nul
if not errorlevel 1 goto :use_py

where python >nul 2>nul
if not errorlevel 1 goto :use_python

echo [エラー] Python 3 が見つかりません。
echo Python 3 をインストールしてから、もう一度 start.bat を実行してください。
goto :finish_error

:use_py
py -3 "%~dp0start_server.py"
goto :server_finished

:use_python
python "%~dp0start_server.py"
goto :server_finished

:server_finished
set "SERVER_EXIT=%ERRORLEVEL%"
echo.
if "%SERVER_EXIT%"=="0" (
    echo サーバーを終了しました。
) else (
    echo [エラー] サーバーが終了コード %SERVER_EXIT% で停止しました。
    echo 上に表示されたエラーメッセージを確認してください。
)
goto :finish

:finish_error
set "SERVER_EXIT=1"

:finish
echo.
echo このウィンドウはキーを押すまで閉じません。
pause >nul
exit /b %SERVER_EXIT%
