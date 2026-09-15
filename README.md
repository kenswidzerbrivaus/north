# North

A local-first productivity workspace: tasks, calendar, habits, a focus timer, notes, goals, and a daily journal.

Live now: [https://kenswidzerbrivaus.github.io](https://kenswidzerbrivaus.github.io)

Custom domain: [https://kenswidzerbrivaus.com](https://kenswidzerbrivaus.com) (point DNS in Hostinger — see below)

## Point the domain (Hostinger)

The domain is registered at Hostinger and currently parked. GitHub Pages is already waiting for it.

1. Open [hPanel → Domains](https://hpanel.hostinger.com/domains)
2. Click **kenswidzerbrivaus.com** → **DNS / DNS Zone Editor**
3. Delete the A record that points to `2.57.91.91` (parking)
4. Add these records:

| Type | Name | Points to |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `kenswidzerbrivaus.github.io` |

5. Save. HTTPS on the custom domain usually finishes within an hour after DNS updates.

Data stays in your browser (`localStorage`). Export a backup from Settings whenever you want a copy.

## Run

```bash
cd north
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## What’s inside

- **Today** — due work, habits, agenda, intention, and a focus ring
- **Tasks** — lists, priorities, due dates, subtasks
- **Calendar** — month, week, and day views
- **Habits** — streaks, weekday schedules, heatmap
- **Focus** — pomodoro timer with session history
- **Notes, Goals, Journal**
- **⌘K** command palette, `1–9` to jump sections

## Stack

Vite, React, TypeScript. No account, no server.
