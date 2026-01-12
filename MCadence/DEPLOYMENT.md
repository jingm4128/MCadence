# Deploying mcadence to Vercel

This guide will help you deploy mcadence so you can access it from anywhere, including your phone.

## Option 1: Deploy via Vercel CLI (Quickest)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```
This will open a browser for you to log in (create a free account if you don't have one).

### Step 3: Deploy
From the project directory, run:
```bash
vercel
```
Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **mcadence** (or any name you like)
- Directory? **./** (default)
- Override settings? **N**

After deployment, you'll get a URL like `https://mcadence-xxx.vercel.app`

### Step 4: Production Deploy
For a stable production URL:
```bash
vercel --prod
```

---

## Option 2: Deploy via GitHub (Recommended for updates)

### Step 1: Push to GitHub
1. Create a new repository on GitHub (https://github.com/new)
2. Push your code:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mcadence.git
git push -u origin main
```

### Step 2: Connect to Vercel
1. Go to https://vercel.com
2. Sign up/Log in with your GitHub account
3. Click "Add New..." → "Project"
4. Import your `mcadence` repository
5. Click "Deploy"

Vercel will automatically:
- Build your app
- Deploy it to a `.vercel.app` URL
- Auto-deploy whenever you push to GitHub

---

## Using on Your Phone

### Install as PWA (Progressive Web App)

Once deployed, open the URL on your phone:

**iPhone (Safari):**
1. Open the deployed URL in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

**Android (Chrome):**
1. Open the deployed URL in Chrome
2. Tap the three-dot menu
3. Tap "Add to Home screen" or "Install app"
4. Tap "Add"

The app will appear on your home screen like a native app!

---

## Custom Domain (Optional)

In Vercel dashboard:
1. Go to your project → Settings → Domains
2. Add your custom domain
3. Follow DNS setup instructions

---

## Environment Notes

- **Data Storage**: All data is stored in your browser's localStorage
- **Per-Device**: Each device has its own data (use Export/Import to sync between devices)
- **Offline Support**: The app works offline after first load (thanks to service worker)

---

## Troubleshooting

### Build Errors
Run locally first to check for errors:
```bash
npm run build
```

### PWA Not Installing
- Make sure you're using HTTPS (Vercel provides this)
- Clear browser cache and try again

### Data Not Persisting
- Check if localStorage is enabled in your browser
- Private/Incognito mode may not persist data

---

## Quick Commands Reference

```bash
# Local development
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# View Vercel deployment logs
vercel logs
```
