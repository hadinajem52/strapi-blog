# IDOR (Insecure Direct Object Reference) Test Script
# Tests if users can modify/delete other users' blog posts

$API_BASE = "http://localhost:1337/api"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IDOR Vulnerability Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test credentials - You need two different user accounts
$User1 = @{
    email = "attacker@test.com"
    password = "Attacker123!"
}

$User2 = @{
    email = "victim@test.com"
    password = "Victim123!"
}

# Function to register a user (if not exists)
function Register-User($email, $password) {
    $body = @{
        username = $email.Split("@")[0]
        email = $email
        password = $password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/auth/local/register" -Method POST -Body $body -ContentType "application/json" -ErrorAction SilentlyContinue
        return $response.jwt
    } catch {
        # User might already exist, try to login
        return $null
    }
}

# Function to login a user
function Login-User($email, $password) {
    $body = @{
        identifier = $email
        password = $password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/auth/local" -Method POST -Body $body -ContentType "application/json"
        return $response.jwt
    } catch {
        Write-Host "Login failed for $email : $_" -ForegroundColor Red
        return $null
    }
}

# Function to create a blog post (using multipart/form-data format expected by Strapi)
function Create-BlogPost($token, $title, $content) {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    # Strapi expects the data as a JSON string in a 'data' field (FormData style)
    $dataJson = @{
        title = $title
        content = $content
    } | ConvertTo-Json -Compress
    
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"data`"",
        "",
        $dataJson,
        "--$boundary--"
    ) -join $LF
    
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/blogs" -Method POST -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary" -Headers $headers
        return $response.data.id
    } catch {
        Write-Host "Failed to create blog post: $_" -ForegroundColor Red
        return $null
    }
}

# Function to attempt updating another user's post
function Test-UpdateOtherPost($attackerToken, $victimPostId) {
    $headers = @{
        "Authorization" = "Bearer $attackerToken"
    }
    $body = @{
        data = @{
            title = "HACKED BY ATTACKER"
            content = "This post has been modified by an attacker!"
        }
    } | ConvertTo-Json -Depth 3
    
    try {
        $response = Invoke-WebRequest -Uri "$API_BASE/blogs/$victimPostId" -Method PUT -Body $body -ContentType "application/json" -Headers $headers -ErrorAction Stop
        return @{
            Status = $response.StatusCode
            Success = $true
            Message = "VULNERABLE - Post was modified!"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        return @{
            Status = $statusCode
            Success = $false
            Message = "Protected - Cannot modify other user's post"
        }
    }
}

# Function to attempt deleting another user's post
function Test-DeleteOtherPost($attackerToken, $victimPostId) {
    $headers = @{
        "Authorization" = "Bearer $attackerToken"
    }
    
    try {
        $response = Invoke-WebRequest -Uri "$API_BASE/blogs/$victimPostId" -Method DELETE -Headers $headers -ErrorAction Stop
        return @{
            Status = $response.StatusCode
            Success = $true
            Message = "VULNERABLE - Post was deleted!"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        return @{
            Status = $statusCode
            Success = $false
            Message = "Protected - Cannot delete other user's post"
        }
    }
}

# ============ MAIN TEST FLOW ============

Write-Host "[Step 1] Setting up test users..." -ForegroundColor Yellow

# Register/Login User 1 (Attacker)
Write-Host "  Registering/Logging in attacker account..."
Register-User $User1.email $User1.password | Out-Null
$attackerToken = Login-User $User1.email $User1.password

if (-not $attackerToken) {
    Write-Host "  Failed to authenticate attacker. Exiting." -ForegroundColor Red
    exit 1
}
Write-Host "  Attacker authenticated successfully" -ForegroundColor Green

# Register/Login User 2 (Victim)
Write-Host "  Registering/Logging in victim account..."
Register-User $User2.email $User2.password | Out-Null
$victimToken = Login-User $User2.email $User2.password

if (-not $victimToken) {
    Write-Host "  Failed to authenticate victim. Exiting." -ForegroundColor Red
    exit 1
}
Write-Host "  Victim authenticated successfully" -ForegroundColor Green

Write-Host ""
Write-Host "[Step 2] Creating victim's blog post..." -ForegroundColor Yellow
$victimPostId = Create-BlogPost $victimToken "Victim's Private Post" "This is victim's confidential content that should not be modified by others."

if (-not $victimPostId) {
    Write-Host "  Failed to create victim's post. Trying to find existing posts..." -ForegroundColor Yellow
    
    # Try to get existing posts
    try {
        $posts = Invoke-RestMethod -Uri "$API_BASE/blogs" -Method GET
        if ($posts.data.Count -gt 0) {
            $victimPostId = $posts.data[0].id
            Write-Host "  Using existing post ID: $victimPostId" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  No posts found. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host "  Victim's post created with ID: $victimPostId" -ForegroundColor Green

Write-Host ""
Write-Host "[Step 3] Testing IDOR - Attacker trying to MODIFY victim's post..." -ForegroundColor Yellow
$updateResult = Test-UpdateOtherPost $attackerToken $victimPostId

if ($updateResult.Success) {
    Write-Host "  [VULNERABLE] $($updateResult.Message)" -ForegroundColor Red
    Write-Host "  Status Code: $($updateResult.Status)" -ForegroundColor Red
} else {
    Write-Host "  [PROTECTED] $($updateResult.Message)" -ForegroundColor Green
    Write-Host "  Status Code: $($updateResult.Status)" -ForegroundColor Green
}

Write-Host ""
Write-Host "[Step 4] Testing IDOR - Attacker trying to DELETE victim's post..." -ForegroundColor Yellow
$deleteResult = Test-DeleteOtherPost $attackerToken $victimPostId

if ($deleteResult.Success) {
    Write-Host "  [VULNERABLE] $($deleteResult.Message)" -ForegroundColor Red
    Write-Host "  Status Code: $($deleteResult.Status)" -ForegroundColor Red
} else {
    Write-Host "  [PROTECTED] $($deleteResult.Message)" -ForegroundColor Green
    Write-Host "  Status Code: $($deleteResult.Status)" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IDOR Test Results Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results = @{
    updateOtherPost = @{
        postId = $victimPostId
        attacker = $User1.email
        victim = $User2.email
        status = $updateResult.Status
        success = $updateResult.Success
    }
    deleteOtherPost = @{
        postId = $victimPostId
        status = $deleteResult.Status
        success = $deleteResult.Success
    }
}

Write-Host "JSON Evidence:" -ForegroundColor Yellow
$results | ConvertTo-Json -Depth 3

Write-Host ""
if ($updateResult.Success -or $deleteResult.Success) {
    Write-Host "OVERALL: IDOR VULNERABILITY DETECTED!" -ForegroundColor Red
} else {
    Write-Host "OVERALL: IDOR PROTECTION IS WORKING" -ForegroundColor Green
}
