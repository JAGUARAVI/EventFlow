<div align="center">
<h1>EventFlow</h1>
An in-house event-management system
<br>
<img src="logo.png" width="20%">
</div>

# The Problem Statement
The problem we are trying to takle is the lack of a centralized management system for the various events held in the campus. Many a times, the clubs have no option but to use third-party tools to implement leaderboards, voting systems, brackets etc. This makes the event and their functioning completely dependent on these third party services.

# Our Solution Approach
We henceforth put forward our solution to the aforementioned problem statement, **EventFlow**. EventFlow is a powerful in-house event management toolkit. This toolkit can prove helpful to all the clubs/societies planning to host a competitive or non-competitive event alike, with powerful built-in features such as brackets, polling, leaderboards and much more.

A live deployment of EventFlow can be visited [here!](https://eventflowiiit.netlify.app/)

# Tech Stack Used
- ReactJS + React Router (Framework)
- HeroUI + TailwindCSS (UI)
- Supabase (Backend)

# Key Features
- **Leaderboards:** All the teams are sorted in a leaderboard according to their current points, which can be changed via the leaderboard itself.
- **Voting:** Creation of public polls to receive votes from the participants.
- **Brackets:** A Brackets system to determine the flow of competition rounds between teams.
- **Announcements:** A dedicated section for any announcements related to the event.
- **Analytics:** A section to show a complete statistical analysis of the event's teams and participation. The data can be downloaded as a CSV.
- **Audit Log:** An audit log which logs all the additions/removals/changes made to the event. Certain changes can also be undone through the audit log.
- **Real Time Sync:** All changes made to the event are synced in real time across all clients without needing a page refresh.
- **Role Based Access Control:** Different roles with different access levels can be created.
- **Customizable Themes:** Multiple themes to choose from to customize the look and feel of the event page.
# Usage
1) Clone the git repository

```bash
git clone https://github.com/JAGUARAVI/EventFlow.git
```

2) Install Node dependencies

```bash
npm install
``` 

3) Make the .env file in the root folder. The format of the .env file is as follows:

```
VITE_SUPABASE_URL=[SUPABASE URL]
VITE_SUPABASE_PUBLIC_KEY=[SUPABASE PUBLIC KEY]
```
4) Create the necessary tables in Supabase. The SQL script to create the necessary tables can be found in the `/supabase` directory.

5) Run the development server

```
npm run dev
```

# Disclosure
Following are the tools which assisted us during the process of building EventFlow:

- **Microsoft Copilot:** Gemini 3 Pro, GPT-4.1, GPT-5-mini, Claude Opus 4.5, Claude Haiku 4.5
