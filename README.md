# Warrior Spirit Muay Thai website

**Read the [handbook](docs/HANDBOOK.md) first.** It holds the rules, what is built, and every decision. (Some notes below are older than the handbook; where they differ, the handbook wins.)

Static website for Warrior Spirit Muay Thai & Kickboxing, Potters Bar.

- `index.html` – the whole site (pages switch via `#page` links)
- `photos/`, `video/`, `img/` – images, clips and logo

Staging: the page has `noindex` set so search engines ignore it. Remove the
`<meta name="robots" ...>` line when the site goes live on its real domain.
