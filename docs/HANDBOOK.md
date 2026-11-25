# Warrior Spirit Muay Thai website: Handbook

**What this is:** the website, member accounts, class and PT booking and coach area for Warrior Spirit Muay Thai & Kickboxing, Potters Bar.

**If it isn't here, it isn't decided.** This handbook changes only by agreement: someone proposes a change and says why, Steve agrees, then it is made and dated in the decisions log. Facts about what is built are updated as part of building.

**One copy** (Steve, 6 Nov 2026): this file, `docs/HANDBOOK.md` in the GitHub repo `yourhousewash-code/Warrior-Spirit-Muay-Thai`. The claude.ai Project "Warrior Spirit Muay Thai" keeps only a one-line pointer to it (`claude/handbook.md`).

**This file is private.** It is kept out of the live website (see `.vercelignore`). Never publish it: it mentions FighterBase.

**Related:** SRS Site Factory handbook (how SRS builds sites) and the Turbo handbook (what happens after launch). Neither is linked to this site yet.

**Last updated:** 16 November 2026

---

## 1. What it is

A club website with a working back end. It is **not** a trade site: it exists to fill classes and personal training (PT), show the fight team, and give members and coaches somewhere to book and manage things.

| Item | Detail |
|---|---|
| Live address | https://www.warriorspiritmuaythai.co.uk (went public 25 Oct 2026) |
| Who it is for | People near Potters Bar and surrounding towns who want to try Muay Thai, kids' classes, fitness or PT, and fighters who want a team |
| What it must achieve | Free first-class enquiries, PT bookings, class bookings, fight team interest |
| Package | Custom build (not the SRS Core or Enhanced template) |
| Turbo site ID | None. It is not in Turbo yet |
| Owners | Jay (head coach) and Steve. Both are "owners" in the coach area |
| Future link | FighterBase (a separate product). See section 5 and the decisions log. **Nothing about FighterBase may appear on any public page until Steve says it is fully operational.** |

## 2. Official business facts

Used the same way everywhere (site, Google, listings).

| Item | Value | Status |
|---|---|---|
| Trading name | Warrior Spirit Muay Thai & Kickboxing | Confirmed |
| Other names the club is known by | Hoddesdon Muay Thai & K1 Kickboxing (the old name), WMT Muay Thai (a club we took over) | Confirmed |
| Legal entity | Sole trader (Steve, 4 Nov 2026). Steve decided on 5 Nov 2026 not to show the owner's name; the site shows the trading name, address, phone and email | Confirmed |
| Address (shown on the site) | Next Gen Fitness, Mount Grace Road, Potters Bar EN6 1RB | Confirmed |
| Phone (one format) | 07904 032142 (WhatsApp uses the same number) | Confirmed |
| Email shown to the public | warriorspirit@gmail.com (changed from Jay's personal address on 30 Oct 2026) | Confirmed |
| Areas covered | Potters Bar, Barnet, Cuffley, Brookmans Park, Hatfield, Borehamwood, Enfield, Waltham Cross, Cheshunt, Hoddesdon, Welwyn Garden City, St Albans, Radlett, Southgate and Cockfosters | Confirmed (from the site) |
| Services | Muay Thai and kickboxing classes (beginners, pads, drills and sparring, sparring), kids classes (ages 7 to 13), personal training (1-to-1, doubles, groups), fight team, fitness | Confirmed |
| Opening hours | Open gym for members, weekdays 9am to 9pm. Saturday 8am to 12pm (personal training only). Sunday closed | Set in the coach area, so the live site is the source of truth |
| Prices | Adults £75 a month, kids £65 a month, first class free, PT from £40 an hour (doubles from £45, groups from £55) | Set on the site |
| Social | Instagram @warriorspirit_muaythai, TikTok @warriorspirit32. Facebook, YouTube and Google Business links are not on the site yet | Partly confirmed |

**Brand rules**
- Logo: the round Warrior Spirit crest (`img/logo.webp`). Do not redraw it.
- Colours: red `#e3141e`, near-black `#0b0c10`, panel `#14161d`, navy `#1d3a8f`, bone `#f3f0ea`. Owner-only features in the coach area use blue `#4d8dff` with a star stamp.
- Fonts: Big Shoulders Display (headings), Barlow (text), Barlow Condensed (labels).
- Tone: direct, welcoming to complete beginners, proud of the fighters, never boastful or macho. British English.
- Hoddesdon branding in old photos is fine. The club is the same club that moved and was renamed.
- Do not show Dan Jones (now at another club) or his partner in photos or videos.
- Do not show the person who left the club in the corner photo (removed 25 Oct 2026).

## 3. The rules (always)

**Site rules (decided with Steve)**
1. Whole-website editing (wording, carousel, videos, opening hours, class pictures) is for the two owners, Jay and Steve, only.
2. Other coaches can edit only their own profile photo and the gallery on their own coach page. Their changes are sent for owner approval.
3. Coach editing must not move sections, remove functions or change the layout. Wording and swapping photos only.
4. **No FighterBase badges, links, logos, text or images on any public page** until Steve says FighterBase is fully operational. The assets are parked in `parked/fighterbase/` and ignored by the deploy. Any FighterBase testing or integration work must stay behind logins or switched off.
5. Photos of children only with parents' agreement.
6. Everything coaches share is posted by the person, from their own account. The site never posts to social media for anyone.
7. Privacy first: no tracking or advertising cookies. Only the cookies needed to keep people logged in.
8. Fight results are described as results the club knows about, not official governing-body records.
9. Colour key in the coach area: red is for everyone on the team, blue with a star stamp is owners only.
10. Commits to the repo are made as Steve Saunders, with no AI attribution.
11. **Public pages are built from one source.** Edit `site-src/index.html`, then run `node tools/build-pages.mjs` and commit the generated `index.html`, the section pages (`pt.html`, `classes.html` and so on), `sitemap.xml`, `photo-usage.json` and `api/_lib/photousage.js`. Never edit those generated files by hand.
12. Computer-made pictures are labelled "Illustration" on the site.
13. Much of the booking, account and coach tooling is expected to move to FighterBase. Spend effort on the public pages, legal pages and speed here, and keep new tooling small.
14. **Optional, never empty** (Steve, 4 Nov 2026): anything optional can be switched on or off by owners, and nothing on the public site shows as an empty space or "to confirm" wording unless it's a required item. A part with wording to fill in can't be switched on until it's filled in.
15. **Going live** (Steve, 6 Nov 2026): every push to `main` deploys the live site. In a live session, Steve's go-ahead in chat covers publishing the change discussed (his words are recorded). On wake-ups and unattended runs, changes are built on a branch and wait for Steve's exact "publish <commit>" approval.
16. **Team files stay private:** `handoffs/` (TASKS.md, HANDOFF-PACK.md, handoffs), `STATUS.md`, `docs/` and `CLAUDE.md` are kept out of the live site by `.vercelignore`.

**SRS standards that apply:** see section 9 for how the site measures up.

## 4. Accounts and access

The business owns its own accounts. SRS accounts use `steve@srsprojects.co.uk`. **AI never signs in, enters passwords or keys, or accepts terms.** No secrets are written here, only where they live.

| Account | Owner / who can get in | Notes |
|---|---|---|
| Domain `warriorspiritmuaythai.co.uk` | Registered at names.co.uk. Steve has the login | Points at Vercel. The `.com` is thought to belong to Jay (unconfirmed). SRS rule (Steve, 6 Nov 2026): client domains go on Cloudflare; the move is planned (wanted next, item 2) |
| GitHub | `yourhousewash-code` (Steve), private repo `Warrior-Spirit-Muay-Thai`. Pushes to `main` deploy automatically | Remote updated to the capitalised name on 6 Nov 2026 |
| Vercel (hosting) | Steve's account | Settings and secrets live in Vercel → Project → Settings → Environment Variables |
| Upstash Redis (database) | Linked through Vercel | Holds accounts, bookings, classes, hours and site content |
| Vercel Blob (file storage) | Linked through Vercel | Holds uploaded photos and videos |
| Gmail sending account | A Google account whose app password is stored in Vercel (variables `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) | Which account this is is **to confirm** |
| Google Cloud project (Google sign-in and Drive uploads) | Steve's general-use Google business login | Variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Drive folder "Warrior Spirit Uploads" |
| Other secrets in Vercel | `SESSION_SECRET`, `CRON_SECRET`, `BOOKINGS_COPY_EMAIL`, `SITE_URL` | Never copy values anywhere |
| Coach logins on the site | Jay, Steve, Aaron, Kian (usernames `jay`, `steve`, `aaron`, `kian`). Jay can add or hide coaches | Coaches should change their starter passwords. Steve's login has no starting password |
| Google Search Console | Set up 5 Nov 2026: property `https://www.warriorspiritmuaythai.co.uk/` verified by an HTML tag in the page head (keep the `google-site-verification` meta tag in `site-src/index.html`). Owners: yourhousewash@gmail.com (Steve's Chrome account, verified), warriorspirit@gmail.com and jayshep1980@gmail.com (Jay). Sitemap submitted: 36 pages found | Done |
| Bing Webmaster Tools | Set up 5 Nov 2026 in Steve's Microsoft account, verified by the `msvalidate.01` meta tag in `site-src/index.html` (keep it). Sitemap submitted | Done |
| Google Business Profile | Jay owns the Potters Bar listing and is adding the website address (Steve, 4 Nov 2026). The Hoddesdon listing is left alone for now. A listing seems to exist (the site shows a 4.9 rating from about 100 Google reviews across the Potters Bar and Hoddesdon listings). SRS will manage client profiles from a dedicated SRS Google account (agreed in principle, Steve, 6 Nov 2026; Steve is setting it up); no Google access requests until it exists. Changes by Google's Business Profile API go through Turbo, which owns the approved API | SRS access waits for the SRS Google account |
| Form service | None. Forms post to the site's own `/api/enquiry` | Email goes by Gmail |
| Social profiles | Instagram, TikTok (Facebook not confirmed) | Logins are with the club and coaches, not AI |
| Affiliate or partner accounts | None | n/a |

## 5. What's built

**Stack and deployment.** Static pages plus Vercel serverless functions in `/api` (Node 20). No framework. The public pages are generated from `site-src/index.html` by `tools/build-pages.mjs` (run it by hand and commit the result; Vercel does not run it). Other pages are plain files: `book.html`, `account.html`, `coach.html`, `privacy.html`, `terms.html`, `accessibility.html`. A push to `main` on GitHub goes live on Vercel within a couple of minutes.

**Hosting limits to design around.** Vercel Hobby plan: 12 functions maximum (11 used), cron jobs once a day only.

| Feature | What it does | Where in the code |
|---|---|---|
| Public site | 32 sections (home, classes, PT, fight team, videos, team, blog, areas, 15 town pages, kids, kickboxing, fitness, women, self-defence, payments, fight levels, FAQ, safeguarding, contact). Each has its own web address (for example `/pt`, `/potters-bar`), title, description, canonical and link-preview tags. Clicking between them does not reload the page. Old `/#pt` links still work | `site-src/index.html`, `tools/build-pages.mjs` |
| Terms and accessibility pages | Plain-English terms of use and an accessibility statement, linked from the footer | `terms.html`, `accessibility.html` |
| Fonts and speed | Fonts are stored on the site (`assets/fonts`). Hero videos and the highlights video do not load on phones or until played | `assets/fonts.css`, `site-src/index.html` |
| Hero carousel and video gallery | Owners change them in the coach area. Falls back to built-in defaults | `api/site.js`, `api/_lib/sitedefaults.js` |
| Class timetable and live ticker | Follows the schedule owners and coaches keep in the coach area | `api/pt.js`, `index.html` |
| Class pictures | A picture on each timetable card, chosen by owners | `api/site.js` (`classimg`), `coach.html` |
| Opening hours | Editable by owners, site follows | `api/pt.js` (`hours`) |
| Edit mode | Owners click any wording or photo on the live site to change it. Photos come from the library | `assets/editable.js`, `assets/editor.js` |
| Photos & videos hub | One tile for every photo (3 Nov 2026). **All photos** (filters: on the website, not used yet, mine, from the club Drive; Drive photos sync in) and **Add photos & videos** are for everyone. **Homepage carousel**, **Video gallery** and **Page photos** (every swappable photo spot, page by page, with Replace and Put back the original) are for owners. Hover a photo to see where it's shown; tap it for every place (each linked to the live page) and what you can do. Owners: replace everywhere, add to carousel, use on a page spot, take off the website (it stays in the library), delete (only once it's shown nowhere, or force-delete with a confirm). Coaches: use on my page (Jay approves), delete their own unused photos. Old links (`#uploads`, `#library`, `#media`) land on the right tab | `coach.html`, `api/site.js` (`hub`, `where`, `unpublish`, `replace-everywhere`) |
| Photo map | The build script lists every image on the public pages (137, 70 swappable) with its page, place and edit-mode key, so the coach area knows where each photo is shown, together with the carousel, page swaps, class pictures and coach pages | `tools/build-pages.mjs`, `photo-usage.json`, `api/_lib/photousage.js` |
| What the website shows (owners) | Optional parts of the public pages (parking, borrowing gloves, contract and notice, parents watching, welfare officer, every coach DBS checked, governing body and insurance, show-day results, Warriors League result, YouTube channel, Google reviews rating) switched on or off in Club details. Anything off is left out completely, with no gap, also with no JavaScript. A part with [square bracket] wording can't be switched on until it's filled in through Edit the website; putting the original wording back hides it again. Defaults are built into the pages. In edit mode, switched-off parts show faded with a blue edge, FAQ answers open while editing, and shared wording (parking on 14 town pages and the FAQ) is one edit | `api/_lib/siteoptions.js`, `site-src/index.html` (`data-opt`), `tools/build-pages.mjs`, `api/site.js` (`options-get`, `options-save`), `coach.html`, `assets/editable.js`, `assets/editor.js` |
| Photo and video opt-out | Members choose "Happy to be in club photos and videos" or "Please leave me out" in their account (it covers a parent's child too). Every coach sees the names and dates in Photos & videos. Privacy and terms mention it. Children's own names aren't held, so a child shows under the parent's name | `account.html`, `api/auth.js` (`photo-pref`, `photo-optouts`), `coach.html` |
| Two-step sign-in (coach area) | After the right password, owners (always) and coaches who switch it on in Settings get a 6-digit code by email (owners: Jay's and Steve's emails are set). The code is stored hashed, runs out in 10 minutes, works once in the browser that asked, stops after 5 wrong tries; at most 5 codes an hour, 30 seconds between "Send a new code". An owner with no email is let in once with a warning (the other owner is emailed), then must ask the other owner to add one in Manage coaches → Change email. Coaches switch it on with a test code and off with their password. The password-reset link counts as the second step | `api/auth.js` (`coach-login`, `coach-code`, `coach-code-resend`, `coach-twostep-start`, `coach-twostep-confirm`, `coach-twostep-off`), `api/_lib/twostep.js`, `coach.html` |
| Trusted devices and signing out | "Trust this device for 30 days" (on by default) skips the code on that device. Settings lists trusted devices with last used date and Remove (which also signs that device out), plus "Sign out everywhere". A password change or reset signs out every other device and forgets trusted devices. Owner sessions from before two-step ended once when it went live (4 Nov 2026). Owners can change each other's email in Manage coaches | `api/auth.js` (`coach-devices`, `coach-device-remove`, `coach-signout-all`), `api/_lib/core.js` (`coachSession`), `coach.html` |
| Site overview (owners) | Every photo, who added it, where it is used, Drive status | `api/site.js` (`overview`) |
| Coach pages `/team/name` | Bio, photo gallery, prices | `api/team.js`, `api/profile.js` |
| PT booking | Coaches set weekly hours and holidays. Customers book 1-to-1, doubles or groups, with email alerts | `api/pt.js`, `book.html` |
| Class booking | Members book classes. Coaches set maximum places | `api/pt.js`, `account.html` |
| Reminders and notify | Morning and evening reminder emails (opt-in). Owners can notify members of timetable changes | `api/cron.js`, `api/pt.js` |
| Calendar feeds | Club feed and personal feed that phones can subscribe to | `api/cal.js`, `api/_lib/ics.js` |
| Member accounts | Email and password, email verification, Google sign-in. Each account has a session number (`sg` in `user:<email>`): a password reset raises it, which signs the account out on every other device (14 Nov 2026). Every API file that reads the member login calls `loadUser(req)` first. Log in and "forgotten password" give the same answer whether or not the email has an account (sign-up still says an email is taken; it is rate-limited and bot-checked) | `api/auth.js`, `api/_lib/core.js`, `account.html` |
| Coach area | Dashboard, availability, bookings, schedule, club details, uploads, share, settings | `coach.html` |
| Share studio | Coaches write, save, edit and reuse social posts. Hashtags, tips, spellcheck. Buttons for Instagram, Facebook, TikTok and Google | `coach.html`, `api/site.js` (`posts-*`) |
| Enquiry form | Sends to Jay's coach email, the BOOKINGS_COPY_EMAIL address and warriorspirit@gmail.com. Owners see them in the Enquiries tile. Name and phone are required; email and the rest optional. The phone is checked as it's typed (UK mobiles 07 with 11 digits, UK landlines, +44 and other countries) and saved tidied ("07957 100963"); WhatsApp or text replies need a mobile, and an email reply needs an email. Same rules on the server | `api/enquiry.js`, `api/_lib/phone.js`, `site-src/index.html` |
| App on the home screen | Web app manifest, logo icons, "Get our app" buttons (hidden once installed). Installed app opens on today's classes on its first open each day | `manifest.webmanifest`, `sw.js`, `assets/install.js` |
| Security headers | HSTS, nosniff, referrer policy, frame protection, permissions policy. Coach and account pages are noindex and not cached. A content security policy runs in report-only mode (12 Nov 2026) until it has been checked on the live site; **enforce it by 28 Nov 2026** (two weeks after release, Council C-007) once the live console shows no reports. HSTS is set in `vercel.json` as well as by Vercel (14 Nov 2026) | `vercel.json` |
| Privacy page | Says which services handle data, cookies, rights, contact | `privacy.html` |
| Bot check (Cloudflare Turnstile) | Built 12 Nov 2026 (order A-038): an invisible "are you human" check on the enquiry form, member sign-up and member password reset, and (from 20 Nov, A-100, branch `action-log`) member and coach sign-in, checked on the server. **Off until both keys are set** in Vercel (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`; Steve makes the widget in the SRS Cloudflare account). A missing, expired, invalid or already-used token always fails. If Cloudflare itself can't be reached, the enquiry form and sign-in let people through (their limits still apply) and sign-up and password reset refuse. The widget renews an expired token and is reset after every send. The privacy page names Cloudflare (wording on branch, 14 Nov 2026, waiting for the club owner's OK). Tighter limits too: logins per account across all connections, and per connection on password reset | `api/_lib/turnstile.js`, `assets/human.js`, `api/enquiry.js`, `api/auth.js`, `account.html`, `site-src/index.html` |
| Spam and bot layers (A-100) | Built 20 Nov 2026 on branch `action-log`, around the bot check. **Enquiry form:** a hidden trap field (a bot is told "sent" and nothing is saved); 6 an hour per network and 3 a day per phone or email; an enquiry sent under 3 seconds after first touching the form, or that reads like a sales pitch (SEO, web design, guest posts, two links and so on: `api/_lib/spam.js`), is **saved but flagged as spam**: not emailed, not counted as an enquiry, never deleted. Jay sees them under Enquiries › Spam and can tap **Not spam**. **Sign-up and forgotten password:** the same hidden trap field (no time limit there: password managers fill those forms in under a second). **Every email the site sends:** a cap of 300 a day, so a flood can't use up the Gmail account's allowance. **Counted:** blocks and flags each month (`spamcount:YYYY-MM`, not in the action log), shown on Jay's Enquiries page. Tests in `tests/security.test.mjs`. |
| Tests | `npm test` (about 2 seconds): the phone check, one section per page, a title, description and its own canonical on every page, one h1 on every public page, sitemap and pages match, form errors announced to screen readers, no FighterBase on public pages, private files kept off the site; and, against a stand-in database, the bot check (missing, invalid, expired, reused tokens and Cloudflare down), the enquiry, sign-up and reset forms with it on and off, cookie flags, the same log-in answer for known and unknown emails, and a password reset ending older logins. The build warns (doesn't stop) when a title is over 60 characters | `tests/`, `tools/build-pages.mjs` |
| Automatic checks (hooks) | Order A-061, 14 Nov 2026: Claude Code runs `npm test` after every Write or Edit and again before a session ends (`.claude/settings.json`, `.claude/check.mjs`). They only report (exit code 2); they never change files, and the end-of-session check lets the session end on its second try. First catch: the missing h1 on 9 pages | `.claude/` |
| Nightly database copy | Built 16 Nov 2026 on branch `nightly-backup` (A-069), **off until `BACKUP_KEY` is set** (Steve's yes; keep the key in his password manager too, or the copies can't be opened if Vercel is lost). The morning reminder run also copies every lasting database key (not rate-limit counts), squeezes and encrypts it (AES-256-GCM) and saves one file a night to a "Warrior Spirit Backups" folder in the club's Google Drive, keeping 30 days. Restore with `tools/restore-backup.mjs` into an empty database (`--check` only reads the file). Tested: export, encrypt, restore into a second database and compare | `api/_lib/backup.js`, `api/_lib/drive.js`, `api/cron.js`, `tools/restore-backup.mjs`, `tests/backup.test.mjs` |
| Main headings and skip link | Every public page has one h1 (14 Nov 2026). A section written with only h2 headings gets its first h2 built as `<h1 class="h2">`, which keeps the h2 look. A "Skip to content" link appears on the first Tab and moves focus to the page content. Focused items scroll clear of the sticky header and the WhatsApp button | `tools/build-pages.mjs`, `site-src/index.html` |
| Recovery plan | `docs/RECOVERY.md` (A-069, 16 Nov 2026): what we hold and where, how much we could lose, what to do for each kind of problem, and the plan to close the gaps. The nightly copy and the action log are built on branches (not live yet); no restore test yet; the plan dates each one | `docs/RECOVERY.md` |
| Action log | Built 17 Nov 2026 on branch `action-log` (A-069), **not live yet** (Two-AI check first). Every lasting change the site's code makes to the database is saved with one log line in the same trip: who (coach, member, visitor or the daily job), which part of the site, what it was before and what it became, when, and the connection's IP address. One list a month (`audit:YYYY-MM`), kept 400 days, copied off-site by the nightly copy; nothing in the code deletes from it. Never logged: passwords (even scrambled), two-step secrets and codes, sign-in, reset and calendar links, the Drive key, rate limits and locks. Edits made straight in the Upstash console aren't seen, so: no console edits to live data. Read it with `node tools/action-log.mjs` (filters by month, who, record and date; read-only) | `api/_lib/actionlog.js`, `api/_lib/core.js`, every `api/*.js` (wrapped with `withLog`), `tools/action-log.mjs`, `tests/actionlog.test.mjs` |
| FighterBase switch-over switch | Built 16 Nov 2026 on branch `fighterbase-switchover` (orders WS-009, WS-010), **off**. One switch, `api/_lib/switchover.js`: off, the site is exactly as before and no FighterBase name, address or club code is stored or shown (a test checks the links stay empty while off). On (switch-over day: one commit with the live addresses, then `npm run pages`; rollback is reverting it): new PT bookings and adult class bookings answer "moved" with the FighterBase link (410); `/book` and the club calendar redirect there (302, written into `vercel.json` by the build); the public pages lose "Get the app", say "My bookings" and credit FighterBase in the footer; the account page sends adults to the app but keeps bookings already made (run-off) and kids class booking (until the kids review), so sign-up stays open for parents; personal calendars keep the site's bookings plus one "moved" note; the coach area shows a banner and keeps its tools for the run-off. The plan: `warrior-spirit-fighterbase-switchover-plan.md` in The Manor | `api/_lib/switchover.js`, `api/pt.js`, `api/auth.js`, `api/cal.js`, `account.html`, `coach.html`, `tools/build-pages.mjs`, `tests/switchover.test.mjs` |

**Where data lives (database keys):** `classes`, `classtypes`, `gymhours`, `site:hero`, `site:videos`, `site:text`, `site:images`, `site:library`, `site:classimg`, `site:posts`, `user:<email>`, `booking:<id>`, `cbk:<id>`, `profile:<coach>:live`, `site:options`, `photo:optout`, `coach:sess`, `coach:<id>:2fa`, `coach:<id>:devices`. Never document values.

**Forms and where enquiries go.** The contact form posts to `/api/enquiry`, which emails the addresses above. Personal details go in the request body, not the web address. A real test enquiry has not yet been confirmed (Steve will test it).

**Turbo pieces on the site:** none.

**Integrations:** Gmail (sending), Google sign-in, Google Drive (photo uploads and sync), Upstash, Vercel Blob. FighterBase: none yet.

**Analytics:** none. The site does not count visitors. There is no Turbo line. What it can't count: visits, enquiries by source, installs of the app.

**Page size.** Since 12 Nov 2026 each page file holds only its own section plus the shared header, footer, styles and scripts (about 120 KB instead of 300 KB before compression). Links between sections are ordinary page loads; a "free class" or "kids class" choice made on one page is carried to the contact form (browser session storage). Scripts for one section must check their elements exist, because other pages don't have them.

## 6. Status

| Area | Status |
|---|---|
| Public site | Live and public since 25 Oct 2026. Allowed in search engines |
| Coach area and bookings | Live. Used by Jay, Steve, Aaron and Kian |
| Drive sync and photo library | Built. Not yet fully checked live with real uploads |
| Edit mode, calendar feeds, reminders, share studio | Built. Not yet checked on real phones and accounts |
| FighterBase link | Not connected. Hidden from the public. Handover from the FighterBase project received 30 Oct 2026. Nothing agreed yet on who owns the timetable, bookings or payments |
| Payments and memberships | Not built. Pay at the gym for now |
| Check-in and attendance | Not built. Likely to come from FighterBase |

## 7. What we don't want

- Anything about FighterBase on a public page until Steve says go.
- Coach editing that moves sections, removes features or changes layout.
- Whole-site editing for anyone but the two owners.
- Copying other gym apps (for example Wodify) feature for feature. Build what works for the club, and leave attendance and payments to FighterBase.
- The word "octagon" or cage imagery, and any claim of professional or medical advice. (From the FighterBase brand rules, kept for consistency.)
- Photos of Dan Jones, his partner, or the person removed from the corner photo.
- Anything that implies the site was built with AI.
- Personal email addresses on the public site.

## 8. What can't be done

| Limit | Why it matters |
|---|---|
| Instagram, TikTok and Google do not let a website fill in a post | The Share buttons copy the caption, save the picture and open the right page. The person pastes and posts |
| iPhone cannot install the site as an app in one tap | The button shows the Add to Home Screen steps |
| Vercel Hobby runs cron jobs once a day | Reminders are morning and evening. "One hour before" needs the Pro plan |
| Vercel Hobby allows 12 functions | 11 are used. New features must go inside existing functions |
| iPhone HEIC photos cannot be read by the site | The Drive sync skips them and asks for a JPG |
| Claude cannot create accounts, enter passwords or keys, accept terms or make payments | Steve does these |
| Claude cannot see the live site's logged-in data on its own | Steve logs in; Claude reads through his browser, only when asked |
| The public web cannot show FighterBase data | FighterBase refuses logged-out visitors today and has no public feed |

## 9. Launch and findability status

Checked against the SRS standards on 1 Nov 2026. "Verified" means checked on the live site that day.

| Standard | Status | Notes |
|---|---|---|
| Code in GitHub, auto-deploys | **Done** | Private repo, deploys from `main` |
| Business details in one settings file | **To do** | Typed through the pages, JSON-LD, footer and privacy page |
| Agreed engine (Astro on Cloudflare) | **n/a for now** | Custom Vercel build. Patterns to carry across later: owner editing, photo library, coach area, booking |
| Every form sends, test enquiry arrived | **Done** | Steve confirmed 5 Nov 2026 that enquiries are arriving at warriorspirit@gmail.com |
| Personal details out of the address bar | **Done** | Forms post in the request body |
| Enquiries reported to Turbo | **To do** | Not in Turbo |
| Tap-to-call and email shown | **Done** | Phone and warriorspirit@gmail.com on the contact section |
| Search Console and Bing set up, sitemap submitted, home page sent | **Done** | 5 Nov 2026: both verified by meta tags, sitemaps submitted (Google found all 36 pages) |
| Listed on Google and Bing, baseline recorded | **To confirm** | A Google listing seems to exist. No baseline recorded |
| Crawler Hints or IndexNow | **To do** | Vercel has no setting for this. Use IndexNow if needed |
| One address only (www and bare domain) | **Done** | Verified: bare domain redirects to www |
| Hosting address redirects or is noindex | **Done** | Added a permanent redirect from any `*.vercel.app` address to www (not for `/api`, so scheduled jobs keep working). Verified 4 Nov 2026: `warrior-spirit-muay-thai.vercel.app/pt` lands on `www…/pt` |
| robots.txt with sitemap, crawlers allowed | **Done** | Blocks only `/coach`, `/account`, `/api/`. Does not block any search or AI crawler |
| Unique title, description, canonical, Open Graph, `lang="en-GB"` for every page | **Done** | All 32 sections and the other pages have their own. Link-preview image is the gym photo with the logo |
| Sitemap with real last-changed dates | **Done** | 36 addresses, dates from the last change to the source |
| Real 404 for missing pages | **Done** | Verified |
| Google-readable business details match the official facts | **Partly** | One `SportsActivityLocation` block with name, phone, address and areas. Opening hours and Ltd details not checked against the facts |
| Genuinely local town and service pages | **To confirm** | They now have their own addresses. Content quality not reviewed |
| Speed score 90+ on mobile | **Accepted** | Steve, 4 Nov 2026: confident the speed is good (not measured with Google's test). Fonts are stored locally and videos don't load on phones |
| Images WebP with width and height, lazy | **Partly** | Photos are WebP. Width and height not checked |
| Fonts stored on the site, two families at most | **Partly** | Stored on the site (done). Still three families (Big Shoulders Display, Barlow, Barlow Condensed), which is one more than the standard |
| No background video on phones | **Done** | Hero videos show their poster picture on phones and data-saver |
| Privacy notice names services, cookie-free counting, ICO line, last updated | **Done** | Names Vercel, Upstash and Google (and Cloudflare Turnstile plus the sign-in attempt counts on branch `audit-fixes-2026-11`, waiting for the club owner's OK). Has the line about complaining to the ICO. No visitor counting at all. Last updated 25 Oct 2026 |
| No tracking or advertising cookies | **Done** | Only login cookies |
| Terms and accessibility statement | **Done (draft)** | Both added 2 Nov 2026. Wording about photo opt-out, coach cancellations and video captions needs Steve's check (see section 13) |
| Ltd company details in the footer | **n/a** | Sole trader, not a limited company. Owner's name not shown, by Steve's choice (5 Nov 2026) |
| Real reviews with their source | **Done** | "4.9 from 100 Google reviews across our Potters Bar and Hoddesdon listings" |
| Real photos. AI images labelled as illustrations | **Done** | The 10 AI class pictures show an "Illustration" label |
| Affiliate disclosure | **n/a** | No affiliate links |
| https and HSTS | **Done** | Verified: HSTS max-age 63072000 |
| Frame, nosniff, referrer, permissions headers | **Done** | Verified |
| Content security policy | **Partly** | Report-only since the 12 Nov 2026 branch; enforce after a check of the live pages and the coach area. Local check 17 Nov 2026 with `tools/csp-check.mjs` (every page in a real browser with the policy enforced): 38 pages, nothing blocked. Once the report-only policy is live, run the same tool against the live site (`node tools/csp-check.mjs https://www.warriorspiritmuaythai.co.uk`) and with a coach signed in, then switch the header to enforced |
| Two-step verification on every account | **Partly** | Coach area done 4 Nov 2026 (required for owners). Outside accounts (Vercel, GitHub, Google, names.co.uk, Upstash) still to confirm: each person turns it on in that account's settings |

## 10. Wanted next

Most urgent first.

1. **Google listing:** Jay adds the website address to the Google profile. Once Steve's dedicated SRS Google account exists, ask Jay to give it manager access, then set the website link with `?src=gbp` (or ask Turbo to, through its Business Profile API).
2. **Domain to Cloudflare** (Steve's SRS rule, 6 Nov 2026): add the domain to the SRS Cloudflare account, copy the DNS records (the Vercel records; there is no domain email today), switch the nameservers at names.co.uk, then check the site and its padlock. Later, move the registration to Cloudflare in the club's name. Each step that changes an account needs Steve's yes; he signs in, Claude sets up the rest. **The hosting can follow (WS-011, order A-074):** branch `cloudflare-move` runs the whole site on Cloudflare Workers in a local test (16 Nov 2026: pages and clean addresses, the security and no-index headers, sign-up and log-in, calendars, coach pages and the morning job all pass; `node tools/build-cloudflare.mjs` makes the upload folder; `tools/copy-database.mjs` copies the database to the new one and checks both ends match, built 17 Nov). Still to build: R2 storage for photos in place of Vercel Blob, photo resizing in the browser (sharp can't run on Workers) and an email route. Needs Steve's yes on Workers Paid ($5 a month: sign-in hashing needs more than the free plan's 10 ms), the new database and storage, and the email route.
3. Watch Search Console and Bing over the next few weeks: pages indexed, searches people use. (6 Nov 2026: a web search for the site's own name did not show it; check Google's index in Search Console.)
4. **Check Steve's wording** in the new terms and accessibility pages (section 13, question 11).
5. **Fill in optional wording, then switch it on in Club details → What the website shows** (no longer shown as yellow placeholders). Was: **Fill the yellow "to confirm" items on the public pages** (parking, bus routes, contract and notice terms, gloves to borrow, parents watching, women-only sessions, student pricing, governing body and insurance, coach bios, fight results, YouTube link). Then remove the "Draft v11" footer line.
6. Coaches change their starter passwords. Check two-step verification on all accounts.
7. Reduce speed risks that remain: page size (all sections in every page), image sizes, one fewer font family. Add a content security policy.
8. Move business details into one settings file.
9. Add the site to Turbo, with enquiry reporting by source (`?src=gbp` and the form), so the club can see which visits become members.
10. Agree the FighterBase link (section 12), then build only what is agreed.
11. Later: online payments and memberships. Check-in and attendance (likely FighterBase).
12. Optional: ~~an activity log of who changed what~~ (built 17 Nov 2026 as the action log, branch `action-log`). Vercel Pro for "one hour before" reminders. Pro would also lift the 12-function limit.

## 10a. Automate it for the user (order A-116)

What people do by hand on or around this site today, and what could do it for them. Cheapest and safest first. Agents never send messages, spend money or publish anything public without the right yes (`Batcave\Publishing rules.md`). Members' bookings, payments and reminders move to FighterBase, so they're left out here. Re-ranked monthly; new hand steps go in as soon as they're seen (A-117).

| # | Done by hand today | Who | Kind | What could do it | Effort |
| --- | --- | --- | --- | --- | --- |
| 1 | Replying to each website enquiry (free class times, what to bring, prices) by WhatsApp or phone | Jay | Do it for them | A ready-made reply drafted for each enquiry, opened in WhatsApp with one tap; Jay checks and sends. Later a managed agent that drafts it with the right class times | Small (drafts), medium (agent) |
| 2 | Looking through the Spam list in case a real enquiry is there | Jay | Keep it working | A daily check of flagged enquiries that moves obvious real ones back to "To reply" and tells Jay | Small |
| 3 | Checking the site still works: the form, links, speed, Google indexing | SRS | Keep it working | Turbo's monitor once the site is added (Wanted next 9), with a weekly test enquiry to Steve's own inbox (A-113) | Small, once added |
| 4 | Writing news posts (results, gradings, events) and picking photos for them | Jay, coaches | Keep it moving | A managed agent drafts a post from FighterBase results and the newest Drive photos (resized, alt text written); Jay approves it in edit mode | Medium |
| 5 | Choosing and placing new photos on the site | Owners | Keep it moving | Suggest the best new Drive photos for empty or old photo spots (the photo map knows every spot); one tap to accept | Medium |
| 6 | Google profile posts, review replies and listings | Jay, SRS | Keep it moving | Turbo's Google tools and Turbo Link, once SRS has manager access (Wanted next 1) | Small, once access exists |
| 7 | Changing wording or asking SRS for a change by phone | Owners | Do it for them | Edit mode already does wording and photos; next, a "Request a change" box on every item (handoff to the Site Factory, 21 Nov) that a managed agent can pick up | Medium |

## 11. Decisions log

Dates come from the repo history and chats. "Chat, date not recorded" means the decision was made in conversation and the exact day was not kept.

| Date | Decision |
|---|---|
| 23 Oct 2026 | Build a new website for the club. First staging version created. Kian Hughes replaces Charlie as trainer |
| 23 Oct 2026 | The club story leads with Hoddesdon. Old Hoddesdon branding in photos is fine |
| 23 Oct 2026 | Coach logins and PT booking added. Free first class and a safeguarding page draft |
| Chat, date not recorded (about 23 Oct) | Dan Jones (now at another club) and his partner are not shown in photos or videos |
| 24 Oct 2026 | Coach profile and price changes need Jay's approval. Coach pages live at `/team/name` |
| 24 Oct 2026 | FighterBase badges and an "Online payments coming soon" page added (hidden again on 30 Oct) |
| 24 Oct 2026 | Contact form sends enquiries to the gym. Coaches can add class types and their own classes |
| 25 Oct 2026 | Steve approves going public. Site live on www.warriorspiritmuaythai.co.uk. Search engines allowed |
| 25 Oct 2026 | Steve and Jay are both owners. Whole-site editing is for owners only. Other coaches edit only their own page photos, with approval |
| 25 Oct 2026 | Coach edit mode added: wording and photo swaps only, no layout changes or moving sections |
| 25 Oct 2026 | Calendar feeds, class booking with maximum places, opt-in reminders and a "notify members" button added |
| 25 Oct 2026 | Payments and memberships are left for later. Check-in and attendance are expected to come from FighterBase, not copied from other gym apps |
| 25 Oct 2026 | Corner photo removed from the hero because the main person left the club. No sound button on hero videos |
| 25 Oct 2026 | Google Drive connected for coach uploads. Google Cloud project to run under Steve's general-use Google business login. Originals stay in the gym images folder. Vercel storage kept small for now |
| 30 Oct 2026 | A shared photo library for owners and coaches. Photos can be added to the carousel, kept in the library or deleted |
| 30 Oct 2026 | Public contact email becomes warriorspirit@gmail.com. Enquiries are copied there |
| 30 Oct 2026 | Class pictures on the timetable. Owners choose them |
| 30 Oct 2026 | The site can be installed as an app on a home screen, with the logo as the icon |
| 30 Oct 2026 | **All FighterBase references are removed from public pages and parked until FighterBase is fully operational.** Any related work stays off public pages |
| 30 Oct 2026 | Discussion started with the FighterBase project about how the two connect. No build agreed |
| 1 Nov 2026 | Owner-only features are blue with a star stamp. Everyone-else features stay red |
| 1 Nov 2026 | Share studio: coaches can create, save, edit and reuse their own posts, with hashtags, writing tips and spellcheck |
| 1 Nov 2026 | Owners get a Site overview page. This handbook is created |
| 2 Nov 2026 | Steve: a lot of this site will move to FighterBase later (for example class booking and subscriptions). Effort now goes into public pages, legal pages and speed; tooling stays small |
| 2 Nov 2026 | Every section gets its own web address. Pages are generated from one source file by a script and committed. Terms and accessibility pages added. Fonts stored on the site. Hero videos no longer load on phones. Link-preview tags, a dated sitemap and a redirect from the vercel.app address added. AI pictures labelled as illustrations |
| 2 Nov 2026 | Share studio: on phones the Instagram and TikTok buttons open the phone's share sheet with the picture attached (as a JPEG) and put the caption on the clipboard to paste. Instagram does not let any website pre-fill a caption. Computers keep the old way: open the site, copy the caption, save the picture |
| 2 Nov 2026 | Two gym ring photos (Jay's Drive uploads) are straightened, zoomed and colour-boosted, then added to the photo library. Not placed on a page yet |
| 3 Nov 2026 | Photos & videos, Photo library and Website photos & videos become one **Photos & videos** hub. Every photo shows where it's shown on the website. Owners can replace it everywhere, take it off the website (it stays in the library) or delete it. Coaches can put it on their own page (Jay approves) and delete their own unused photos. A photo can only be deleted once it's shown nowhere. "Replace everywhere" never changes coach pages; "Take off the website" also removes it from coach galleries. The build script also writes a map of every photo on the public pages |
| 4 Nov 2026 | No women-only sessions, no student prices (adults and kids only) and no bus routes, so they are removed; directions stay. Steve's rule: optional things are switchable, and nothing shows as an empty space or "to confirm" wording unless it's required. Owners switch optional parts in Club details; a part can't be switched on until its wording is filled in. Coach bios show only once the coach fills in My profile. The "Draft v11" line is removed |
| 4 Nov 2026 | Members can ask to be left out of photos and videos in their account (it covers their child too); coaches see the list |
| 4 Nov 2026 | The club is a sole trader. Jay owns the Google Business Profile; the Hoddesdon listing is left for now. Speed accepted as good by Steve |
| 4 Nov 2026 | Two-step sign-in for the coach area built and live: an emailed 6-digit code, required for owners, optional for coaches, trusted devices for 30 days, "Sign out everywhere". An owner with no email is let in once with a warning, then must ask the other owner. Search Console and Bing to be owned by warriorspirit@gmail.com |
| 4 Nov 2026 | A full FighterBase club-onboarding brief written for the FighterBase developer (Claude Doc "FighterBase club onboarding: brief and handover"): six required stages, optional modules, guides, and the "never empty" rule |
| 5 Nov 2026 | Enquiry form: name and phone required, everything else optional; the phone number is checked for being a real UK (or international) number as it's typed |
| 5 Nov 2026 | Search Console set up in Steve's yourhousewash@gmail.com Google account (Claude can't sign in to warriorspirit@gmail.com), with warriorspirit@gmail.com and Jay added as owners. Bing set up in Steve's Microsoft account. Both verified by meta tags; sitemaps submitted |
| 5 Nov 2026 | Sole trader: the owner's name is not shown on the site (Steve's decision). Enquiries confirmed arriving at warriorspirit@gmail.com |
| 5 Nov 2026 | Alfred's Standing Orders v1 adopted (provisional adoption): this project reports to Alfred, writes a status card every working session to `C:\The Manor\Businesses\SRS\warrior-spirit-status.md` (introduction report beside it), and follows the chain of command and approval rules. The orders are in `CLAUDE.md` |
| 6 Nov 2026 | The Batcave starter replaces Standing Orders v1: every session and wake-up starts from `C:\The Manor\Batcave\Starter Pack\Ready to paste\Warrior Spirit Muay Thai.md` (Agent Rules core, Lead and Builder add-ons, orders). Project log `warrior-spirit-log.md` beside the status card. Team set up in the repo: `handoffs/TASKS.md`, `handoffs/HANDOFF-PACK.md`, `STATUS.md` (all kept off the live site) |
| 6 Nov 2026 | Steve (10:30, order A-017): one handbook copy, in the repo, with a pointer in the Project; in a live session his chat go-ahead covers publishing, but wake-ups and unattended runs build on a branch and wait for an exact "publish <commit>" approval; a dedicated SRS Google account for client profiles, agreed in principle, with no new Google access requests until it exists. Google's Business Profile API was approved for Turbo (A-015); Warrior Spirit asks Turbo, through Alfred, for any profile changes by API |
| 6 Nov 2026 | Steve approved publishing the team set-up (commit 6c055be, his word "yes", 11:24, order WS-001); merged and deployed 15:59. Team rhythm: this project wakes itself at 11:00, 16:00, 19:00 and 01:00 UK. Reuse shared accounts before creating any. **Client domains go on Cloudflare** (SRS rule, 18:10). Road to paying: every run keeps a "Road to paying" section on the status card (Steve: "I need these to be functioning, paying businesses very soon") |
| 11 Nov 2026 | FighterBase cross-check agreed by Steve: the site stays the shop window; booking, PT, member accounts, reminders, calendar feeds and payments move to FighterBase when it's ready (kids booking after its kids review); the site keeps its own enquiry form until FighterBase's trial widget exists; "Powered by FighterBase" appears only on switch-over day; owners and coaches keep site logins for the site's content tools |
| 12 Nov 2026 | Steve: build the skills-audit fixes on a branch (one section per page, contrast, bot check, titles, security settings and tests); publish commit 1f13439 (done); add the site to Turbo now; SRS gets **manager** access to the club's Google profile, the club stays owner and FighterBase gets none (they are legally separate); Jay adds steve@srsprojects.co.uk himself. The profile is managed by an address starting "wh…@gmail.com" (to confirm with Jay). Found and fixed on the branch: the "Send enquiry" button jumped when the phone field lost focus, so a first click could miss |
| 14 Nov 2026 | Council C-007 (Oracle and Lucius, collated by Alfred 13 Nov) said yes to the audit-fix release on conditions; done on the branch: bot check fails safely, a password reset ends older member logins, the log-in answer doesn't reveal accounts, form errors are announced, one h1 per page, skip link, HSTS stated, privacy wording drafted for the owner. Titles needn't be cut to 60 characters (Google sets no limit): the build now only warns. Content security policy to be enforced by 28 Nov 2026. Releases touching sign-in, payments, permissions, personal data or the whole site get one Codex review before the publish line (A-063); this release is the first |
| 16 Nov 2026 | Steve (09:39, in this chat): "bring everything forward, action everything immediately". The FighterBase switch-over is built now on branch `fighterbase-switchover` (from the audit-fix branch, not waiting for that release), switched off, so switch-over day is one change. Adults book in FighterBase after the switch; bookings already made run out on the site (at most 6 weeks: PT can be booked 6 weeks ahead, classes 2); kids classes stay on the site until the kids review, so sign-up stays open for parents; the club code never goes on a public page before FighterBase's owner-approval change is applied |
| 16 Nov 2026 | Security sweep (A-073): the shared coach starting password is removed. The code is public on GitHub, so it let anyone sign in as a coach who hadn't set their own password. Every coach now needs their own password: set by an owner in Manage coaches, or chosen through "Forgotten password" |
| 16 Nov 2026 | Security sweep follow-ups (A-073): enquiry text has card numbers and passwords removed before it's saved or emailed (S-008); social, YouTube and Instagram links are checked again when shown, not only when saved (S-012); every server value in coach and account page attributes is escaped (S-011) |
| 16 Nov 2026 | Class rosters (S-003): a coach sees the bookings for their own classes and for any date they're covering; owners see every class. Before, a cover coach saw nothing for the class they were taking |
| 16 Nov 2026 | Cloudflare Workers move, step 3 (WS-011): every API file except the Google Drive photo import now runs through the Worker adapter, with the Vercel rewrites, headers and daily jobs copied across; not deployed, nothing changes on the live site |
| 17 Nov 2026 | Action log built (A-069, due 27 Nov, brought forward): every change made through the site is logged with who, before and after, kept 400 days; secrets never logged. Not live until the Two-AI check. The privacy page will need a line about it (with the other privacy wording waiting for Jay or Steve) |
| 19 Nov 2026 | **The starting-password incident is closed as not reportable** (Steve, in the chat, 11:41: "nothing has gone anywhere other than me so far": only his own test data was on the site, so no other person's data could be seen). Fixes live: 976d43a (18 Nov, no starting password) and fb0b15e (19 Nov 11:43, Steve's words "publish fb0b15e": a coach with no password of their own has no session). Record: `warrior-spirit-breach-log.md` in The Manor. Test member data is cleared on switch-over day; logins are kept |
| 20 Nov 2026 | Order A-106 (Steve, 19 Nov 23:33: never tell a visitor we don't cover their area): swept the live code (fb0b15e) and the release branches. Nothing turns anyone away; the Areas page already says "Don't see your town? Ask us." No change needed. |
| 20 Nov 2026 | Order A-100 spam layers built on branch `action-log` (see What's built). The bot check itself still waits for Steve's Cloudflare keys (WS-A038). The privacy line for the bot check goes to the Legal PA with FighterBase's approved v433 wording as the model (Cloudflare is also a controller for the signals it keeps). |
| 20 Nov 2026 | Order A-099 breach-ready: the whole history (154 commits, every branch) was scanned for secrets. **Lesson:** truffleHog's entropy and pattern checks did not find the old starting password; a simple rule for `password = "..."` style assignments did. Use a scanner with a generic password rule (for example gitleaks) for future scans. The scan also found an early coach access code (23 Oct, a page with nothing behind it, removed the same day); recorded in the breach log as Incident 2. Payment lessons P-010 to P-029 don't apply: the site takes no payments. |
| 20 Nov 2026 | Order A-102: no solicitor checks on any list or gate until Steve says; Alfred reminds him at the public launch. |
| 21 Nov 2026 | The Legal PA passed the bot-check privacy wording (20 Nov 01:34, with one change: say the club reads flagged enquiries). Added to the privacy page on `action-log`: a "Checking you're a person" section, a cookies line, and the attempt counts now kept "within a day" (the per-person enquiry limit lasts a day). The last change and the date go to the Legal PA at the release gate. The Legal PA also agreed Incident 2 isn't a personal data breach; Steve confirms the old code and password aren't used anywhere else. |
| 21 Nov 2026 | Order A-116: "Automate it for the user" section added (10a), seven hand steps ranked. Order WS-014: the edit mode handoff for the Site Factory and Turbo written (`Businesses\SRS\warrior-spirit-handoff-2026-11-21-site-factory-edit-mode.md`), including what went wrong (saved edits can stop matching when source wording changes; edits shown only after JavaScript runs). |
| 25 Nov 2026 | Sitemap dates now come from each page's last real change (`git log --no-merges`), so merging the release branch into the others no longer changes every date. Checked: a rebuild after the merge changes nothing on `fighterbase-plugin` or `cloudflare-move`. (A-117 "Simpler next time", 21 Nov.) |

## 12. Still to decide

**FighterBase connection** (from the FighterBase handover, 30 Oct 2026)
- Which system owns the timetable, class booking, membership sign-up and payments, during the pilot and afterwards. Our suggestion: this website stays the master for the timetable and public content until FighterBase has a real shared database.
- Whether FighterBase reads this site's public timetable and opening hours during the pilot.
- Shared login: "Sign in with FighterBase", or links only.
- What may be public: a club page, a timetable or fighter profiles, and the consent needed.
- What happens to kids' bookings, because FighterBase is adults only for now.
- Data protection roles and agreements before any member data is shared.
- Which address and Stripe account online payments would use.
- When the "Powered by FighterBase" badge must appear, and where, once it goes public.

**Other**
- Whether coaches may propose video gallery changes for owner approval.
- Whether to find other photos of the person who left the club, and whether to swap other uses of that photo.
- How to give every page its own web address (see wanted next, item 1).
- Whether to keep the Hobby plan or move to Pro at launch.

## 13. To confirm

Questions for Steve. Nothing here has been filled in as if it were true.

1. ~~Legal entity~~ Sole trader (4 Nov 2026); owner's name not shown (Steve, 5 Nov 2026).
2. Which Gmail account sends the site's emails (the one behind `SMTP_USER`)?
3. ~~Search Console and Bing~~ Done 5 Nov 2026.
4. ~~Google Business Profile owner~~ Jay (4 Nov 2026); Hoddesdon left for now.
5. Which social accounts exist for Facebook and YouTube, and who holds the logins?
6. Does Jay own the `.com` domain, and should it redirect to the `.co.uk` site?
7. Have the coaches changed their starter passwords, and is two-step verification on for the accounts above?
8. ~~Test enquiry~~ Arriving (5 Nov 2026).
9. Are the opening hours in the Google-readable business details correct?
10. Should any of the 10 AI pictures be replaced by real photos? (They are now labelled as illustrations.)
11. ~~Terms and accessibility wording~~ Confirmed by Steve on 4 Nov 2026; the photo opt-out is now built. Was: Please check the new terms and accessibility pages. Things I wrote without being told: members can ask to be left out of photos and videos; a coach can cancel a session and the customer is emailed; some videos have no captions; replies within 5 working days. Is each true?
12. ~~Whether the Photo library tile should be blue.~~ Settled 3 Nov 2026: one red Photos & videos tile (everyone uses it), with the owner tabs inside blue.
