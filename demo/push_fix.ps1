$maxRetries = 10
$retryCount = 0
$success = $false

# Ensure index.py is removed from git
Write-Output "Staging deletion of api/index.py..."
git rm api/index.py --ignore-unmatch
git commit -m "Remove conflicting index.py to fix 405 error"

while (-not $success -and $retryCount -lt $maxRetries) {
    Write-Output "Attempting git push (Attempt $($retryCount + 1))..."
    try {
        git push origin master
        if ($LASTEXITCODE -eq 0) {
            Write-Output "Git push successful!"
            $success = $true
        } else {
            throw "Git push failed with exit code $LASTEXITCODE"
        }
    } catch {
        Write-Output "Error: $_"
        Start-Sleep -Seconds 5
        $retryCount++
    }
}

if (-not $success) {
    Write-Output "Failed to push after $maxRetries attempts."
    exit 1
}
