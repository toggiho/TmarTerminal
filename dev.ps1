# TmarTerminal dev launcher
# Run this instead of "npx tauri dev" to set up MSVC environment automatically

$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (Test-Path $vcvars) {
    Write-Host "Loading MSVC environment..." -ForegroundColor Cyan
    cmd /c "`"$vcvars`" && set" | Where-Object { $_ -match "^[^=]+=.*" } | ForEach-Object {
        $name, $value = $_ -split "=", 2
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
    $rustPath = [System.Environment]::GetEnvironmentVariable("PATH","User")
    $env:PATH = $env:PATH + ";" + $rustPath
    Write-Host "MSVC environment ready" -ForegroundColor Green
} else {
    Write-Host "Warning: VS Build Tools not found at expected path" -ForegroundColor Yellow
}

Write-Host "Starting TmarTerminal dev server..." -ForegroundColor Cyan
npx tauri dev
