$ErrorActionPreference = 'Stop'
wsl -d Ubuntu-24.04 -u hai --cd /home/hai/projects/de16-quan-ly-tai-san -- sh scripts/prepare.sh
if ($LASTEXITCODE -ne 0) { throw 'Chuan bi secrets trong Ubuntu WSL2 that bai.' }
