$ErrorActionPreference = 'Stop'
wsl -d Ubuntu-24.04 -u hai --cd /home/hai/projects/de16-quan-ly-tai-san -- sh scripts/stop.sh
if ($LASTEXITCODE -ne 0) { throw 'Dung dich vu trong Ubuntu WSL2 that bai.' }
