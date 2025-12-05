# Data Encryption Vulnerability Test Script
# Tests for weak JWT configuration and CORS misconfiguration

$API_BASE = "http://localhost:1337"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Data Encryption Vulnerability Tests" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# TEST 1: CORS Misconfiguration (Wildcard Origin)
# ============================================
Write-Host "[TEST 1] CORS Misconfiguration Test" -ForegroundColor Yellow
Write-Host "Checking server CORS configuration..." -ForegroundColor Gray
Write-Host ""
Write-Host "  Note: CORS is enforced by browsers, not servers. PowerShell ignores CORS." -ForegroundColor Gray
Write-Host "  We check the Access-Control-Allow-Origin header to see what the server allows." -ForegroundColor Gray
Write-Host ""

$maliciousOrigins = @(
    "http://evil-attacker.com",
    "http://malicious-site.net",
    "http://localhost:3000"
)

$corsResults = @()

foreach ($origin in $maliciousOrigins) {
    try {
        # Send preflight OPTIONS request with Origin header
        $response = Invoke-WebRequest -Uri "$API_BASE/_health" -Method GET -Headers @{ "Origin" = $origin } -ErrorAction Stop
        
        $allowedOrigin = $response.Headers["Access-Control-Allow-Origin"]
        $allowedMethods = $response.Headers["Access-Control-Allow-Methods"]
        
        $vulnerable = $false
        if ($allowedOrigin -eq "*") {
            $vulnerable = $true
            Write-Host "  [VULNERABLE] Origin '$origin' -> Server returns: Access-Control-Allow-Origin: *" -ForegroundColor Red
        } elseif ($allowedOrigin -contains $origin) {
            Write-Host "  [ALLOWED] Origin '$origin' -> Explicitly allowed" -ForegroundColor Yellow
        } else {
            Write-Host "  [INFO] Origin '$origin' -> ACAO header: $allowedOrigin" -ForegroundColor Gray
        }
        
        $corsResults += [PSCustomObject]@{
            MaliciousOrigin = $origin
            AllowedOrigin = $allowedOrigin
            Vulnerable = $vulnerable
        }
    } catch {
        Write-Host "  [INFO] Origin '$origin' -> Could not check: $($_.Exception.Message)" -ForegroundColor Gray
    }
}

# Direct config check
Write-Host ""
Write-Host "  Checking server.ts CORS configuration directly..." -ForegroundColor Gray
$configContent = Get-Content "c:\projects\websec\strapi-blog\config\server.ts" -Raw
if ($configContent -match "origin:\s*\['\*'\]" -or $configContent -match 'origin:\s*\["\*"\]') {
    Write-Host "  [VULNERABLE] server.ts contains wildcard CORS: origin: ['*']" -ForegroundColor Red
    $corsResults += [PSCustomObject]@{
        MaliciousOrigin = "CONFIG_CHECK"
        AllowedOrigin = "*"
        Vulnerable = $true
    }
} elseif ($configContent -match "origin:\s*'\*'" -or $configContent -match 'origin:\s*"\*"') {
    Write-Host "  [VULNERABLE] server.ts contains wildcard CORS: origin: '*'" -ForegroundColor Red
} else {
    Write-Host "  [INFO] CORS origin is restricted in config" -ForegroundColor Green
}

Write-Host ""

# ============================================
# TEST 2: Cross-Origin Data Access Simulation
# ============================================
Write-Host "[TEST 2] Hardcoded APP_KEYS Check" -ForegroundColor Yellow
Write-Host "Checking for hardcoded/weak application keys..." -ForegroundColor Gray

$configContent = Get-Content "c:\projects\websec\strapi-blog\config\server.ts" -Raw

if ($configContent -match "keys:\s*\[\s*['""]([^'""]+)['""]") {
    $keyValue = $matches[1]
    Write-Host "  [VULNERABLE] Hardcoded APP_KEY found: '$keyValue'" -ForegroundColor Red
    Write-Host "  APP_KEYS should come from environment variables, not hardcoded!" -ForegroundColor Red
} elseif ($configContent -match "keys:\s*env\.array\(['""]APP_KEYS['""]\)") {
    Write-Host "  [SAFE] APP_KEYS loaded from environment variables" -ForegroundColor Green
} elseif ($configContent -match "keys:\s*\[\s*\]") {
    Write-Host "  [VULNERABLE] APP_KEYS is empty array!" -ForegroundColor Red
} else {
    Write-Host "  [INFO] Could not determine APP_KEYS configuration" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# TEST 2.5: JWT Secret Configuration Check
# ============================================
Write-Host "[TEST 2.5] JWT Secret Configuration Check" -ForegroundColor Yellow
Write-Host "Checking plugins.ts for jwtSecret configuration..." -ForegroundColor Gray

$pluginsContent = Get-Content "c:\projects\websec\strapi-blog\config\plugins.ts" -Raw

if ($pluginsContent -match "jwtSecret") {
    if ($pluginsContent -match "jwtSecret:\s*env\(['""]JWT_SECRET['""]") {
        Write-Host "  [SAFE] jwtSecret is configured from environment variable" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] jwtSecret is configured" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [VULNERABLE] No jwtSecret configured!" -ForegroundColor Red
    Write-Host "  JWT tokens will use Strapi's default weak secret." -ForegroundColor Red
    Write-Host "  Attackers could forge valid JWT tokens!" -ForegroundColor Red
}

Write-Host ""

# ============================================
# TEST 3: JWT Token Analysis
# ============================================
Write-Host "[TEST 3] JWT Token Security Analysis" -ForegroundColor Yellow
Write-Host "Analyzing JWT token configuration..." -ForegroundColor Gray

# First, register and login to get a token
$testEmail = "encryption-test-$(Get-Random)@test.com"
$testPassword = "TestPass123!"

# Register user first
$registerBody = @{
    username = $testEmail.Split("@")[0]
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth/local/register" -Method POST -Body $registerBody -ContentType "application/json" -ErrorAction Stop
    $token = $registerResponse.jwt
    Write-Host "  [INFO] Successfully registered and obtained JWT token" -ForegroundColor Gray
} catch {
    # If registration fails, try logging in with existing test account
    Write-Host "  [INFO] Registration failed, trying existing account..." -ForegroundColor Gray
    $loginBody = @{
        identifier = "attacker@test.com"
        password = "Attacker123!"
    } | ConvertTo-Json
    
    try {
        $loginResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth/local" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction Stop
        $token = $loginResponse.jwt
        Write-Host "  [INFO] Successfully obtained JWT token via login" -ForegroundColor Gray
    } catch {
        Write-Host "  [ERROR] Could not obtain JWT token: $($_.Exception.Message)" -ForegroundColor Red
        $token = $null
    }
}

if ($token) {
    
    # Decode JWT (base64) to analyze structure
    $tokenParts = $token.Split('.')
    
    if ($tokenParts.Count -eq 3) {
        # Decode header
        $header = $tokenParts[0]
        # Add padding if needed
        $headerPadded = $header.Replace('-', '+').Replace('_', '/')
        switch ($headerPadded.Length % 4) {
            2 { $headerPadded += '==' }
            3 { $headerPadded += '=' }
        }
        $headerDecoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($headerPadded)) | ConvertFrom-Json
        
        # Decode payload
        $payload = $tokenParts[1]
        $payloadPadded = $payload.Replace('-', '+').Replace('_', '/')
        switch ($payloadPadded.Length % 4) {
            2 { $payloadPadded += '==' }
            3 { $payloadPadded += '=' }
        }
        $payloadDecoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadPadded)) | ConvertFrom-Json
        
        Write-Host ""
        Write-Host "  JWT Header:" -ForegroundColor Cyan
        Write-Host "    Algorithm: $($headerDecoded.alg)" -ForegroundColor White
        Write-Host "    Type: $($headerDecoded.typ)" -ForegroundColor White
        
        Write-Host ""
        Write-Host "  JWT Payload:" -ForegroundColor Cyan
        Write-Host "    User ID: $($payloadDecoded.id)" -ForegroundColor White
        
        # Convert Unix timestamp to readable date
        $issuedAt = [DateTimeOffset]::FromUnixTimeSeconds($payloadDecoded.iat).DateTime
        $expiresAt = [DateTimeOffset]::FromUnixTimeSeconds($payloadDecoded.exp).DateTime
        $tokenLifetime = $expiresAt - $issuedAt
        
        Write-Host "    Issued At: $issuedAt" -ForegroundColor White
        Write-Host "    Expires At: $expiresAt" -ForegroundColor White
        Write-Host "    Token Lifetime: $($tokenLifetime.Days) days" -ForegroundColor White
        
        Write-Host ""
        Write-Host "  Security Analysis:" -ForegroundColor Yellow
        
        # Check for weak algorithm
        if ($headerDecoded.alg -eq "HS256") {
            Write-Host "    [WARNING] Using HS256 - vulnerable to brute force if secret is weak" -ForegroundColor Yellow
        }
        
        # Check token lifetime
        if ($tokenLifetime.Days -gt 1) {
            Write-Host "    [WARNING] Long token lifetime ($($tokenLifetime.Days) days) - increases risk if token is stolen" -ForegroundColor Yellow
        }
        
        # Check jwtSecret config status (re-read to get current state)
        $pluginsCheck = Get-Content "c:\projects\websec\strapi-blog\config\plugins.ts" -Raw
        if ($pluginsCheck -match "jwtSecret") {
            Write-Host "    [SAFE] jwtSecret is configured" -ForegroundColor Green
        } else {
            Write-Host "    [VULNERABLE] No jwtSecret configured - using default/weak secret" -ForegroundColor Red
        }
        
        # Check APP_KEYS config status
        $serverCheck = Get-Content "c:\projects\websec\strapi-blog\config\server.ts" -Raw
        if ($serverCheck -match "keys:\s*env\.array") {
            Write-Host "    [SAFE] APP_KEYS loaded from environment variables" -ForegroundColor Green
        } else {
            Write-Host "    [VULNERABLE] Hardcoded APP_KEYS instead of environment variables" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  [SKIPPED] JWT analysis skipped - could not obtain token" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# TEST 4: Credential Transmission Check
# ============================================
Write-Host "[TEST 4] Credential Transmission Analysis" -ForegroundColor Yellow
Write-Host "Checking if credentials are transmitted securely..." -ForegroundColor Gray

$protocol = ([System.Uri]$API_BASE).Scheme
if ($protocol -eq "http") {
    Write-Host "  [VULNERABLE] API is using HTTP (not HTTPS)" -ForegroundColor Red
    Write-Host "  Credentials and tokens are transmitted in plaintext!" -ForegroundColor Red
    Write-Host "  An attacker on the network can intercept:" -ForegroundColor Red
    Write-Host "    - Login credentials (username/password)" -ForegroundColor Red
    Write-Host "    - JWT tokens" -ForegroundColor Red
    Write-Host "    - Session cookies" -ForegroundColor Red
} else {
    Write-Host "  [SAFE] API is using HTTPS - data is encrypted in transit" -ForegroundColor Green
}

Write-Host ""

# ============================================
# SUMMARY
# ============================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  VULNERABILITY SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Dynamically build vulnerabilities list based on actual config state
$vulnerabilities = @()

# Check CORS
$serverConfig = Get-Content "c:\projects\websec\strapi-blog\config\server.ts" -Raw
if ($serverConfig -match "origin:\s*\['\*'\]" -or $serverConfig -match 'origin:\s*\["\*"\]') {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "Wildcard CORS Configuration"
        Severity = "MEDIUM"
        Impact = "Any website can make API requests, enabling CSRF and data theft"
        Status = "VULNERABLE"
    }
} else {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "CORS Configuration"
        Severity = "INFO"
        Impact = "CORS is restricted to specific origins"
        Status = "SAFE"
    }
}

# Check JWT Secret
$pluginsConfig = Get-Content "c:\projects\websec\strapi-blog\config\plugins.ts" -Raw
if ($pluginsConfig -match "jwtSecret") {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "JWT Secret Configuration"
        Severity = "INFO"
        Impact = "JWT tokens are signed with a configured secret"
        Status = "SAFE"
    }
} else {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "No JWT Secret Configured"
        Severity = "CRITICAL"
        Impact = "Tokens signed with weak/default secret can be forged"
        Status = "VULNERABLE"
    }
}

# Check APP_KEYS
if ($serverConfig -match "keys:\s*env\.array") {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "APP_KEYS Configuration"
        Severity = "INFO"
        Impact = "APP_KEYS loaded from environment variables"
        Status = "SAFE"
    }
} else {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "Hardcoded APP_KEYS"
        Severity = "HIGH"
        Impact = "Session/cookie signing uses predictable keys"
        Status = "VULNERABLE"
    }
}

# Check HTTPS
$protocol = ([System.Uri]$API_BASE).Scheme
if ($protocol -eq "http") {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "HTTP Instead of HTTPS"
        Severity = "CRITICAL"
        Impact = "All data transmitted in plaintext - vulnerable to MITM attacks"
        Status = "VULNERABLE"
    }
} else {
    $vulnerabilities += [PSCustomObject]@{
        Issue = "HTTPS Enabled"
        Severity = "INFO"
        Impact = "Data is encrypted in transit"
        Status = "SAFE"
    }
}

foreach ($vuln in $vulnerabilities) {
    $color = switch ($vuln.Status) {
        "SAFE" { "Green" }
        "VULNERABLE" { 
            switch ($vuln.Severity) {
                "CRITICAL" { "Red" }
                "HIGH" { "Magenta" }
                "MEDIUM" { "Yellow" }
                default { "White" }
            }
        }
        default { "White" }
    }
    $statusIcon = if ($vuln.Status -eq "SAFE") { "[SAFE]" } else { "[$($vuln.Severity)]" }
    Write-Host "$statusIcon $($vuln.Issue)" -ForegroundColor $color
    Write-Host "   $($vuln.Impact)" -ForegroundColor Gray
    Write-Host ""
}

# Output JSON results
$results = @{
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
    corsTest = $corsResults
    vulnerabilities = $vulnerabilities
}

$jsonOutput = $results | ConvertTo-Json -Depth 5
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  JSON OUTPUT" -ForegroundColor Cyan  
Write-Host "============================================" -ForegroundColor Cyan
Write-Host $jsonOutput

Write-Host ""
Write-Host "Test completed." -ForegroundColor Green
