# Warrior Spirit Muay Thai website: Handbook

**What this is:** the website, member accounts, class and PT booking and coach area for Warrior Spirit Muay Thai & Kickboxing, Potters Bar.

**If it isn't here, it isn't decided.** This handbook changes only by agreement: someone proposes a change and says why, Steve agrees, then it is made and dated in the decisions log. Facts about what is built are updated as part of building.

**Copies (kept identical):**
- `docs/HANDBOOK.md` in the GitHub repo `yourhousewash-code/Warrior-Spirit-Muay-Thai`
- the Project doc `claude/handbook.md` in the claude.ai Project "Warrior Spirit Muay Thai"

**This file is private.** It is kept out of the live website (see `.vercelignore`). Never publish it: it mentions FighterBase.

**Related:** SRS Site Factory handbook (how SRS builds sites) and the Turbo handbook (what happens after launch). Neither is linked to this site yet.

**Last updated:** 4 November 2026

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
| Legal entity | Sole trader (Steve, 4 Nov 2026). The website must show the owner's name with the trading name, an address and an email | Confirmed; owner's full name **to confirm** |
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
14. **Optional, never empty** (Steve, 4 Nov 2026): anything optional can be switched on or off by owners, and nothing on the public site shows as an empty space or "to confirm" wording unless it's a required item. A part with wording to fill in can't be switched on until it's filled in.
13. Much of the booking, account and coach tooling is expected to move to FighterBase. Spend effort on the public pages, legal pages and speed here, and keep new tooling small.

**SRS standards that apply:** see section 9 for how the site measures up.

## 4. Accounts and access

The business owns its own accounts. SRS accounts use `steve@srsprojects.co.uk`. **AI never signs in, enters passwords or keys, or accepts terms.** No secrets are written here, only where they live.

| Account | Owner / who can get in | Notes |
|---|---|---|
| Domain `warriorspiritmuaythai.co.uk` | Registered at names.co.uk. Steve has the login | Points at Vercel. The `.com` is thought to belong to Jay (unconfirmed) |
| GitHub | `yourhousewash-code` (Steve), private repo `Warrior-Spirit-Muay-Thai`. Pushes to `main` deploy automatically | GitHub reports the repo has moved to the capitalised name. Update the remote when convenient |
| Vercel (hosting) | Steve's account | Settings and secrets live in Vercel → Project → Settings → Environment Variables |
| Upstash Redis (database) | Linked through Vercel | Holds accounts, bookings, classes, hours and site content |
| Vercel Blob (file storage) | Linked through Vercel | Holds uploaded photos and videos |
| Gmail sending account | A Google account whose app password is stored in Vercel (variables `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) | Which account this is is **to confirm** |
| Google Cloud project (Google sign-in and Drive uploads) | Steve's general-use Google business login | Variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Drive folder "Warrior Spirit Uploads" |
| Other secrets in Vercel | `SESSION_SECRET`, `CRON_SECRET`, `BOOKINGS_COPY_EMAIL`, `SITE_URL` | Never copy values anywhere |
| Coach logins on the site | Jay, Steve, Aaron, Kian (usernames `jay`, `steve`, `aaron`, `kian`). Jay can add or hide coaches | Coaches should change their starter passwords. Steve's login has no starting password |
| Google Search Console | Not confirmed | **To confirm** |
| Bing Webmaster Tools | Not confirmed | **To confirm** |
| Google Business Profile | Jay owns the Potters Bar listing and is adding the website address (Steve, 4 Nov 2026). The Hoddesdon listing is left alone for now. A listing seems to exist (the site shows a 4.9 rating from about 100 Google reviews across the Potters Bar and Hoddesdon listings) | Owner and access **to confirm** |
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
| Site overview (owners) | Every photo, who added it, where it is used, Drive status | `api/site.js` (`overview`) |
| Coach pages `/team/name` | Bio, photo gallery, prices | `api/team.js`, `api/profile.js` |
| PT booking | Coaches set weekly hours and holidays. Customers book 1-to-1, doubles or groups, with email alerts | `api/pt.js`, `book.html` |
| Class booking | Members book classes. Coaches set maximum places | `api/pt.js`, `account.html` |
| Reminders and notify | Morning and evening reminder emails (opt-in). Owners can notify members of timetable changes | `api/cron.js`, `api/pt.js` |
| Calendar feeds | Club feed and personal feed that phones can subscribe to | `api/cal.js`, `api/_lib/ics.js` |
| Member accounts | Email and password, email verification, Google sign-in | `api/auth.js`, `account.html` |
| Coach area | Dashboard, availability, bookings, schedule, club details, uploads, share, settings | `coach.html` |
| Share studio | Coaches write, save, edit and reuse social posts. Hashtags, tips, spellcheck. Buttons for Instagram, Facebook, TikTok and Google | `coach.html`, `api/site.js` (`posts-*`) |
| Enquiry form | Sends to Jay's coach email, the BOOKINGS_COPY_EMAIL address and warriorspirit@gmail.com. Owners see them in the Enquiries tile | `api/enquiry.js` |
| App on the home screen | Web app manifest, logo icons, "Get our app" buttons (hidden once installed). Installed app opens on today's classes on its first open each day | `manifest.webmanifest`, `sw.js`, `assets/install.js` |
| Security headers | HSTS, nosniff, referrer policy, frame protection, permissions policy. Coach and account pages are noindex and not cached | `vercel.json` |
| Privacy page | Says which services handle data, cookies, rights, contact | `privacy.html` |

**Where data lives (database keys):** `classes`, `classtypes`, `gymhours`, `site:hero`, `site:videos`, `site:text`, `site:images`, `site:library`, `site:classimg`, `site:posts`, `user:<email>`, `booking:<id>`, `cbk:<id>`, `profile:<coach>:live`, `site:options`, `photo:optout`. Never document values.

**Forms and where enquiries go.** The contact form posts to `/api/enquiry`, which emails the addresses above. Personal details go in the request body, not the web address. A real test enquiry has not yet been confirmed (Steve will test it).

**Turbo pieces on the site:** none.

**Integrations:** Gmail (sending), Google sign-in, Google Drive (photo uploads and sync), Upstash, Vercel Blob. FighterBase: none yet.

**Analytics:** none. The site does not count visitors. There is no Turbo line. What it can't count: visits, enquiries by source, installs of the app.

**Known limit.** Every page file still contains all the sections (only the right one is shown), so each file is about 270 KB before compression. The pages work, but they are heavier than they need to be. If speed matters later, split the sections into separate lighter pages.

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
| Every form sends, test enquiry arrived | **To do** | Sends to three addresses. A real test has not been confirmed |
| Personal details out of the address bar | **Done** | Forms post in the request body |
| Enquiries reported to Turbo | **To do** | Not in Turbo |
| Tap-to-call and email shown | **Done** | Phone and warriorspirit@gmail.com on the contact section |
| Search Console and Bing set up, sitemap submitted, home page sent | **To confirm** | |
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
| Privacy notice names services, cookie-free counting, ICO line, last updated | **Done** | Names Vercel, Upstash and Google. Has the line about complaining to the ICO. No visitor counting at all. Last updated 25 Oct 2026 |
| No tracking or advertising cookies | **Done** | Only login cookies |
| Terms and accessibility statement | **Done (draft)** | Both added 2 Nov 2026. Wording about photo opt-out, coach cancellations and video captions needs Steve's check (see section 13) |
| Ltd company details in the footer | **To confirm** | Depends on the legal entity |
| Real reviews with their source | **Done** | "4.9 from 100 Google reviews across our Potters Bar and Hoddesdon listings" |
| Real photos. AI images labelled as illustrations | **Done** | The 10 AI class pictures show an "Illustration" label |
| Affiliate disclosure | **n/a** | No affiliate links |
| https and HSTS | **Done** | Verified: HSTS max-age 63072000 |
| Frame, nosniff, referrer, permissions headers | **Done** | Verified |
| Content security policy | **To do** | Not set |
| Two-step verification on every account | **To confirm** | |

## 10. Wanted next

Most urgent first.

1. **Confirm the test enquiry arrives** at warriorspirit@gmail.com, and confirm Search Console, Bing and the Google listing. Submit the new sitemap (36 addresses) once the new pages are live.
2. Search Console and Bing: being set up with Steve on 4 Nov 2026 under warriorspirit@gmail.com.
3. **Check Steve's wording** in the new terms and accessibility pages (section 13, question 11).
4. **Fill in optional wording, then switch it on in Club details → What the website shows** (no longer shown as yellow placeholders). Was: **Fill the yellow "to confirm" items on the public pages** (parking, bus routes, contract and notice terms, gloves to borrow, parents watching, women-only sessions, student pricing, governing body and insurance, coach bios, fight results, YouTube link). Then remove the "Draft v11" footer line.
5. Coaches change their starter passwords. Check two-step verification on all accounts.
6. Reduce speed risks that remain: page size (all sections in every page), image sizes, one fewer font family. Add a content security policy.
7. Move business details into one settings file.
8. Add the site to Turbo, with enquiry reporting.
9. Agree the FighterBase link (section 12), then build only what is agreed.
10. Later: online payments and memberships. Check-in and attendance (likely FighterBase).
11. Optional: an activity log of who changed what. Vercel Pro for "one hour before" reminders. Pro would also lift the 12-function limit.

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
| 4 Nov 2026 | Two-step sign-in for the coach area: required for owners, optional for coaches (to build). Search Console and Bing to be owned by warriorspirit@gmail.com |
| 4 Nov 2026 | A full FighterBase club-onboarding brief written for the FighterBase developer (Claude Doc "FighterBase club onboarding: brief and handover"): six required stages, optional modules, guides, and the "never empty" rule |

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

1. ~~Legal entity~~ Sole trader (4 Nov 2026). Still needed: the owner's full name as it should appear with the trading name.
2. Which Gmail account sends the site's emails (the one behind `SMTP_USER`)?
3. Is Google Search Console set up for the domain, and is Bing Webmaster Tools? Has the sitemap been submitted?
4. ~~Google Business Profile owner~~ Jay (4 Nov 2026); Hoddesdon left for now.
5. Which social accounts exist for Facebook and YouTube, and who holds the logins?
6. Does Jay own the `.com` domain, and should it redirect to the `.co.uk` site?
7. Have the coaches changed their starter passwords, and is two-step verification on for the accounts above?
8. Did the test enquiry arrive at warriorspirit@gmail.com?
9. Are the opening hours in the Google-readable business details correct?
10. Should any of the 10 AI pictures be replaced by real photos? (They are now labelled as illustrations.)
11. ~~Terms and accessibility wording~~ Confirmed by Steve on 4 Nov 2026; the photo opt-out is now built. Was: Please check the new terms and accessibility pages. Things I wrote without being told: members can ask to be left out of photos and videos; a coach can cancel a session and the customer is emailed; some videos have no captions; replies within 5 working days. Is each true?
12. ~~Whether the Photo library tile should be blue.~~ Settled 3 Nov 2026: one red Photos & videos tile (everyone uses it), with the owner tabs inside blue.
