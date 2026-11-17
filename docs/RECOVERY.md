# Recovery plan: Warrior Spirit Muay Thai website (Agent Rules 3f, A-069)

Written 16 Nov 2026 by the Warrior Spirit website agent. Short and practical: someone who has never seen the site should be able to follow it. No passwords or keys here. **Honest status (17 Nov): the nightly off-site copy and the action log are built on branches but not live yet, and there has been no restore test.** The plan to close each gap is at the end.

## What we hold and where
| Data | Where it lives | Backups (where, how often, kept how long) | Off-site copy | Last restore test |
|---|---|---|---|---|
| Website code and pages | GitHub `yourhousewash-code/Warrior-Spirit-Muay-Thai` (every change, full history) | Git history; every deploy on Vercel can be put back ("Instant Rollback") | Any clone of the repo (this session, Steve's PC) | Not needed: a redeploy is the restore |
| Members (name, email, mobile, password in scrambled form, photo choice), PT and class bookings, enquiries, coach accounts and sign-in state, timetable, prices, opening hours, site wording, photo library list, calendar links | Upstash Redis, linked through Vercel (team `saunders-projects1`) | **To check in the Upstash console with Steve:** whether this database's plan keeps daily backups, and for how long | **None** | **None** |
| Photos and videos shown on the site | Vercel Blob (same Vercel team), as resized copies | None on Vercel's side | Originals: coaches' uploads go to the "Warrior Spirit Uploads" folder in Google Drive; the site's own starting photos are in the repo (`photos/`, `img/`) | None |
| Emails the site sent (bookings, reminders, enquiries) | The club's Gmail account (sent folder) | Google's | — | — |
| Keys and settings (SESSION_SECRET, Upstash, Gmail app password, Google sign-in, Drive, later Turnstile) | Vercel project settings, Environment Variables | — | Not copied anywhere (on purpose) | — |
| Domain warriorspiritmuaythai.co.uk | names.co.uk (Steve's login); DNS points at Vercel | — | — | — |

Short-lived data (rate-limit counts, sign-in and reset links, two-step codes) expires on its own within an hour or a day and doesn't need backing up.

## The action log
**Built 17 Nov 2026 on branch `action-log`, not live yet** (Two-AI check first). Redis has no database triggers, so the website's own code writes it: every write command goes to the database together with one log line, in the same trip (`api/_lib/actionlog.js`). Each line says who (`coach:<id>`, `member:<email>`, `visitor` or `system:daily job`), through which part of the site (`pt:book`, `auth:profile`...), the command and the record, what the changed part was before and what it became, when, and the connection's IP address. One list a month (`audit:YYYY-MM`), kept 400 days, and the nightly copy takes it off-site. Nothing in the code deletes from it (a test checks). Never logged: passwords (even scrambled), two-step secrets and codes, sign-in, reset and calendar links, the Google Drive key, rate limits and locks. It can't see edits made directly in the Upstash console, so the rule is: **no direct console edits to live data** (section 3f, "our own hands").

To read it: `node tools/action-log.mjs` with the database settings in the environment (read-only; `--who`, `--key`, `--since`, `--month`, `--json` for before and after). To put a record back: copy its "before" from the log (or the nightly copy) through a logged admin action or a reviewed script, with Steve's yes.

## How much we could lose
- **Data, today:** possibly everything in the database since the site started (accounts, bookings, enquiries, site wording edits), if the Upstash database were lost and its plan has no backups. With the nightly copy in the plan below: up to 24 hours of changes.
- **Time:** the code and pages are back within minutes (redeploy or rollback). The database: with a nightly copy, about 1 hour to restore into a fresh database and update two settings in Vercel.

## When something goes wrong
1. **A bad publish (the site breaks).** Notice: Turbo's hourly check (once Turbo watches the site), Steve, Jay or a member. First: in Vercel, Deployments, promote the previous good deployment (Instant Rollback), or `git revert` the commit and push. Put right: fix on a branch, tests, publish again with Steve's yes. Decides: Steve. Tell: nobody, if fixed within the hour.
2. **A bad database change.** This site has no migrations; data shapes change in code. Notice: errors in Vercel's logs, a page or the coach area not loading. First: roll back the publish. Put right: repair the affected records with a logged, reviewed script (Steve's yes), or restore from the nightly copy. Decides: Steve.
3. **A record wrongly changed or deleted** (by a coach, a member, the reminder job or an AI agent). Notice: Jay or a member. First: stop whoever or whatever is doing it (coach account off, job paused). Put right: find the change with `tools/action-log.mjs` (who, when, before and after), then put the "before" back through a logged admin action, or from the nightly copy. Decides: Steve and Jay.
4. **An owner, admin or coach account taken over.** Notice: the "your email changed" warning email, the trusted-devices list, or Jay. First: "Sign out everywhere" and a new password for that coach (owners can change a coach's password; Steve can reset an owner through the reset email). Two-step sign-in is required for owners. Put right: check the action log and enquiries for changes made. Tell: Alfred and Steve at once.
5. **A key or password leaked.** First: replace it in Vercel's settings (for SESSION_SECRET this signs everyone out, which is fine), then redeploy. Gmail app password: revoke in the Google account and make a new one. Tell: Alfred and Steve at once.
6. **A host is down** (Vercel, Upstash, Gmail, Google). Notice: Turbo's check, the host's status page. First: put a short notice on the club's social accounts if it lasts; enquiries by phone and WhatsApp still work. Put right: wait for the host; nothing to restore unless data was lost.
7. **Payments and our records disagree.** Not applicable: the site takes and records no money (PT is paid at the gym). After the FighterBase switch-over, payments live in FighterBase.
8. **The domain or DNS is lost or changed.** Notice: the site stops loading at its address while the vercel.app address still answers. First: Steve logs in at names.co.uk; check the registration hasn't expired and the DNS still points at Vercel. Moving the domain to the SRS Cloudflare account (WS-003) adds a second pair of eyes.
9. **Personal data exposed.** Contain it (take the page or feature down, rotate keys), tell Alfred and Steve at once; Steve decides on the ICO report (within 72 hours) and telling the people affected. The club (Jay) is responsible for its members' data; SRS runs the site for it.

## Who to contact
- Vercel: dashboard and vercel.com status page; support through the dashboard (Hobby plan: community support).
- Upstash: console and status page (status.upstash.com).
- GitHub: githubstatus.com.
- Google (Gmail, Drive, sign-in): Google Workspace status dashboard.
- names.co.uk: Steve's account and their support line.
- The club: Jay, 07904 032142.

## Plan to close the gaps (dated; built on branches or the test database first; nothing that costs money or touches live data without Steve's yes)
| Gap (3f) | What we'll do | When | Needs |
|---|---|---|---|
| Off-site copy of the database | **Built 16 Nov** (branch `nightly-backup`, 695f9a9; tested: export, encrypt, restore into a second database, compare): every lasting key, encrypted with `BACKUP_KEY`, one file a night in a "Warrior Spirit Backups" Drive folder, 30 days kept, run by the existing morning job. Restore: `tools/restore-backup.mjs` | Off until published and `BACKUP_KEY` set | Steve's yes to publish and to set the key (also kept in his password manager) |
| Restore tested | Restore the latest export into a test database and check counts and a few records; then every 3 months | First drill by 23 Nov | A free test Upstash database (Steve's yes: new database) |
| Host's own backups | Check the Upstash plan's backup setting with Steve; turn on daily backups if the plan has them | Next live session with Steve | Steve's login; cost only if a paid plan is needed (his yes) |
| Action log | **Built 17 Nov** (branch `action-log`; tested: sign-up, a member's change, a coach's change, a deletion, secrets left out, 400-day keep): add-only, who, before and after, when, from where; the nightly copy takes it off-site; no console edits to live data | Live with the next release | Two-AI check before it goes live; a privacy-page line (Jay or Steve's OK) |
| Two-step sign-in on hosting accounts | Confirm two-step on Vercel, GitHub, Upstash, Google and names.co.uk (handbook row "Two-step verification on every account": partly) | Next live session with Steve | Steve |
| Photos | Originals are already in Drive for coach uploads; check the site's resized copies can be re-made from Drive | With the first restore drill | — |
| Less to protect | After the FighterBase switch-over, member accounts and bookings move to FighterBase (which has database triggers and its own backups); the site keeps enquiries, kids bookings until their switch, site content and coach accounts | With the switch-over (first half of December at the earliest) | Steve's go |

## Restore drills
| Date | What was restored | How long it took | Problems found | Fixed |
|---|---|---|---|---|
| — | None yet | — | — | — |
