# Deployment Guide

This guide covers deploying CloudGraph using Vercel (frontend) and Render (backend).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Production                           │
│                                                              │
│  ┌─────────────────────┐     ┌─────────────────────────┐   │
│  │   Vercel (Frontend) │────▶│   Render (Backend API)  │   │
│  │   cloudgraph.vercel │     │   cloudgraph-api.render │   │
│  │   .app              │     │   .com                  │   │
│  └─────────────────────┘     └─────────────────────────┘   │
│         React SPA                  Node.js/Express          │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Deploy Backend to Render

### Option A: Deploy via Render Dashboard

1. Go to [render.com](https://render.com) and sign in
2. Click **New → Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `cloudgraph-api`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. Add Environment Variables:
   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |

6. Click **Create Web Service**

### Option B: Deploy via render.yaml

The `backend/render.yaml` file is already configured. Use Render's Blueprint feature:

1. Go to Render Dashboard → **Blueprints**
2. Connect repository
3. Select the backend folder
4. Deploy

### Get Your Backend URL

After deployment, Render will provide a URL like:
```
https://cloudgraph-api.onrender.com
```

Save this URL for the next step.

---

## Step 2: Deploy Frontend to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add Environment Variables:
   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://cloudgraph-api.onrender.com` |

6. Click **Deploy**

### Option B: Deploy via Vercel CLI

```bash
cd frontend
npm i -g vercel
vercel login
vercel --prod
```

When prompted for environment variables, add `VITE_API_URL`.

---

## Step 3: Configure CORS

Update your Render backend environment to allow Vercel origin:

1. Go to Render Dashboard → cloudgraph-api → Environment
2. Add:
   | Variable | Value |
   |----------|-------|
   | `CORS_ORIGINS` | `https://cloudgraph.vercel.app` |

Or update `backend/src/app.ts` if needed:

```typescript
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*'
}));
```

---

## Environment Variables Summary

### Frontend (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://cloudgraph-api.onrender.com` |

### Backend (Render)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `CORS_ORIGINS` | Allowed origins | `https://cloudgraph.vercel.app` |

---

## Automatic Deployments

Both platforms support automatic deployments from GitHub:

- **Vercel**: Deploys on every push to main/master
- **Render**: Deploys on every push (can be configured)

---

## Custom Domains

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS as instructed

### Render
1. Go to Service Settings → Custom Domains
2. Add your domain
3. Configure CNAME record

---

## Monitoring

### Vercel
- Functions tab shows API routes (if using Serverless)
- Analytics tab shows performance

### Render
- Logs tab shows real-time logs
- Metrics tab shows CPU/memory usage

---

## Troubleshooting

### CORS Errors
```
Access to fetch at 'https://...' has been blocked by CORS policy
```
**Fix**: Add your Vercel URL to `CORS_ORIGINS` on Render.

### API Not Responding
**Check**: 
1. Render service is running (check Logs)
2. Health endpoint works: `https://cloudgraph-api.onrender.com/health`
3. `VITE_API_URL` is correct in Vercel env vars

### Build Failures
**Check**:
1. TypeScript compiles locally (`npm run build`)
2. All dependencies are in `package.json` (not just devDependencies for production code)

---

## Cost

| Platform | Free Tier |
|----------|-----------|
| Vercel | Unlimited for hobby |
| Render | 750 hours/month (sleeps after 15 min inactivity) |

> **Note**: Render free tier services sleep after 15 minutes of inactivity. First request after sleep takes ~30 seconds.
