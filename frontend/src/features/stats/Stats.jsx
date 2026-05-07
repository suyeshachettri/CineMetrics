import { useState } from 'react'
import { parseCSV, computeStats, computeYearlyAvg, computeDiaryStats } from '../../lib/parseCSV'
import { enrichFilms } from '../../lib/tmdb'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, LabelList } from 'recharts'

export default function Stats() {
  const [data, setData] = useState(null)
  const [diary, setDiary] = useState(null)
  const [watchedLog, setWatchedLog] = useState(null)
  const [diaryStats, setDiaryStats] = useState(null)
  const [enriched, setEnriched] = useState(null)
  const [tmdbDeep, setTmdbDeep] = useState(null)
  const [enriching, setEnriching] = useState(false)
  const [loadingDeep, setLoadingDeep] = useState(false)
  const [error, setError] = useState('')

  function handleRatings(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const films = parseCSV(ev.target.result)
        setData({ films, stats: computeStats(films) })
        setEnriched(null)
        setTmdbDeep(null)
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
        const films = parseCSV(ev.target.result)
        setDiary(films)
        setDiaryStats(computeDiaryStats(films))
        setError('')
      } catch { setError('Could not parse diary.csv') }
    }
    reader.readAsText(file)
  }

  function handleWatchedLog(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { setWatchedLog(parseCSV(ev.target.result)) }
      catch { setError('Could not parse watched.csv') }
    }
    reader.readAsText(file)
  }

  async function handleEnrich() {
    if (!data) return
    setEnriching(true)
    const result = await enrichFilms(data.films)
    setEnriched(result)
    setEnriching(false)
  }

  async function handleDeepTmdb() {
    if (!enriched) return
    setLoadingDeep(true)

    const withRuntime = enriched.filter(f => f.runtime)
    const avgRuntime = withRuntime.length
      ? Math.round(withRuntime.reduce((s, f) => s + f.runtime, 0) / withRuntime.length)
      : null

    const popularity = enriched.filter(f => f.popularity)
    const avgPopularity = popularity.length
      ? Math.round(popularity.reduce((s, f) => s + f.popularity, 0) / popularity.length)
      : null

    const mainstreamThreshold = 50
    const nichePercent = popularity.length
      ? Math.round(popularity.filter(f => f.popularity < mainstreamThreshold).length / popularity.length * 100)
      : null

    const countryCounts = {}
    enriched.forEach(f => {
      f.countries?.forEach(c => {
        countryCounts[c] = (countryCounts[c] || 0) + 1
      })
    })
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    const favEraPerGenre = {}
    const allGenres = [...new Set(enriched.flatMap(f => f.genres || []))]
    allGenres.forEach(genre => {
      const decadeCounts = {}
      enriched.forEach(f => {
        if (f.genres?.includes(genre)) {
          const y = parseInt(f.Year || f['Release Year'])
          if (y) {
            const d = Math.floor(y / 10) * 10 + 's'
            decadeCounts[d] = (decadeCounts[d] || 0) + 1
          }
        }
      })
      const top = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0]
      if (top) favEraPerGenre[genre] = top[0]
    })

    setTmdbDeep({ avgRuntime, avgPopularity, nichePercent, topCountries, favEraPerGenre })
    setLoadingDeep(false)
  }

  const s = data?.stats
  const distData = s
    ? Object.entries(s.dist).sort((a, b) => a[0] - b[0]).map(([r, c]) => ({ rating: r + '★', count: c }))
    : []

  const decadeData = s
    ? Object.entries(
        Object.entries(s.years).reduce((acc, [y, c]) => {
          const decade = Math.floor(parseInt(y) / 10) * 10 + 's'
          acc[decade] = (acc[decade] || 0) + c
          return acc
        }, {})
      ).sort((a, b) => a[0].localeCompare(b[0])).map(([decade, count]) => ({ decade, count }))
    : []

  const avgOverTime = data ? computeYearlyAvg(data.films) : []

  const genres = enriched
    ? Object.entries(enriched.reduce((acc, f) => {
        f.genres?.forEach(g => { acc[g] = (acc[g] || 0) + 1 })
        return acc
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
    : []

  const directors = enriched
    ? Object.entries(enriched.reduce((acc, f) => {
        if (f.director) acc[f.director] = (acc[f.director] || 0) + 1
        return acc
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
    : []

  const tooltip = { contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontSize: 12 } }

  const favEraEntries = tmdbDeep?.favEraPerGenre
    ? Object.entries(tmdbDeep.favEraPerGenre).sort((a, b) => a[0].localeCompare(b[0]))
    : []

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Stats</h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Your all-time film history. Export from Letterboxd → Settings → Data → Export Your Data.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>ratings.csv (required)</p>
          <input type="file" accept=".csv" onChange={handleRatings} />
        </div>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>diary.csv (watch history)</p>
          <input type="file" accept=".csv" onChange={handleDiary} />
        </div>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>watched.csv (accurate total)</p>
          <input type="file" accept=".csv" onChange={handleWatchedLog} />
          {watchedLog && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{watchedLog.length} total watched</p>}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Films watched</p>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{watchedLog ? watchedLog.length : s.total}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Films rated</p>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{s.rated}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Avg rating</p>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{s.avg} ★</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Unrated</p>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{watchedLog ? watchedLog.length - s.rated : s.unrated}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Extreme ratings</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#EF9F27' }}>{s.consistencyScore}%</p>
              <p className="muted" style={{ fontSize: 12 }}>of ratings are 1.5★ or below / 4.5★ or above</p>
            </div>
            {s.comfortZone && (
              <div className="card" style={{ textAlign: 'center' }}>
                <p className="muted">Most given rating</p>
                <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00c030' }}>{s.comfortZone[0]}★</p>
                <p className="muted" style={{ fontSize: 12 }}>given {s.comfortZone[1]} times</p>
              </div>
            )}
          </div>

          {diaryStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {diaryStats.mostProductiveYear && (
                <div className="card" style={{ textAlign: 'center' }}>
                  <p className="muted">Most productive year</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00c030' }}>{diaryStats.mostProductiveYear[0]}</p>
                  <p className="muted" style={{ fontSize: 12 }}>{diaryStats.mostProductiveYear[1]} films</p>
                </div>
              )}
              {diaryStats.mostProductiveMonth && (
                <div className="card" style={{ textAlign: 'center' }}>
                  <p className="muted">Busiest month ever</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7f77dd' }}>
                    {new Date(diaryStats.mostProductiveMonth[0] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  <p className="muted" style={{ fontSize: 12 }}>{diaryStats.mostProductiveMonth[1]} films</p>
                </div>
              )}
              {diaryStats.allTimeStreak > 0 && (
                <div className="card" style={{ textAlign: 'center' }}>
                  <p className="muted">All-time streak</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#EF9F27' }}>{diaryStats.allTimeStreak}</p>
                  <p className="muted" style={{ fontSize: 12 }}>consecutive days</p>
                </div>
              )}
            </div>
          )}

          {diaryStats?.watchingPace?.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Watching pace over the years</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={diaryStats.watchingPace}>
                  <XAxis dataKey="year" stroke="#666" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#666" />
                  <Tooltip {...tooltip} />
                  <Line type="monotone" dataKey="count" stroke="#d85a30" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {distData.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Ratings distribution</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distData}>
                  <XAxis dataKey="rating" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" fill="#00c030" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {decadeData.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Films by release decade</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={decadeData}>
                  <XAxis dataKey="decade" stroke="#666" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#666" />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" fill="#7f77dd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {avgOverTime.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Avg rating by release year</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={avgOverTime}>
                  <XAxis dataKey="year" stroke="#666" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#666" domain={[1, 5]} />
                  <Tooltip {...tooltip} />
                  <Line type="monotone" dataKey="avg" stroke="#00c030" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Top genres & directors</p>
            <p className="muted" style={{ marginBottom: '0.75rem', fontSize: 13 }}>
              Fetches metadata for your top 100 films from TMDb. Takes ~30 seconds.
            </p>
            <button onClick={handleEnrich} disabled={enriching}>
              {enriching ? 'Fetching from TMDb...' : enriched ? 'Reload genres & directors' : 'Load genres & directors'}
            </button>
          </div>

          {genres.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Top genres</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={genres} layout="vertical" margin={{ left: 90, right: 20, top: 0, bottom: 0 }}>
                    <XAxis type="number" stroke="#666" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#666" tick={{ fontSize: 11 }} width={85} />
                    <Tooltip {...tooltip} />
                    <Bar dataKey="count" fill="#00c030" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="count" position="right" style={{ fill: '#888', fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Top directors</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={directors} layout="vertical" margin={{ left: 130, right: 30, top: 0, bottom: 0 }}>
                    <XAxis type="number" stroke="#666" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#666" tick={{ fontSize: 11 }} width={125} tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                    <Tooltip {...tooltip} />
                    <Bar dataKey="count" fill="#7f77dd" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="count" position="right" style={{ fill: '#888', fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {enriched && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Deeper insights</p>
              <p className="muted" style={{ marginBottom: '0.75rem', fontSize: 13 }}>
                Avg runtime, niche vs mainstream taste, countries, favourite era per genre.
              </p>
              <button onClick={handleDeepTmdb} disabled={loadingDeep}>
                {loadingDeep ? 'Calculating...' : tmdbDeep ? 'Reload insights' : 'Load deeper insights'}
              </button>
            </div>
          )}

          {tmdbDeep && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {tmdbDeep.avgRuntime && (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="muted">Avg film runtime</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00c030' }}>{tmdbDeep.avgRuntime}m</p>
                    <p className="muted" style={{ fontSize: 12 }}>
                      {tmdbDeep.avgRuntime < 100 ? 'You like shorter films' : tmdbDeep.avgRuntime > 130 ? 'You like long films' : 'Right around average'}
                    </p>
                  </div>
                )}
                {tmdbDeep.nichePercent !== null && (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="muted">Niche taste</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#7f77dd' }}>{tmdbDeep.nichePercent}%</p>
                    <p className="muted" style={{ fontSize: 12 }}>of your films are under the radar</p>
                  </div>
                )}
                {tmdbDeep.avgPopularity !== null && (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="muted">Avg popularity</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#EF9F27' }}>{tmdbDeep.avgPopularity}</p>
                    <p className="muted" style={{ fontSize: 12 }}>TMDb popularity score</p>
                  </div>
                )}
              </div>

              {tmdbDeep.topCountries?.length > 0 && (
                <div className="card">
                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Most watched countries</p>
                  <p className="muted" style={{ fontSize: 13, marginBottom: '1rem' }}>Based on production country from TMDb</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={tmdbDeep.topCountries} layout="vertical" margin={{ left: 140, right: 30, top: 0, bottom: 0 }}>
                      <XAxis type="number" stroke="#666" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="#666" tick={{ fontSize: 11 }} width={135} tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                      <Tooltip {...tooltip} />
                      <Bar dataKey="count" fill="#d85a30" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="count" position="right" style={{ fill: '#888', fontSize: 11 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {favEraEntries.length > 0 && (
                <div className="card">
                  <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Favourite era per genre</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {favEraEntries.map(([genre, era]) => (
                      <div key={genre} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', background: '#111', borderRadius: 8 }}>
                        <span style={{ fontSize: 13 }}>{genre}</span>
                        <span style={{ fontSize: 13, color: '#7f77dd', fontWeight: 600 }}>{era}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}