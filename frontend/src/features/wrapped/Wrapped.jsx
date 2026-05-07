import { useState, useRef } from 'react'
import { parseCSV, filterByYear } from '../../lib/parseCSV'
import { enrichFilms } from '../../lib/tmdb'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import WrappedCard from './WrappedCard'

function getDayOfWeek(dateStr) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[new Date(dateStr).getDay()]
}

function getStreak(dates) {
  if (!dates.length) return 0
  const sorted = [...new Set(dates)].sort()
  let maxStreak = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000
    if (diff === 1) { cur++; maxStreak = Math.max(maxStreak, cur) }
    else cur = 1
  }
  return maxStreak
}

export default function Wrapped() {
  const [allFilms, setAllFilms] = useState(null)
  const [diaryFilms, setDiaryFilms] = useState(null)
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [enriched, setEnriched] = useState(null)
  const [enriching, setEnriching] = useState(false)
  const [tmdbStats, setTmdbStats] = useState(null)
  const [loadingTmdb, setLoadingTmdb] = useState(false)
  const [error, setError] = useState('')
  const cardRef = useRef(null)
  const [showCard, setShowCard] = useState(false)

  function handleRatings(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        setAllFilms(parseCSV(ev.target.result))
        setEnriched(null)
        setTmdbStats(null)
        setError('')
      } catch { setError('Could not parse ratings.csv') }
    }
    reader.readAsText(file)
  }

  function handleDiary(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        setDiaryFilms(parseCSV(ev.target.result))
        setError('')
      } catch { setError('Could not parse diary.csv') }
    }
    reader.readAsText(file)
  }

  async function handleEnrich() {
    if (!watchedThisYear.length) return
    setEnriching(true)
    const result = await enrichFilms(watchedThisYear)
    setEnriched(result)
    setEnriching(false)
  }

  async function handleTmdbStats() {
    if (!watchedThisYear.length) return
    setLoadingTmdb(true)
    const ratedThisYear = watchedThisYear.filter(f => f.Rating)
    const results = await enrichFilms(ratedThisYear.slice(0, 50))

    const withDiff = results.filter(f => f.tmdbRating && f.Rating)
      .map(f => ({ ...f, diff: parseFloat(f.Rating) - f.tmdbRating }))

    const harshest = [...withDiff].sort((a, b) => a.diff - b.diff)[0]
    const controversial = [...withDiff].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0]
    const hiddenGem = [...withDiff]
      .filter(f => parseFloat(f.Rating) >= 4)
      .sort((a, b) => (a.popularity || 999) - (b.popularity || 999))[0]

    const totalMins = results.reduce((s, f) => s + (f.runtime || 0), 0)
    const avgUserRating = withDiff.length
      ? withDiff.reduce((s, f) => s + parseFloat(f.Rating), 0) / withDiff.length
      : 0
    const avgTmdb = withDiff.length
      ? withDiff.reduce((s, f) => s + f.tmdbRating, 0) / withDiff.length
      : 0
    const ratingPersonality = Math.round((avgUserRating - avgTmdb) * 100) / 100

    setTmdbStats({ harshest, controversial, hiddenGem, totalMins, ratingPersonality })
    setLoadingTmdb(false)
  }

  const watchedThisYear = diaryFilms ? filterByYear(diaryFilms, year) : []

  const monthData = watchedThisYear.length
    ? Object.entries(
        watchedThisYear.reduce((acc, f) => {
          const m = (f['Watched Date'] || f.Date || '').slice(5, 7)
          if (m) acc[m] = (acc[m] || 0) + 1
          return acc
        }, {})
      ).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }))
    : []

  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayData = watchedThisYear.length
    ? dayOrder.map(d => ({
        day: d,
        count: watchedThisYear.filter(f => getDayOfWeek(f['Watched Date'] || f.Date) === d).length
      }))
    : []

  const ratedThisYear = watchedThisYear.filter(f => f.Rating)
  const avg = ratedThisYear.length
    ? Math.round(ratedThisYear.reduce((s, f) => s + parseFloat(f.Rating), 0) / ratedThisYear.length * 100) / 100
    : 0

  const top5 = [...ratedThisYear].sort((a, b) => parseFloat(b.Rating) - parseFloat(a.Rating)).slice(0, 5)

  const decades = {}
  watchedThisYear.forEach(f => {
    const y = parseInt(f.Year || f['Release Year'])
    if (y) { const d = Math.floor(y / 10) * 10 + 's'; decades[d] = (decades[d] || 0) + 1 }
  })
  const topDecade = Object.entries(decades).sort((a, b) => b[1] - a[1])[0]

  const dates = watchedThisYear.map(f => f['Watched Date'] || f.Date).filter(Boolean)
  const streak = getStreak(dates)
  const sortedDates = [...dates].sort()
  const firstFilm = watchedThisYear.find(f => (f['Watched Date'] || f.Date) === sortedDates[0])
  const lastFilm = watchedThisYear.find(f => (f['Watched Date'] || f.Date) === sortedDates[sortedDates.length - 1])

  const rewatched = watchedThisYear.reduce((acc, f) => {
    const name = f.Name || f.Title
    if (name) acc[name] = (acc[name] || 0) + 1
    return acc
  }, {})
  const mostRewatched = Object.entries(rewatched).sort((a, b) => b[1] - a[1]).find(([, c]) => c > 1)

  const genres = enriched
    ? Object.entries(enriched.reduce((acc, f) => {
        f.genres?.forEach(g => { acc[g] = (acc[g] || 0) + 1 })
        return acc
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
    : []

  const topDirector = enriched
    ? Object.entries(enriched.reduce((acc, f) => {
        if (f.director) acc[f.director] = (acc[f.director] || 0) + 1
        return acc
      }, {})).sort((a, b) => b[1] - a[1])[0]
    : null

  const tooltip = { contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontSize: 12 } }

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Wrapped</h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Your year in film. Export from Letterboxd → Settings → Data → Export Your Data.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>ratings.csv</p>
          <input type="file" accept=".csv" onChange={handleRatings} />
        </div>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>diary.csv</p>
          <input type="file" accept=".csv" onChange={handleDiary} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <p style={{ fontSize: 13, color: '#888' }}>Year:</p>
        <select
          value={year}
          onChange={e => { setYear(e.target.value); setEnriched(null); setTmdbStats(null) }}
          style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#e8e8e8', padding: '0.4rem 0.75rem', fontSize: '0.95rem' }}
        >
          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {diaryFilms && watchedThisYear.length === 0 && (
        <p className="muted">No films found for {year}. Try a different year.</p>
      )}

      {watchedThisYear.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} ref={cardRef}>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowCard(true)}
             style={{ background: 'transparent', border: '1px solid #00c030', color: '#00c030', borderRadius: 8, padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
            Share card
          </button>
        </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Watched in {year}</p>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{watchedThisYear.length}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Avg rating</p>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{avg} ★</p>
            </div>
            {topDecade && (
              <div className="card" style={{ textAlign: 'center' }}>
                <p className="muted">Fav decade</p>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#00c030' }}>{topDecade[0]}</p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Longest streak</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: '#EF9F27' }}>{streak}</p>
              <p className="muted" style={{ fontSize: 12 }}>consecutive days</p>
            </div>
            <div className="card">
              <p className="muted" style={{ fontSize: 13 }}>First film of {year}</p>
              <p style={{ fontWeight: 600, marginTop: 4 }}>{firstFilm?.Name || firstFilm?.Title || '—'}</p>
              <p className="muted" style={{ fontSize: 12 }}>{sortedDates[0]}</p>
            </div>
            <div className="card">
              <p className="muted" style={{ fontSize: 13 }}>Last film of {year}</p>
              <p style={{ fontWeight: 600, marginTop: 4 }}>{lastFilm?.Name || lastFilm?.Title || '—'}</p>
              <p className="muted" style={{ fontSize: 12 }}>{sortedDates[sortedDates.length - 1]}</p>
            </div>
          </div>

          {mostRewatched && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Most rewatched</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>{mostRewatched[0]}</p>
              <p className="muted" style={{ fontSize: 13 }}>watched {mostRewatched[1]} times</p>
            </div>
          )}

          {monthData.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Films watched by month</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthData}>
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" fill="#d85a30" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {dayData.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Busiest day of the week</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dayData}>
                  <XAxis dataKey="day" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" fill="#7f77dd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {top5.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Top 5 films of {year}</p>
              {top5.map((f, i) => (
                <div key={f.Name || f.Title} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #222' }}>
                  <span>{i + 1}. {f.Name || f.Title}</span>
                  <span className="muted">{f.Rating} ★</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Top genre & director of {year}</p>
            <p className="muted" style={{ marginBottom: '0.75rem', fontSize: 13 }}>
              Fetches metadata for films you watched in {year} from TMDb.
            </p>
            <button onClick={handleEnrich} disabled={enriching}>
              {enriching ? 'Fetching...' : enriched ? 'Reload genre & director' : 'Load genre & director'}
            </button>
          </div>

          {genres.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Top genres of {year}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={genres} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <XAxis type="number" stroke="#666" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#666" tick={{ fontSize: 11 }} width={75} />
                    <Tooltip {...tooltip} />
                    <Bar dataKey="count" fill="#00c030" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {topDirector && (
                <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p className="muted">Most watched director</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7f77dd', marginTop: '0.5rem' }}>{topDirector[0]}</p>
                  <p className="muted" style={{ marginTop: '0.25rem' }}>{topDirector[1]} films</p>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Deeper insights</p>
            <p className="muted" style={{ marginBottom: '0.75rem', fontSize: 13 }}>
              Hidden gem, rating personality, most controversial take, total hours watched. Fetches from TMDb.
            </p>
            <button onClick={handleTmdbStats} disabled={loadingTmdb}>
              {loadingTmdb ? 'Fetching...' : tmdbStats ? 'Reload insights' : 'Load deeper insights'}
            </button>
          </div>

          {tmdbStats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <p className="muted">Total hours watched</p>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: '#00c030' }}>
                    {Math.round(tmdbStats.totalMins / 60)}h
                  </p>
                  <p className="muted" style={{ fontSize: 12 }}>{tmdbStats.totalMins} minutes</p>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <p className="muted">Rating personality</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: tmdbStats.ratingPersonality > 0 ? '#00c030' : '#E24B4A', marginTop: 4 }}>
                    {tmdbStats.ratingPersonality > 0.2 ? 'Generous rater' : tmdbStats.ratingPersonality < -0.2 ? 'Harsh critic' : 'Right on average'}
                  </p>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    You rate {Math.abs(tmdbStats.ratingPersonality).toFixed(2)}★ {tmdbStats.ratingPersonality > 0 ? 'above' : 'below'} TMDb avg
                  </p>
                </div>
              </div>

              {tmdbStats.hiddenGem && (
                <div className="card" style={{ textAlign: 'center' }}>
                  <p className="muted">Hidden gem of {year}</p>
                  <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#EF9F27', marginTop: 4 }}>
                    {tmdbStats.hiddenGem.Name || tmdbStats.hiddenGem.Title}
                  </p>
                  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    You rated it {tmdbStats.hiddenGem.Rating}★ — not many people have seen it
                  </p>
                </div>
              )}

              {tmdbStats.controversial && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="card">
                    <p className="muted" style={{ fontSize: 13 }}>Most controversial take</p>
                    <p style={{ fontWeight: 600, marginTop: 4 }}>{tmdbStats.controversial.Name || tmdbStats.controversial.Title}</p>
                    <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      You: {tmdbStats.controversial.Rating}★ · TMDb: {tmdbStats.controversial.tmdbRating?.toFixed(1)}★
                    </p>
                  </div>
                  <div className="card">
                    <p className="muted" style={{ fontSize: 13 }}>Harshest rating</p>
                    <p style={{ fontWeight: 600, marginTop: 4 }}>{tmdbStats.harshest?.Name || tmdbStats.harshest?.Title}</p>
                    <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      You: {tmdbStats.harshest?.Rating}★ · TMDb: {tmdbStats.harshest?.tmdbRating?.toFixed(1)}★
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {showCard && (
              <WrappedCard
                year={year}
                onClose={() => setShowCard(false)}
                data={{
                  watched: watchedThisYear.length,
                  avg,
                  topDecade: topDecade?.[0],
                  streak,
                  top5,
                  topGenre: genres[0]?.name,
                  topDirector: topDirector?.[0],
                  hiddenGem: tmdbStats?.hiddenGem,
                  ratingPersonality: tmdbStats?.ratingPersonality,
                  totalHours: tmdbStats ? Math.round(tmdbStats.totalMins / 60) : 0,
                }}
              />
            )}

        </div>
      )}
    </div>
  )
}