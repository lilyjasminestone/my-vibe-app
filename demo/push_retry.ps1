$maxRetries = 5
$retryCount = 0
$success = $false

git add api/entry.py next.config.ts
git commit -m "Rename index.py to entry.py and add error handling wrapper"

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
