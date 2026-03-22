# Vercel Deployment Guide for Aegis Underwriter

## 📋 Prerequisites

1. Vercel account (free tier works fine)
2. GitHub repository connected
3. All environment variables ready

---

## 🚀 Deployment Steps

### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 2. Deploy via GitHub (Recommended)

1. Go to https://vercel.com/
2. Click **"Add New Project"**
3. Import your GitHub repository: `isithore002/aegis-underwriter`
4. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: `cd aegis-underwriter && npm install && npm run build && cd frontend && npm install && npm run build`
   - **Output Directory**: `aegis-underwriter/frontend/dist`

### 3. Add Environment Variables in Vercel

Go to **Project Settings → Environment Variables** and add:

#### Required Variables:

```env
# Blockchain Configuration
AGENT_PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc-amoy.polygon.technology

# Smart Contract Addresses
MOCK_USDT_ADDRESS=0x1f284415bA39067cFC39545c3bcfae1730BEB326
LEDGER_CONTRACT_ADDRESS=0x9274Dc7Bc8fd3B49f0cc3CaE1340fFf65D5f5655

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Oracle Configuration
OKLINK_API_KEY=your_oklink_api_key_here

# Loan Settings
MAX_LOAN_AMOUNT=500

# Environment
NODE_ENV=production
```

#### Important Notes:
- ⚠️ **Never commit `.env` file to GitHub**
- ✅ All variables must be set in Vercel dashboard
- ✅ Click "Add" for each variable, then redeploy

---

## 🔧 Alternative: Deploy via CLI

```bash
cd "h:/tether hack"
vercel
```

Follow the prompts:
1. Set up and deploy: **Yes**
2. Which scope: **Your username**
3. Link to existing project: **No**
4. Project name: **aegis-underwriter**
5. Directory: **(press Enter for current)**
6. Want to override settings: **Yes**

Then add environment variables:

```bash
vercel env add AGENT_PRIVATE_KEY
vercel env add GEMINI_API_KEY
vercel env add OKLINK_API_KEY
vercel env add MOCK_USDT_ADDRESS
vercel env add LEDGER_CONTRACT_ADDRESS
vercel env add RPC_URL
vercel env add MAX_LOAN_AMOUNT
```

---

## 🌐 Backend API on Vercel

For Vercel serverless deployment, the backend needs to be restructured as API routes.

### Option A: Keep Express Server (Requires Vercel Pro)
- Current structure works with Vercel Pro plan
- Supports Express.js middleware

### Option B: Serverless Functions (Free Tier)
- Requires restructuring backend into `/api` folder
- Each endpoint becomes a separate serverless function
- No persistent state (need external storage)

**Recommended**: Use **Render.com** or **Railway.app** for backend (free tier supports Express)
Then deploy frontend on Vercel.

---

## ⚡ Split Deployment (Recommended)

### Backend on Railway/Render:
1. Deploy Express backend on Railway.app or Render.com
2. Get backend URL: `https://your-app.railway.app`
3. Set environment variables on Railway/Render

### Frontend on Vercel:
1. Deploy React frontend on Vercel
2. Add environment variable:
   ```
   VITE_API_URL=https://your-app.railway.app
   ```
3. Update frontend API calls to use `import.meta.env.VITE_API_URL`

---

## 🐛 Troubleshooting

### "Module not found" errors
**Fix**: Ensure all dependencies are in `package.json`, not devDependencies

### "Function timeout" errors
**Fix**: Increase timeout in `vercel.json`:
```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### CORS errors
**Fix**: Add CORS headers in API responses:
```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
```

---

## 📊 Deployment Checklist

- [ ] All environment variables added to Vercel
- [ ] `.env` file NOT committed to GitHub
- [ ] Build commands tested locally
- [ ] API endpoints tested with production URLs
- [ ] MetaMask connects to Polygon Amoy testnet
- [ ] Smart contracts deployed and verified
- [ ] README.md updated with live URLs

---

## 🔗 Post-Deployment

After deployment completes:
1. Note your Vercel URL: `https://aegis-underwriter.vercel.app`
2. Test all commands (credit check, apply, repay, verify)
3. Verify transaction links work on Polygonscan
4. Update README.md with live demo link

---

**Need help?** Check Vercel docs: https://vercel.com/docs
