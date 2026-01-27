#!/bin/bash
# Setup and Verification Script
# Run this after implementing security fixes

echo "======================================"
echo "Security Fixes Setup & Verification"
echo "======================================"
echo ""

# Step 1: Check Node.js version
echo "✓ Checking Node.js version..."
node --version

# Step 2: Check npm packages
echo ""
echo "✓ Checking installed packages..."
npm list nodemailer @upstash/redis @upstash/ratelimit --depth=0

# Step 3: Check environment variables
echo ""
echo "✓ Checking environment configuration..."
if [ -f ".env.local" ]; then
    echo "  ✓ .env.local exists"
    
    # Check for email config
    if grep -q "SMTP_HOST" .env.local || grep -q "SENDGRID_API_KEY" .env.local; then
        echo "  ✓ Email service configured"
    else
        echo "  ⚠ WARNING: Email service not configured - user creation will fail!"
        echo "    Please configure SMTP_* or SENDGRID_API_KEY in .env.local"
    fi
    
    # Check for Firebase config
    if grep -q "FIREBASE_PRIVATE_KEY" .env.local; then
        echo "  ✓ Firebase Admin configured"
    else
        echo "  ⚠ WARNING: Firebase Admin not configured"
    fi
else
    echo "  ❌ ERROR: .env.local not found"
    echo "    Run: cp .env.example .env.local"
    exit 1
fi

# Step 4: Test build
echo ""
echo "✓ Testing Next.js build..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ All checks passed!"
    echo "======================================"
    echo ""
    echo "Next steps:"
    echo "1. Configure email service in .env.local (SMTP_* or SENDGRID_API_KEY)"
    echo "2. Run: firebase login --reauth"
    echo "3. Run: firebase deploy --only firestore:rules"
    echo "4. Test user creation through admin panel"
    echo "5. Deploy to production"
    echo ""
else
    echo ""
    echo "❌ Build failed! Please fix errors above."
    exit 1
fi
