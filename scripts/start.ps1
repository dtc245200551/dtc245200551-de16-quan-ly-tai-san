param([switch]$BaseOnly)
$ErrorActionPreference = 'Stop'
$linuxProject = '/home/hai/projects/de16-quan-ly-tai-san'
if ($BaseOnly) {
    wsl -d Ubuntu-24.04 -u hai --cd $linuxProject -- env BASE_ONLY=1 sh scripts/start.sh
} else {
    wsl -d Ubuntu-24.04 -u hai --cd $linuxProject -- sh scripts/start.sh
}
if ($LASTEXITCODE -ne 0) { throw 'Khoi dong trong Ubuntu WSL2 that bai.' }
