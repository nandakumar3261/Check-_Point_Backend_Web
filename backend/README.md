# Aditya Security Guard — Backend API

Standalone Express + MongoDB backend, split out of the combined
`BackendAndWeb/web_frontend` project. It runs on its own port and no longer
serves the web dashboard (the web front end will be its own project/port).

## Run

```bash
cd backend
npm install
# .env is included (copied unchanged from web_frontend). To start fresh: cp .env.example .env
npm start            # -> http://localhost:<PORT>  (PORT in .env, default 3000)
```

Other script: `npm run hash -- <password>` prints a bcrypt hash for creating
the first admin user in mongosh (unchanged from before).

Health check: `GET /api/health`

## API route prefixes (unchanged)

| Prefix                  | File                       |
|-------------------------|----------------------------|
| `/api/auth`             | `routes/auth.js`           |
| `/api/users`            | `routes/users.js`          |
| `/api/duty-places`      | `routes/dutyPlaces.js`     |
| `/api/duty-assignments` | `routes/dutyAssignments.js`|
| `/api/qr-scans`         | `routes/qrScans.js`        |
| `/api/uploaded-images`  | `routes/uploadedImages.js` |

## Uploaded files

Site-visit images and profile photos are saved on local disk under
`public/uploads/images` and `public/uploads/profile` and served at
`/uploads/...` (the URLs already stored in MongoDB). This is the only thing
`express.static` serves now. If you already have uploaded files in the old
`web_frontend/public/uploads/`, copy them into the same folders here so
existing image URLs keep working.

## What changed vs. `web_frontend`

Only `server.js` and `package.json` metadata were touched; every route, model
and config file is byte-for-byte identical.

- `server.js`: removed the `GET /` route that sent the web's `index.html`,
  updated the header comment and the startup log text ("backend API running").
- `package.json`: `name` / `description` only.
- Not copied (web only): `public/` HTML, CSS and JS.
