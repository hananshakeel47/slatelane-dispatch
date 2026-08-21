$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "SlateLane -> Vercel production setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$Root = (Get-Location).Path
$EnvFile = Join-Path $Root ".env.local"

if (-not (Test-Path $EnvFile)) {
    throw ".env.local was not found in $Root"
}

$envMap = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }

    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }

    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1)

    if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    $envMap[$name] = $value
}

$required = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_REPLY_TO",
    "SLATELANE_SENDER_NAME",
    "SLATELANE_BUSINESS_ADDRESS",
    "EMAIL_PROCESS_SECRET"
)

$missing = @()
foreach ($name in $required) {
    if (-not $envMap.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($envMap[$name])) {
        $missing += $name
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing values in .env.local:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    throw "Add the missing values to .env.local, then run this script again."
}

$envMap["SLATELANE_PUBLIC_URL"] = "https://slatelanedispatch.com"

$names = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_REPLY_TO",
    "SLATELANE_PUBLIC_URL",
    "SLATELANE_SENDER_NAME",
    "SLATELANE_BUSINESS_ADDRESS",
    "EMAIL_PROCESS_SECRET"
)

if (
    $envMap.ContainsKey("RESEND_WEBHOOK_SECRET") -and
    -not [string]::IsNullOrWhiteSpace($envMap["RESEND_WEBHOOK_SECRET"])
) {
    $names += "RESEND_WEBHOOK_SECRET"
}

Write-Host ""
Write-Host "1/3 Linking to the correct Vercel project..." -ForegroundColor Yellow

& npx vercel link --yes --project slatelane-dispatch --scope slate-lane-dispatch
if ($LASTEXITCODE -ne 0) {
    throw "Vercel link failed. Run 'npx vercel login' with hananshakeel47@gmail.com and retry."
}

Write-Host ""
Write-Host "2/3 Uploading Production environment variables..." -ForegroundColor Yellow

foreach ($name in $names) {
    $value = $envMap[$name]

    Write-Host "  Setting $name"

    & npx vercel env rm $name production --yes *> $null

    $value | & npx vercel env add $name production

    if ($LASTEXITCODE -ne 0) {
        throw "Failed while setting $name"
    }
}

Write-Host ""
Write-Host "3/3 Starting a clean Production deployment..." -ForegroundColor Yellow

& npx vercel --prod --force --yes
if ($LASTEXITCODE -ne 0) {
    throw "Production deployment failed. Copy only the error text (not secrets) and send it to ChatGPT."
}

Write-Host ""
Write-Host "DONE." -ForegroundColor Green
Write-Host "Open:" -ForegroundColor Green
Write-Host "https://slatelanedispatch.com/api/email/webhook" -ForegroundColor Cyan
Write-Host ""
Write-Host 'Expected:' -ForegroundColor Green
Write-Host '{"success":true,"service":"SlateLane Resend Webhook","status":"ready"}'
