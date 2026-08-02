param(
  [string]$PythonExecutable = '',
  [string]$BuildCacheDirectory = ''
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tauriRoot = Split-Path -Parent $scriptRoot
$projectRoot = Split-Path -Parent $tauriRoot
$BuildCacheDirectory = if ([string]::IsNullOrWhiteSpace($BuildCacheDirectory)) {
  Join-Path ([System.IO.Path]::GetTempPath()) 'galwriter-rembg-sidecar'
} else {
  $BuildCacheDirectory
}
$venvRoot = Join-Path $BuildCacheDirectory '.venv'
$buildId = [Guid]::NewGuid().ToString('N')
$pyInstallerWorkDir = Join-Path $BuildCacheDirectory ("pyinstaller-work-" + $buildId)
$pyInstallerSpecDir = Join-Path $BuildCacheDirectory ("pyinstaller-spec-" + $buildId)
$python = Join-Path $venvRoot 'Scripts\python.exe'
$modelDir = Join-Path $tauriRoot 'resources\rembg'
$modelPath = Join-Path $modelDir 'u2netp.onnx'
$binaryDir = Join-Path $tauriRoot 'binaries'
$binaryPath = Join-Path $binaryDir 'rembg-sidecar.exe'
$modelUrl = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx'
$modelMd5 = '8E83CA70E441AB06C318D82300C84806'

if ([string]::IsNullOrWhiteSpace($PythonExecutable)) {
  $PythonExecutable = (& py -3.11 -c 'import sys; print(sys.executable)').Trim()
}
if (-not (Test-Path -LiteralPath $PythonExecutable)) {
  throw "Python 3.11+ is required to build the rembg sidecar. Pass -PythonExecutable <path> when the Python launcher is unavailable."
}

function Invoke-Python {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & $python @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Python command failed: $($Arguments -join ' ')"
  }
}

if (-not (Test-Path -LiteralPath $python)) {
  & $PythonExecutable -m venv $venvRoot
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to create the temporary Python environment for the rembg sidecar.'
  }
}

Invoke-Python -Arguments @('-m', 'pip', 'install', '--quiet', '--upgrade', 'pip')
Invoke-Python -Arguments @('-m', 'pip', 'install', '--quiet', '--requirement', (Join-Path $scriptRoot 'requirements.txt'))

New-Item -ItemType Directory -Force -Path $modelDir, $binaryDir | Out-Null
if (-not (Test-Path -LiteralPath $modelPath)) {
  Write-Host 'Downloading bundled u2netp model (about 4.7 MB)...'
  Invoke-WebRequest -Uri $modelUrl -OutFile $modelPath
}

$actualMd5 = (Get-FileHash -LiteralPath $modelPath -Algorithm MD5).Hash
if ($actualMd5 -ne $modelMd5) {
  Remove-Item -LiteralPath $modelPath -Force
  throw "u2netp checksum did not match. The downloaded model was removed."
}

Invoke-Python -Arguments @(
  '-m', 'PyInstaller', '--noconfirm', '--clean', '--log-level', 'WARN', '--onefile', '--name', 'rembg-sidecar',
  '--distpath', $binaryDir,
  '--workpath', $pyInstallerWorkDir,
  '--specpath', $pyInstallerSpecDir,
  '--collect-all', 'rembg',
  # scipy dynamically exposes NumPy compatibility modules; a targeted import
  # list is brittle and fails after SciPy patch releases.
  '--collect-all', 'scipy',
  '--collect-all', 'pymatting',
  '--collect-submodules', 'rembg.sessions',
  (Join-Path $scriptRoot 'rembg_sidecar.py')
)

if (-not (Test-Path -LiteralPath $binaryPath)) {
  throw 'rembg sidecar build completed without producing rembg-sidecar.exe.'
}

Write-Host "Prepared local rembg resources: $modelPath and $binaryPath"
