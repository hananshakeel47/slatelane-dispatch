$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "SlateLane -> Vercel production setup (fixed)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$Root = (Get-Location).Path
$EnvFile = Join-Path $Root ".env.local"

if (-not (Test-Path $EnvFile)) {
    throw ".env.local was not found in $Root"
}

# ------------------------------------------------------------
# IMPORTANT:
# Vercel CLI prints normal status/version text to STDERR.
# Windows PowerShell can treat that as NativeCommandError when
# ErrorActionPreference = Stop.
#
# This wrapper temporarily uses Continue, captures exit code,
# and only fails when the native command actually returns
# a non-zero exit code.
# ------------------------------------------------------------

function Invoke-Vercel {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,

        [string] $InputValue = $null,

        [switch] $IgnoreExitCode,

        [switch] $Quiet
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        if ($null -ne $InputValue) {
            $output = $InputValue | & npx.cmd vercel @Arguments 2>&1
        }
        else {
            $output = & npx.cmd vercel @Arguments 2>&1
        }

        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }

    if (-not $Quiet -and $output) {
        $output | ForEach-Object {
            Write-Host $_
        }
    }

    if (($exitCode -ne 0) -and (-not $IgnoreExitCode)) {
        throw "Vercel command failed with exit code $exitCode: vercel $($Arguments -join ' ')"
    }

    return $exitCode
}


# ------------------------------------------------------------
# PARSE .env.local WITHOUT PRINTING SECRETS
# ------------------------------------------------------------

$envMap = @{}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()

    if (-not $line) {
        return
    }

    if ($line.StartsWith("#")) {
        return
    }

    $eq = $line.IndexOf("=")

    if ($eq -lt 1) {
        return
    }

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


# ------------------------------------------------------------
# REQUIRED VARIABLES
# ------------------------------------------------------------

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
    if (
        (-not $envMap.ContainsKey($name)) -or
        [string]::IsNullOrWhiteSpace($envMap[$name])
    ) {
        $missing += $name
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing values in .env.local:" -ForegroundColor Red

    $missing | ForEach-Object {
        Write-Host "  - $_" -ForegroundColor Red
    }

    throw "Add the missing values to .env.local, then run this script again."
}


# Production must not create unsubscribe links to localhost.
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


# Add webhook secret only if it already exists locally.
if (
    $envMap.ContainsKey("RESEND_WEBHOOK_SECRET") -and
    (-not [string]::IsNullOrWhiteSpace($envMap["RESEND_WEBHOOK_SECRET"]))
) {
    $names += "RESEND_WEBHOOK_SECRET"
}


# ------------------------------------------------------------
# 1. LINK PROJECT
# ------------------------------------------------------------

Write-Host ""
Write-Host "1/3 Linking to SlateLane Vercel project..." -ForegroundColor Yellow

Invoke-Vercel -Arguments @(
    "link",
    "--yes",
    "--project",
    "slatelane-dispatch",
    "--scope",
    "slate-lane-dispatch"
) | Out-Null


# ------------------------------------------------------------
# 2. PRODUCTION ENV VARIABLES
# ------------------------------------------------------------

Write-Host ""
Write-Host "2/3 Uploading Production environment variables..." -ForegroundColor Yellow


foreach ($name in $names) {
    $value = $envMap[$name]

    Write-Host "  Setting $name" -ForegroundColor Gray

    # Removing a non-existent variable is allowed to fail.
    Invoke-Vercel `
        -Arguments @(
            "env",
            "rm",
            $name,
            "production",
            "--yes"
        ) `
        -IgnoreExitCode `
        -Quiet | Out-Null

    # Add the value through STDIN so it is never echoed by us.
    Invoke-Vercel `
        -Arguments @(
            "env",
            "add",
            $name,
            "production"
        ) `
        -InputValue $value | Out-Null
}


# ------------------------------------------------------------
# 3. CLEAN PRODUCTION DEPLOYMENT
# ------------------------------------------------------------

Write-Host ""
Write-Host "3/3 Starting clean Production deployment..." -ForegroundColor Yellow

Invoke-Vercel -Arguments @(
    "--prod",
    "--force",
    "--yes"
) | Out-Null


Write-Host ""
Write-Host "SUCCESS." -ForegroundColor Green
Write-Host ""
Write-Host "When Vercel finishes deploying, open:" -ForegroundColor Green
Write-Host "https://slatelanedispatch.com/api/email/webhook" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected response:" -ForegroundColor Green
Write-Host '{"success":true,"service":"SlateLane Resend Webhook","status":"ready"}'
Write-Host ""
