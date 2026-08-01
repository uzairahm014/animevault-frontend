# ANIMEVAULT Frontend

This is the real project structure for ANIMEVAULT — everything StackBlitz/CodeSandbox
was recreating by hand before, now packaged properly so you can deploy it directly.

## What's inside

```
animevault-frontend/
  package.json          ← dependencies (React, Tailwind, lucide-react, socket.io-client)
  vite.config.js         ← build tool config
  tailwind.config.js      ← Tailwind CSS setup (the app uses Tailwind utility classes everywhere)
  postcss.config.js
  index.html              ← entry HTML page, includes the PWA manifest link
  src/
    main.jsx              ← mounts the app
    index.css             ← Tailwind base styles
    App.jsx               ← the entire ANIMEVAULT app (this is the big file)
  public/
    manifest.json          ← makes "Add to Home Screen" install like a real app
```

## Run it locally

```bash
cd animevault-frontend
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

## Deploy it for free — two options

### Option A: Vercel (recommended, easiest)

1. Push this whole `animevault-frontend` folder to a GitHub repo
2. Go to **vercel.com** → sign up with GitHub → **Add New Project** → pick your repo
3. Vercel auto-detects Vite — just click **Deploy**
4. You get a live URL like `animevault.vercel.app` in about a minute

### Option B: Netlify

1. Same GitHub push as above
2. Go to **netlify.com** → **Add new site → Import an existing project**
3. Build command: `npm run build`   ·   Publish directory: `dist`
4. Deploy

## Connect it to your backend

Open `src/App.jsx`, find these two lines near the top and fill them in once you've
deployed `animevault-backend` (see that project's own README):

```js
const CLOUDINARY_CLOUD_NAME = "";   // from cloudinary.com
const CLOUDINARY_UPLOAD_PRESET = ""; // from cloudinary.com

const BACKEND_URL = ""; // e.g. "https://animevault-backend.onrender.com"
```

## Migrating off Supabase — exact function mapping

`src/App.jsx` currently uses a `supabaseStorage` object for everything. Two new
files replace it: `src/firebaseClient.js` (login/signup) and `src/api.js`
(every backend call). Fill in your Firebase config in `firebaseClient.js` and
your Render URL in `api.js`, then swap these specific spots in `App.jsx`:

| In App.jsx, replace... | ...with |
|---|---|
| `handleRegister` / `handleLogin` (raw username+password against `users` key) | `signUp`/`logIn` from `firebaseClient.js`, then `usersApi.create()` |
| `savePosts` / loading `posts` key | `postsApi.list()` / `postsApi.create()` |
| `handleLike` (posts) | `postsApi.like(id)` |
| `handleDownload` | `postsApi.download(id)` then open the returned `videoUrl` |
| `openDetail`'s view increment | `postsApi.view(id)` |
| `handleDelete` (posts) | `postsApi.remove(id)` |
| `saveWallpapersIndex` / loading `wallpapers-index` | `wallpapersApi.list()` / `wallpapersApi.create()` |
| `handleWallpaperLike` | `wallpapersApi.like(id)` |
| `handleWallpaperDownload` | `wallpapersApi.download(id)` |
| `handleWallpaperDelete` | `wallpapersApi.remove(id)` |
| `saveWallpaperAlbums` / `handleCreateAlbum` / `handleDeleteAlbum` | `albumsApi.list()` / `.create()` / `.remove()` |
| `saveAnimeEpisodes` / `handleAnimeEpisodeUpload` / `handleAnimeEpisodeDelete` | `episodesApi.list()` / `.create()` / `.remove()` |
| `handleAnimeEpisodeView` | `episodesApi.view(id)` |
| Any `resizeImageFile` + `supabaseStorage.set("wallpaper-img:...")` / `"edit-video:...")` / `"avatar-img:...")` upload flow | `uploadFile(file, folder, onProgress)` from `api.js` — returns a real Cloudinary URL, pass it straight into `postsApi.create()` / `wallpapersApi.create()` / `usersApi.updateMe()` |
| `myNotifications` loading + `markNotificationsRead` | `notificationsApi.mine()` / `.markRead()` |
| `handleSendRequest` | `requestsApi.send(text, category)` |
| `handleMakeAdmin` / `handleRemoveAdmin` / dynamic-admins list | `adminApi.makeAdmin(uid)` / `.removeAdmin(uid)` — admin status now lives on the user record itself, no separate list needed |
| `favorites`, `blockedUsers`, `theme`, `showMature`, `notifSettings`, `featuredCreator`, `reports` | **Leave these as-is** — they already use `localStorage` under the hood for anything marked `shared: false`, and are fine staying local/per-device |

This is a real refactor of a large file — go function by function rather than
all at once, and test each feature after swapping it.

## About the app icons

`public/manifest.json` points at `/icon-192.png` and `/icon-512.png`, which aren't
included yet — add your own square logo image in two sizes (192×192 and 512×512 PNG)
into the `public/` folder with those exact filenames. Any free tool like
**favicon.io** or **realfavicongenerator.net** can generate both sizes from one image.
Until you add them, the app still works fine — "Add to Home Screen" will just use a
generic icon instead of your logo.

## Why Tailwind is included

The app's layout (`flex`, `grid`, `gap-4`, `px-5`, `rounded-md`, etc.) relies on
Tailwind CSS utility classes throughout. This project has Tailwind fully configured
so those classes render correctly — without it, the layout would look broken/unstyled.
