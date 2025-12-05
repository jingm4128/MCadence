# PowerShell script to add Node.js to PATH
# Run this script as Administrator

Write-Host "Setting up Node.js PATH..." -ForegroundColor Green

# Get current PATH
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$nodejsPath = "C:\Program Files\nodejs"

# Check if Node.js is already in PATH
if ($currentPath -like "*$nodejsPath*") {
    Write-Host "Node.js is already in PATH" -ForegroundColor Yellow
} else {
    # Add Node.js to PATH
    $newPath = $currentPath + ";" + $nodejsPath
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    Write-Host "Node.js added to PATH successfully!" -ForegroundColor Green
}

# Verify installation
Write-Host "Verifying Node.js installation..." -ForegroundColor Cyan
try {
    $nodeVersion = & "C:\Program Files\nodejs\node.exe" --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
    
    $npmVersion = & "C:\Program Files\nodejs\npm.cmd" --version
    Write-Host "NPM version: $npmVersion" -ForegroundColor Green
    
    Write-Host "Setup complete! Please restart your terminal to use the new PATH." -ForegroundColor Green
} catch {
    Write-Host "Error verifying Node.js: $_" -ForegroundColor Red
}
