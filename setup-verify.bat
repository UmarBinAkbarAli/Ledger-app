@echo off
REM Setup and Verification Script for Windows
REM Run this after implementing security fixes

echo ======================================
echo Security Fixes Setup and Verification
echo ======================================
echo.

REM Step 1: Check Node.js version
echo [*] Checking Node.js version...
node --version
echo.

REM Step 2: Check npm packages
echo [*] Checking installed packages...
call npm list nodemailer @upstash/redis @upstash/ratelimit --depth=0
echo.

REM Step 3: Check environment variables
echo [*] Checking environment configuration...
if exist ".env.local" (
    echo   [OK] .env.local exists
    
    findstr /C:"SMTP_HOST" .env.local >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo   [OK] Email service configured
    ) else (
        findstr /C:"SENDGRID_API_KEY" .env.local >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo   [OK] Email service configured
        ) else (
            echo   [WARNING] Email service not configured - user creation will fail!
            echo              Please configure SMTP_* or SENDGRID_API_KEY in .env.local
        )
    )
    
    findstr /C:"FIREBASE_PRIVATE_KEY" .env.local >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo   [OK] Firebase Admin configured
    ) else (
        echo   [WARNING] Firebase Admin not configured
    )
) else (
    echo   [ERROR] .env.local not found
    echo           Run: copy .env.example .env.local
    exit /b 1
)
echo.

REM Step 4: Test build
echo [*] Testing Next.js build...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================
    echo [SUCCESS] All checks passed!
    echo ======================================
    echo.
    echo Next steps:
    echo 1. Configure email service in .env.local (SMTP_* or SENDGRID_API_KEY^)
    echo 2. Run: firebase login --reauth
    echo 3. Run: firebase deploy --only firestore:rules
    echo 4. Test user creation through admin panel
    echo 5. Deploy to production
    echo.
) else (
    echo.
    echo [ERROR] Build failed! Please fix errors above.
    exit /b 1
)
