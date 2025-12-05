# 🔧 PowerShell Troubleshooting Guide

## ✅ POWER SHELL IS NOW ENABLED

Your PowerShell execution policy has been successfully set to **RemoteSigned**. This means:

- ✅ PowerShell scripts can now run properly
- ✅ CLINE can capture output from commands
- ✅ All development commands will work correctly

## 🚀 TEST YOUR POWERSHELL

Run this command to verify everything works:

```powershell
Write-Host "PowerShell is working correctly!" -ForegroundColor Green
node --version
npm --version
```

You should see:
- "PowerShell is working correctly!" in green text
- Node.js version number
- NPM version number

## 🎯 START YOUR MCADENCE APP

### Option 1: Use the Batch File (Recommended)
```bash
# Double-click this file:
start-mcadence.bat
```

### Option 2: Use PowerShell Commands
```powershell
# Add Node.js to PATH and start server:
$env:PATH = $env:PATH + ";C:\Program Files\nodejs"
npx next dev
```

### Option 3: One-Liner PowerShell
```powershell
$env:PATH = $env:PATH + ";C:\Program Files\nodejs"; npx next dev
```

## 🔍 VERIFICATION CHECKS

### Check Server is Running:
```powershell
# Check if Node.js processes are running:
Get-Process -Name node -ErrorAction SilentlyContinue

# Check if port 3000 is in use:
netstat -an | findstr ":3000"
```

### Test Local Connection:
```powershell
# Test if localhost:3000 responds:
try { 
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5
    Write-Host "✅ Server is responding!" -ForegroundColor Green
} catch { 
    Write-Host "❌ Server not responding" -ForegroundColor Red
}
```

## 🌐 ACCESS YOUR APP

Once server is running, open your browser and go to:

**Primary URL**: http://localhost:3000
**Network URL**: http://192.168.1.119:3000 (for other devices)

## 📱 MOBILE TESTING

### On Your Desktop:
1. Open Chrome DevTools (F12)
2. Click device toggle icon
3. Select mobile device (iPhone 13, etc.)
4. Test all features

### On Your Phone:
1. Connect to same WiFi network
2. Open browser → http://192.168.1.119:3000
3. Test full mobile experience
4. Try "Add to Home Screen" for PWA

## 🎯 WHAT TO TEST

### Day to Day Tab:
- [ ] Click "+ Add Task" → Enter title and category
- [ ] Check/uncheck items to mark complete
- [ ] Click archive icon → Confirm archive
- [ ] Click delete icon → Confirm delete
- [ ] See color-coded left borders

### Hit My Goal Tab:
- [ ] Click "+ Add Goal" → Enter challenge
- [ ] Same complete/archive/delete workflow
- [ ] Different color themes

### Spend My Time Tab:
- [ ] Click "+ Add Project" → Set hours/minutes
- [ ] Click project to start timer (blue highlight)
- [ ] Click again to stop (progress updates)
- [ ] Watch progress bars and visual alerts:
  - 80% progress → pulse animation
  - Overdue → red text
- [ ] Try starting multiple timers (should stop previous)

### Menu Features:
- [ ] Click ☰ → Export Data
- [ ] Check downloaded files (JSON + CSV)
- [ ] Try Import Data → Select backup file
- [ ] Test Clear All Data

## 🚨 COMMON ISSUES & SOLUTIONS

### "localhost refused to connect":
- ✅ Solution: Start the server with one of the methods above
- ✅ Wait 30-60 seconds for full startup
- ✅ Try network URL: http://192.168.1.119:3000

### "npm command not found":
- ✅ Solution: Use full path: `& "C:\Program Files\nodejs\npm.cmd"`
- ✅ Or use batch file: `start-mcadence.bat`

### "npx command not found":
- ✅ Solution: Use full path: `& "C:\Program Files\nodejs\npx.cmd"`
- ✅ Or use batch file: `start-mcadence.bat`

### PowerShell execution blocked:
- ✅ Solution: Already fixed with RemoteSigned policy
- ✅ If still blocked: Run PowerShell as Administrator

## 🎉 SUCCESS INDICATORS

You'll know everything is working when you see:

1. ✅ PowerShell commands show output
2. ✅ Node.js processes are running
3. ✅ Browser shows mcadence interface at localhost:3000
4. ✅ All tabs work correctly
5. ✅ Mobile layout looks good
6. ✅ Features respond properly

**🚀 Your mcadence app is ready for use!**
