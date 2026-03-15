# Latin District LA — Deploy Guide

## 1. Set Up the Google Sheet

### Make the Sheet Public

1. Open [your Google Sheet](https://docs.google.com/spreadsheets/d/1aqG1OGWXIfABF-ULErccWCRwuz68toP3ZDhPFUtBH7Q)
2. Click **Share** (top right)
3. Under "General access", change to **"Anyone with the link"**
4. Set permission to **"Viewer"**
5. Click **Done**

> The Netlify function fetches using the gviz API — no API key needed as long as the sheet is public.

---

### Create the 4 Tabs with Exact Column Headers

In the Google Sheet, create 4 tabs (sheets) with these **exact names and column headers** (row 1):

#### Tab 1 — `Events`
```
event_name | venue | date | time | genre | event_type | ticket_link | flyer_image_url | featured | active
```
- `event_type`: `friday_night` / `watch_fest` / `crawl` / `special`
- `featured`: `yes` / `no` — shows on home page featured grid
- `active`: `yes` / `no` — `no` hides the event without deleting it
- `date`: use `YYYY-MM-DD` format (e.g. `2026-03-14`)

#### Tab 2 — `Venues`
```
venue_name | tag | description | photo_url | instagram | active
```
- `tag`: short descriptor shown under venue name (e.g. `Dance Floor · DJ Sets`)
- `instagram`: handle with or without `@`

#### Tab 3 — `WatchFest`
```
match_name | date | time | venue | status | flagship
```
- `flagship`: `yes` / `no` — the flagship event is shown full-width at the top of the Watch Fest page
- `status`: `Coming Soon` / `Get Tickets` / `Free` / `RSVP`

#### Tab 4 — `BarCrawl`
```
stop_number | venue_name | vibe | drink_special | active
```
- `stop_number`: integer (1, 2, 3…) — controls display order

---

## 2. Add a Flyer Image via Google Drive

1. Upload your flyer image to **Google Drive**
2. Right-click → **Share** → set to "Anyone with the link can view"
3. Copy the share link (looks like `https://drive.google.com/file/d/FILEID/view?usp=sharing`)
4. Paste the full share link directly into the `flyer_image_url` column

The Netlify function automatically converts it to a direct image URL:
`https://drive.google.com/uc?export=view&id=FILEID`

---

## 3. Add a New Event

Just add a new row to the **Events** tab in Google Sheets:

| Column | Example |
|--------|---------|
| `event_name` | Reggaeton Fridays |
| `venue` | Rhythm Room LA |
| `date` | 2026-03-20 |
| `time` | 10:00 PM |
| `genre` | Reggaeton |
| `event_type` | friday_night |
| `ticket_link` | https://ra.co/your-event |
| `flyer_image_url` | (Google Drive share link) |
| `featured` | yes |
| `active` | yes |

The site updates within **5 minutes** (Netlify function cache TTL).

---

## 4. Add the Logo

Place your logo file at:
```
public/logo.png
```
The site references `/logo.png` in the nav, hero, and footer. If the file is missing, the nav shows "LATIN DISTRICT" text as a fallback.

---

## 5. Deploy to Netlify

### Option A — Drag & Drop (easiest)

1. Install dependencies and build locally:
   ```bash
   cd latin-district-la
   npm install
   npm run build
   ```
2. Open [app.netlify.com](https://app.netlify.com) and log in
3. Click **"Add new site"** → **"Deploy manually"**
4. Drag the **`dist/`** folder onto the deploy zone

> **Important:** Drag-and-drop only deploys the static frontend — the `/.netlify/functions/sheets` endpoint won't work unless you also set up the function. Use Option B for full function support.

### Option B — Connect Git repo (recommended)

1. Push this project to a GitHub repo
2. In Netlify: **Add new site** → **Import an existing project** → pick your repo
3. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site**

Netlify will automatically deploy the `netlify/functions/sheets.js` serverless function alongside the site.

### Option C — Netlify CLI

```bash
npm install -g netlify-cli
cd latin-district-la
npm install
netlify deploy --build --prod
```

---

## 6. Test the Function Locally

```bash
npm install -g netlify-cli
cd latin-district-la
npm install
netlify dev
```

Then visit: `http://localhost:8888/.netlify/functions/sheets`

You should see JSON with `events`, `venues`, `watchfest`, and `barcrawl` arrays.

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| Events not showing | Check sheet is public; check tab name matches exactly (`Events`, `Venues`, `WatchFest`, `BarCrawl`) |
| Images not loading | Confirm Drive link is shared publicly; paste the raw share URL (don't convert manually) |
| Function 500 error | Open Netlify → Functions tab → view function logs |
| Site shows old data | Cache is 5 min — wait or append `?v=1` to bust the cache temporarily |
| Logo missing | Add `logo.png` to the `public/` folder |

---

## Sheet Quick Reference

**Active column:** Set `active` to `no` to hide a row without deleting it.
**Featured events:** Set `featured` to `yes` in the Events tab to show on the home page hero grid.
**Flagship match:** Set `flagship` to `yes` (one row only) in WatchFest to show the featured match at the top of Watch Fest page.
