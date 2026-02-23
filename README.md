# Blobweb

React app for distorting images and videos with lighting, ASCII (#$%^&*), and blob tracking with white boxes and lines. Built with Vite, TypeScript, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to GitHub + Vercel

### 1. Create a new GitHub repo

1. Go to [github.com/new](https://github.com/new).
2. Name it (e.g. `blobweb`).
3. Do **not** add a README, .gitignore, or license (this repo already has them).
4. Click **Create repository**.

### 2. Push this project to GitHub

In a terminal, from the **testApp** folder (this project root), run (replace `YOUR_USERNAME` and `REPO_NAME` with your GitHub username and repo name):

```bash
cd C:\Users\USER\Test1\testApp
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

If GitHub asks for login, use a [Personal Access Token](https://github.com/settings/tokens) as the password.

### 3. Publish with Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (use “Continue with GitHub”).
2. Click **Add New…** → **Project**.
3. **Import** your GitHub repo (e.g. `blobweb`).
4. Leave **Root Directory** as `.` (this project is the repo root).
5. **Build Command:** `npm run build` (default).
6. **Output Directory:** `dist` (default for Vite).
7. Click **Deploy**.

Vercel will build and give you a live URL. Future pushes to `main` will auto-deploy.

