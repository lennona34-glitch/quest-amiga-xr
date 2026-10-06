@echo off
cd /d "%~dp0"
py -m pip install --quiet pillow
py shortcut_editor.py
