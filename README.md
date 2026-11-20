# CraftForge — Minecraft Item Studio & 0–10 Grader

**CraftForge** is a playful, Minecraft-styled Progressive Web App (PWA) built for parents and kids to design custom 16×16 pixel-art Minecraft items, describe their powers, send them to each other's inbox, and grade them **0 to 10**!

## Features
- **16×16 Pixel Art Studio**: Touch-friendly canvas (`touch-action: none`) for Android tablets & desktops, with Pencil, Eraser, Paint Bucket, Eyedropper, Horizontal Mirror mode, Undo/Redo, Minecraft color palettes, and quick-start item templates.
- **Live Minecraft Item Tooltip**: Preview your custom item with authentic dark-purple Minecraft tooltip borders, rarity colors, and shimmering **Enchantment Glint**.
- **0–10 Grading Bench**: Glowing inbox notifications, huge touch-friendly 0–10 XP hotbar rating buttons, dynamic Minecraft rank labels, and optional notes.
- **Shared Double-Chest Gallery**: Filter, sort, inspect items, and track average scores per crafter.
- **Works Offline & Installable**: Runs 100% locally out of the box (with starter items included) and installs onto an Android tablet home screen like a native app.
- **Optional Free Live Cloud Sync**: Sync items and grades live across two devices using a free Firebase Firestore project.

---

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Open the local URL (e.g. `http://localhost:5173`) in your browser.
Use the **⇄ Switch Player** button in the top bar anytime to test both sides of the crafting & grading loop on one device.

Build for production:

```bash
npm run build
npm run preview
```

---

## Optional: Free Live Sync Across Two Devices (Firebase Firestore)

CraftForge uses the Firestore REST API — no server or paid plan required!

1. Go to [Firebase Console](https://console.firebase.google.com/) and click **Add project** (free **Spark** plan).
2. In your project, go to **Build → Firestore Database → Create database** and start in **Test mode** (or use the rule below so only your `craftforge_realms` collection is accessible):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /craftforge_realms/{realmId} {
         allow read, write: if true;
       }
     }
   }
   ```
3. Go to **Project Settings → General → Your apps → Add Web App** and copy your Firebase config (or just your **Project ID** and **Web API Key**).
4. In CraftForge, tap **☁ Sync** in the top bar on **both devices**, paste your Firebase config snippet, make sure both devices have the exact same **Realm Code** (e.g. `FAMILY-CRAFT`), and tap **Save & Enable Cloud Sync**.

Items and grades will now sync automatically every few seconds!

---

## Free Hosting (Vercel, Netlify, or GitHub Pages)

To install CraftForge on an Android tablet, host it over HTTPS for free:

### Option A: Vercel (Fastest)
1. Push this folder to a GitHub repo (or run `npx vercel`).
2. Import the repo at [vercel.com](https://vercel.com) — Vite is detected automatically (`npm run build`, output `dist`).

### Option B: Netlify
1. Run `npm run build`.
2. Drag and drop the `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

### Option C: GitHub Pages
1. Run `npm run build` and deploy the `dist/` folder via GitHub Actions (`actions/deploy-pages`). `vite.config.ts` already uses `base: './'` for clean relative asset paths.

---

## Install on an Android Tablet ("Add to Home Screen")

1. Open your hosted CraftForge URL in **Google Chrome** on the Android tablet.
2. Tap the **⋮ menu** in the top-right corner of Chrome.
3. Tap **Add to Home screen** (or **Install app**).
4. Tap **Install** — CraftForge will appear on the tablet home screen with its Diamond Sword grass-block icon and open full-screen without browser bars!
