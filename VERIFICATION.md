# ✅ File Verification Checklist

## 📋 Pre-Flight Checklist

Use this checklist to verify your setup before running the application.

### ✅ Required Files Present

- [ ] `README.md` - Main documentation
- [ ] `SETUP_GUIDE.md` - Detailed setup instructions
- [ ] `setup.sh` - Automated setup script
- [ ] `.gitignore` - Git ignore rules

#### Frontend Files
- [ ] `frontend/index.html` - HTML entry point
- [ ] `frontend/package.json` - Frontend dependencies
- [ ] `frontend/vite.config.js` - Vite configuration
- [ ] `frontend/src/main.jsx` - React entry point
- [ ] `frontend/src/Dashboard.jsx` - Main dashboard component

#### Backend Files
- [ ] `backend/server.js` - API server
- [ ] `backend/package.json` - Backend dependencies
- [ ] `backend/.env.example` - Environment template
- [ ] `backend/README.md` - Backend documentation

### ✅ File Integrity Checks

Run these commands to verify files are not corrupted:

```bash
# Check frontend files
head -5 frontend/src/Dashboard.jsx
# Should show: import React, { useState, useEffect, useRef } from 'react';

tail -2 frontend/src/Dashboard.jsx
# Should show: export default Dashboard;

# Check backend files
head -5 backend/server.js
# Should show: const express = require('express');

# Check main.jsx
cat frontend/src/main.jsx
# Should be 8 lines total
```

### ✅ Configuration Steps

- [ ] Created `backend/.env` from `backend/.env.example`
- [ ] Added Google Analytics Property ID
- [ ] Added service account key file path
- [ ] Added Cloudbeds access token
- [ ] Added Cloudbeds client ID and secret

### ✅ Installation Verification

```bash
# Frontend dependencies
cd frontend
npm install
# Should complete without errors

# Backend dependencies
cd ../backend
npm install
# Should complete without errors
```

### ✅ Startup Verification

#### Test Backend
```bash
cd backend
npm run dev
```
Expected output:
```
Server running on port 3001
```

Test API:
```bash
curl http://localhost:3001/api/connection-status
```
Should return JSON with connection status.

#### Test Frontend
```bash
cd frontend
npm run dev
```
Expected output:
```
VITE v5.x.x ready in xxx ms
➜ Local: http://localhost:3000/
```

### ✅ Browser Verification

Open `http://localhost:3000` and verify:

1. **Page Loads:**
   - [ ] Dashboard displays without errors
   - [ ] "Website Booking Analytics" title visible
   - [ ] Date range selector shows "Last 28 days"

2. **UI Elements Present:**
   - [ ] Hamburger menu (☰) in top right
   - [ ] Date picker button with calendar icon
   - [ ] Two tabs: "Overview & Traffic" and "Booking Breakdown"

3. **Interactive Elements:**
   - [ ] Clicking date picker opens dropdown
   - [ ] Preset buttons (Today, Yesterday, etc.) work
   - [ ] Hamburger menu opens and shows API status
   - [ ] Export buttons are visible

4. **Data Display:**
   - [ ] Website traffic metrics show numbers
   - [ ] Property performance table displays
   - [ ] Operational metrics cards visible
   - [ ] Charts render (if data available)

### ✅ Functionality Tests

1. **Date Range Selection:**
   - [ ] Click "Today" preset
   - [ ] Custom dates can be selected
   - [ ] Click "Update" applies changes
   - [ ] Date label updates in header

2. **API Connection:**
   - [ ] Open hamburger menu
   - [ ] Check Google Analytics status
   - [ ] Check Cloudbeds status
   - [ ] (Green dots = connected, Red = disconnected)

3. **Export Functions:**
   - [ ] Click "Download as CSV"
   - [ ] CSV file downloads
   - [ ] Click "Download as PDF"
   - [ ] PDF generates (if backend connected)

### ✅ Console Checks

Open browser Developer Tools (F12) and check:

1. **Console Tab:**
   - [ ] No red errors
   - [ ] Only info/warnings allowed
   - [ ] API requests show in Network tab

2. **Network Tab:**
   - [ ] `/api/connection-status` returns 200
   - [ ] `/api/dashboard-data` returns 200 (after date change)
   - [ ] No 404 or 500 errors

### 🐛 Common Issues & Fixes

#### Issue: "Cannot find module 'react'"
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

#### Issue: "Port 3000 already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or change port in vite.config.js
```

#### Issue: "ECONNREFUSED localhost:3001"
```bash
# Ensure backend is running
cd backend
npm run dev
```

#### Issue: "Google Analytics connection failed"
- Verify service account key file exists
- Check GA4_PROPERTY_ID in .env
- Ensure service account has access in GA4

#### Issue: "Cloudbeds connection failed"
- Verify access token in .env
- Check token hasn't expired
- Regenerate token if needed

### ✅ Production Readiness

Before deploying to production:

- [ ] All environment variables configured
- [ ] Service account key secured
- [ ] API credentials rotated if needed
- [ ] CORS configured for production URLs
- [ ] Error handling tested
- [ ] Data privacy reviewed
- [ ] Security headers configured

### 📊 Performance Checks

- [ ] Dashboard loads in < 3 seconds
- [ ] API requests complete in < 2 seconds
- [ ] No memory leaks (check DevTools Performance)
- [ ] Charts render smoothly

### ✅ Final Verification

Run this complete test:

```bash
# 1. Start backend
cd backend
npm run dev &
BACKEND_PID=$!

# 2. Wait for backend
sleep 3

# 3. Test backend
curl http://localhost:3001/api/connection-status

# 4. Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# 5. Wait for frontend
sleep 5

# 6. Open browser
open http://localhost:3000

# 7. Cleanup
kill $BACKEND_PID $FRONTEND_PID
```

## ✅ Sign-Off

Once all checks pass:

- Date: ______________
- Verified by: ______________
- Notes: ______________

---

**Ready for deployment!** 🚀
