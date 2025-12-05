for ($i=1; $i -le 10; $i++) {
    Write-Host "Attempt ${i}:"
    curl -X POST http://localhost:1337/api/auth/local -F "identifier=test@example.com" -F "password=wrongpassword"
}