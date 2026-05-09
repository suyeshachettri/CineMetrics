# CineMetrics

A Letterboxd companion app that gives you deep insights into your film watching habits. Upload your Letterboxd data export and get stats, recommendations, watchlist rankings, year in review, and taste compatibility with friends.

![BoxOfficd](https://img.shields.io/badge/built%20with-React-61dafb?style=flat-square&logo=react) ![TMDb](https://img.shields.io/badge/powered%20by-TMDb-01d277?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

### Stats
Upload your `ratings.csv` and `diary.csv` to get a full breakdown of your all-time film history:
- Total films watched, rated, and unrated
- Ratings distribution and average rating
- Films and average rating by release decade 
- Watching pace over the years and all-time longest streak
- Most productive year and busiest month ever
- Top genres and directors (via TMDb)
- Deeper insights — avg runtime, niche vs mainstream taste, most watched countries, favourite era per genre

### Blend
Upload two `ratings.csv` files to see how compatible your film taste is with a friend:
- Compatibility score with a personality label (e.g. "The Horror Duo")
- Side-by-side genre taste comparison
- Films you'd agree on vs disagree on
- Shared directors you both love
- Each person's top 5 films
- A "watch together" list of films one loved that the other hasn't seen

### Recs
Upload your `ratings.csv` and `watched.csv` to get personalised film recommendations:
- Analyses your top rated films to build a taste profile
- Discovers unseen films from TMDb filtered by your top genres
- Scores and ranks recommendations by predicted enjoyment
- Filter by genre
- "Because you love X" reasons for each recommendation

### Watchlist
Upload your `ratings.csv`, `watchlist.csv`, and optionally `watched.csv` to rank your watchlist:
- Scores each film by how much you'd probably enjoy it based on your taste profile
- Sort by best match, TMDb rating, runtime, or release year
- Filter by genre
- Watchlist health stats — total runtime, genre breakdown, avg TMDb rating
- Mark films as watched to track progress

### Wrapped
Upload your `ratings.csv` and `diary.csv` to get a year in review:
- Films watched, avg rating, favourite decade
- Longest watching streak, first and last film of the year
- Most rewatched film
- Films watched by month and busiest day of the week
- Top 5 films of the year
- Top genre and most watched director (via TMDb)
- Deeper insights — total hours watched, hidden gem, rating personality, most controversial take
- Shareable card you can download as a PNG

---

## Getting started

### What you need

- A [Letterboxd](https://letterboxd.com) account
- A free [TMDb API key](https://www.themoviedb.org/settings/api)
- [Node.js](https://nodejs.org) v18+

### Export your Letterboxd data

1. Go to letterboxd.com → Settings → Data → Export Your Data
2. Download and unzip the file
3. You'll find these CSV files inside:
   - `ratings.csv` — films you've rated
   - `diary.csv` — your watch diary with dates
   - `watchlist.csv` — your saved watchlist
   - `watched.csv` — all films you've marked as watched

### Run locally

```bash
# Clone the repo
git clone https://github.com/suyeshachettri/CineMetrics
cd boxofficd/frontend

# Install dependencies
npm install

# Add your TMDb API key
# Open src/lib/tmdb.js and replace 'your_actual_tmdb_key_here' with your key

# Start the app
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Charts | Recharts |
| Film metadata | TMDb API |
| Data source | Letterboxd CSV export |
| Hosting | GitHub Pages |

---

## Project structure

```
boxofficd/
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── stats/          # Stats dashboard
│   │   │   ├── blend/          # Taste compatibility
│   │   │   ├── recs/           # Recommendations
│   │   │   ├── wrapped/        # Year in review
│   │   │   └── watchlist/      # Watchlist analyser
│   │   ├── lib/
│   │   │   ├── parseCSV.js     # CSV parsing + stat functions
│   │   │   └── tmdb.js         # TMDb API wrapper
│   │   ├── App.jsx
│   │   └── index.css
│   └── package.json
└── README.md
```

---

## Privacy

All data processing happens in your browser. Your CSV files are never uploaded to any server. The only external requests are to the TMDb API to fetch film metadata.

---

## Acknowledgements

- Film data powered by [TMDb](https://www.themoviedb.org)
- Watch history data from [Letterboxd](https://letterboxd.com)
- This product uses the TMDb API but is not endorsed or certified by TMDb

---

## License

MIT