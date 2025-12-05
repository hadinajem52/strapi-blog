# File Upload Security Test Script
# Tests for malicious file extension blocking

$API_BASE = "http://localhost:1337"

# Get JWT token - you need to be logged in
$AUTH_TOKEN = ""  

# Prompt for token if not set
if ([string]::IsNullOrEmpty($AUTH_TOKEN)) {
    $AUTH_TOKEN = Read-Host "Enter your JWT token"
}

$headers = @{
    "Authorization" = "Bearer $AUTH_TOKEN"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "FILE UPLOAD SECURITY TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Create temporary test files with dangerous extensions
$testFiles = @(
    @{ Extension = ".php"; Content = "<?php echo 'malicious'; ?>"; ContentType = "application/x-php" },
    @{ Extension = ".js"; Content = "alert('XSS')"; ContentType = "application/javascript" },
    @{ Extension = ".html"; Content = "<script>alert('XSS')</script>"; ContentType = "text/html" },
    @{ Extension = ".exe"; Content = "MZ"; ContentType = "application/octet-stream" },
    @{ Extension = ".svg"; Content = "<svg onload='alert(1)'></svg>"; ContentType = "image/svg+xml" }
)

$results = @{}

foreach ($file in $testFiles) {
    $tempFile = [System.IO.Path]::GetTempPath() + "test_malicious" + $file.Extension
    
    # Create the test file
    Set-Content -Path $tempFile -Value $file.Content -NoNewline
    
    Write-Host "Testing upload of $($file.Extension) file..." -ForegroundColor Yellow
    
    try {
        # Build multipart form data
        $boundary = [System.Guid]::NewGuid().ToString()
        $LF = "`r`n"
        
        $bodyLines = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"files`"; filename=`"test_malicious$($file.Extension)`"",
            "Content-Type: $($file.ContentType)",
            "",
            $file.Content,
            "--$boundary--"
        ) -join $LF
        
        $response = Invoke-WebRequest -Uri "$API_BASE/api/upload" `
            -Method POST `
            -Headers $headers `
            -ContentType "multipart/form-data; boundary=$boundary" `
            -Body $bodyLines `
            -ErrorAction Stop
        
        $results[$file.Extension] = @{
            status = $response.StatusCode
            accepted = $true
            message = "Upload successful - VULNERABLE!"
        }
        
        Write-Host "  [VULNERABLE] $($file.Extension) was ACCEPTED (Status: $($response.StatusCode))" -ForegroundColor Red
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($null -eq $statusCode) { $statusCode = 0 }
        
        $results[$file.Extension] = @{
            status = $statusCode
            accepted = $false
            message = "Blocked"
        }
        
        if ($statusCode -eq 403 -or $statusCode -eq 400) {
            Write-Host "  [SECURE] $($file.Extension) was BLOCKED (Status: $statusCode)" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] $($file.Extension) - Status: $statusCode - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    # Clean up temp file
    Remove-Item -Path $tempFile -ErrorAction SilentlyContinue
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Output results as JSON
$jsonResults = $results | ConvertTo-Json -Depth 3
Write-Host $jsonResults

# Summary
$vulnerableCount = ($results.Values | Where-Object { $_.accepted -eq $true }).Count
$blockedCount = ($results.Values | Where-Object { $_.accepted -eq $false }).Count

Write-Host "`n----------------------------------------" -ForegroundColor Cyan
if ($vulnerableCount -gt 0) {
    Write-Host "VERDICT: VULNERABLE - $vulnerableCount dangerous file type(s) accepted!" -ForegroundColor Red
} else {
    Write-Host "VERDICT: SECURE - All dangerous file types blocked" -ForegroundColor Green
}
Write-Host "----------------------------------------`n" -ForegroundColor Cyan
