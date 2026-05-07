import { useState } from 'react'
import { parseCSV } from '../../lib/parseCSV'
import { enrichFilms, searchMovie, getMovieDetail } from '../../lib/tmdb'

async function enrichWatchlist(films) {
  const enriched = []
  for (const film of films.slice(0, 100)) {
    const name = film.Name || film.Title
    const year = film.Year || film['Release Year']
    const movie = await searchMovie(name, year)
    if (movie) {
      const detail = await getMovieDetail(movie.id)
      enriched.push({
        ...film,
        tmdbId: movie.id,
        tmdbRating: movie.vote_average / 2,
        popularity: movie.popularity,
        runtime: detail?.runtime || null,
        genres: detail?.genres?.map(g => g.name) || [],
        director: detail?.credits?.crew?.find(c => c.job === 'Director')?.name || null,
        overview: detail?.overview || '',
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : null,
      })
    } else {
      enriched.push({ ...film, genres: [], director: null, runtime: null, tmdbRating: null, popularity: null, overview: '', poster: null })
    }
  }
  return enriched
}

function scoreFn(film, tasteProfile) {
  let score = 0
  let reasons = []

  film.genres?.forEach(g => {
    if (tasteProfile.genres[g]) {
      score += tasteProfile.genres[g].avg * tasteProfile.genres[g].count * 0.1
      if (tasteProfile.genres[g].avg >= 3.5) reasons.push(`you love ${g}`)
    }
  })

  if (film.director && tasteProfile.directors[film.director]) {
    const d = tasteProfile.directors[film.director]
    score += d.avg * d.count * 0.2
    reasons.push(`you rate ${film.director} ${d.avg.toFixed(1)}★ avg`)
  }

  const y = parseInt(film.Year || film['Release Year'])
  if (y) {
    const decade = Math.floor(y / 10) * 10 + 's'
    if (tasteProfile.decades[decade]) {
      score += tasteProfile.decades[decade].avg * 0.05
      if (tasteProfile.decades[decade].avg >= 3.5) reasons.push(`you enjoy ${decade} films`)
    }
  }

  return { score: Math.round(score * 10) / 10, reasons: [...new Set(reasons)].slice(0, 2) }
}

function buildTasteProfile(ratedFilms, enrichedRated) {
  const genres = {}
  const directors = {}
  const decades = {}

  enrichedRated.forEach(f => {
    const rating = parseFloat(f.Rating)
    if (!rating) return

    f.genres?.forEach(g => {
      if (!genres[g]) genres[g] = { sum: 0, count: 0 }
      genres[g].sum += rating
      genres[g].count++
    })

    if (f.director) {
      if (!directors[f.director]) directors[f.director] = { sum: 0, count: 0 }
      directors[f.director].sum += rating
      directors[f.director].count++
    }

    const y = parseInt(f.Year || f['Release Year'])
    if (y) {
      const decade = Math.floor(y / 10) * 10 + 's'
      if (!decades[decade]) decades[decade] = { sum: 0, count: 0 }
      decades[decade].sum += rating
      decades[decade].count++
    }
  })

  const avg = obj => Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, { avg: Math.round(v.sum / v.count * 100) / 100, count: v.count }])
  )

  return { genres: avg(genres), directors: avg(directors), decades: avg(decades) }
}

const SORT_OPTIONS = [
  { value: 'score', label: 'Best match' },
  { value: 'tmdb', label: 'TMDb rating' },
  { value: 'runtime_asc', label: 'Shortest first' },
  { value: 'runtime_desc', label: 'Longest first' },
  { value: 'year_desc', label: 'Newest first' },
  { value: 'year_asc', label: 'Oldest first' },
]

function sortFilms(films, sortBy) {
  const sorted = [...films]
  switch (sortBy) {
    case 'tmdb': return sorted.sort((a, b) => (b.tmdbRating || 0) - (a.tmdbRating || 0))
    case 'runtime_asc': return sorted.sort((a, b) => (a.runtime || 999) - (b.runtime || 999))
    case 'runtime_desc': return sorted.sort((a, b) => (b.runtime || 0) - (a.runtime || 0))
    case 'year_desc': return sorted.sort((a, b) => parseInt(b.Year || b['Release Year'] || 0) - parseInt(a.Year || a['Release Year'] || 0))
    case 'year_asc': return sorted.sort((a, b) => parseInt(a.Year || a['Release Year'] || 0) - parseInt(b.Year || b['Release Year'] || 0))
    default: return sorted.sort((a, b) => b.score - a.score)
  }
}

export default function Watchlist() {
  const [ratings, setRatings] = useState(null)
  const [watchlist, setWatchlist] = useState(null)
  const [watchedLog, setWatchedLog] = useState(null)
  const [scored, setScored] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('score')
  const [watched, setWatched] = useState(new Set())
  const [showWatched, setShowWatched] = useState(false)
  const [error, setError] = useState('')

  function handleRatings(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { setRatings(parseCSV(ev.target.result)); setScored(null); setError('') }
      catch { setError('Could not parse ratings.csv') }
    }
    reader.readAsText(file)
  }

  function handleWatchlist(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { setWatchlist(parseCSV(ev.target.result)); setScored(null); setError('') }
      catch { setError('Could not parse watchlist.csv') }
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

  async function analyse() {
    if (!ratings || !watchlist) return
    setLoading(true)
    setWatched(new Set())

    setProgress('Fetching metadata for your rated films...')
    const ratedFilms = ratings.filter(f => f.Rating)
    const enrichedRated = await enrichFilms(ratedFilms.slice(0, 80))

    setProgress('Building your taste profile...')
    const tasteProfile = buildTasteProfile(ratedFilms, enrichedRated)

    setProgress('Filtering already watched films...')
    const seenTitles = new Set([
      ...(ratings || []).map(f => (f.Name || f.Title || '').toLowerCase()),
      ...(watchedLog || []).map(f => (f.Name || f.Title || '').toLowerCase()),
    ])
    const unseenWatchlist = watchlist.filter(f => !seenTitles.has((f.Name || f.Title || '').toLowerCase()))

    setProgress(`Fetching metadata for ${unseenWatchlist.length} unseen watchlist films...`)
    const enrichedWatchlist = await enrichWatchlist(unseenWatchlist)

    setProgress('Scoring films...')
    const result = enrichedWatchlist.map(film => ({
      ...film,
      ...scoreFn(film, tasteProfile),
    })).sort((a, b) => b.score - a.score)

    setScored(result)
    setProgress('')
    setLoading(false)
  }

  function toggleWatched(title) {
    setWatched(prev => {
      const next = new Set(prev)
      next.has(title) ? next.delete(title) : next.add(title)
      return next
    })
  }

  const genres = scored ? [...new Set(scored.flatMap(f => f.genres || []))].sort() : []
  const unwatched = scored ? scored.filter(f => !watched.has(f.Name || f.Title)) : []
  const watchedFilms = scored ? scored.filter(f => watched.has(f.Name || f.Title)) : []
  const filtered = unwatched.filter(f => filter === 'all' || f.genres?.includes(filter))
  const sortedFilms = sortFilms(filtered, sortBy)

  const totalRuntime = scored ? scored.reduce((s, f) => s + (f.runtime || 90), 0) : 0
  const genreCounts = scored
    ? Object.entries(scored.reduce((acc, f) => {
        f.genres?.forEach(g => { acc[g] = (acc[g] || 0) + 1 })
        return acc
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : []
  const avgTmdb = scored?.filter(f => f.tmdbRating).length
    ? Math.round(scored.filter(f => f.tmdbRating).reduce((s, f) => s + f.tmdbRating, 0) / scored.filter(f => f.tmdbRating).length * 100) / 100
    : null

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Watchlist</h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Ranks your watchlist by how much you'll probably enjoy each film, based on your taste profile.
        Export from Letterboxd → Settings → Data → Export Your Data.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>ratings.csv (your taste)</p>
          <input type="file" accept=".csv" onChange={handleRatings} />
          {ratings && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{ratings.filter(f => f.Rating).length} rated films loaded</p>}
        </div>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>watchlist.csv</p>
          <input type="file" accept=".csv" onChange={handleWatchlist} />
          {watchlist && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{watchlist.length} films in watchlist</p>}
        </div>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>watched.csv (optional)</p>
          <input type="file" accept=".csv" onChange={handleWatchedLog} />
          {watchedLog && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{watchedLog.length} watched films loaded</p>}
        </div>
      </div>

      <button onClick={analyse} disabled={!ratings || !watchlist || loading}>
        {loading ? progress || 'Analysing...' : scored ? 'Re-analyse' : 'Analyse watchlist'}
      </button>

      {error && <p className="error">{error}</p>}

      {scored && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Total films</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{scored.length}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Total runtime</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{Math.round(totalRuntime / 60)}h</p>
              <p className="muted" style={{ fontSize: 11 }}>{Math.round(totalRuntime / 60 / 24)} days</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Watched</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00c030' }}>{watched.size}</p>
              <p className="muted" style={{ fontSize: 11 }}>{scored.length - watched.size} remaining</p>
            </div>
            {avgTmdb && (
              <div className="card" style={{ textAlign: 'center' }}>
                <p className="muted">Avg TMDb rating</p>
                <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{avgTmdb}★</p>
              </div>
            )}
          </div>

          {genreCounts.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Watchlist breakdown by genre</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {genreCounts.map(([g, c]) => (
                  <div key={g} style={{ background: '#111', borderRadius: 8, padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{g}</p>
                    <p className="muted" style={{ fontSize: 11 }}>{c} films</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ textAlign: 'center', background: '#0d1a0d', border: '1px solid #1a3a1a' }}>
            <p style={{ color: '#00c030', fontSize: 13, marginBottom: 4 }}>Top pick for you</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 700 }}>{scored[0]?.Name || scored[0]?.Title}</p>
            {scored[0]?.reasons?.length > 0 && (
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Because {scored[0].reasons.join(' · ')}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#e8e8e8', padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setFilter('all')}
                style={{ background: filter === 'all' ? '#00c030' : 'transparent', color: filter === 'all' ? '#000' : '#888', border: '1px solid #333', borderRadius: 20, padding: '0.3rem 0.9rem', fontSize: 12, cursor: 'pointer' }}
              >
                All
              </button>
              {genres.map(g => (
                <button
                  key={g}
                  onClick={() => setFilter(g)}
                  style={{ background: filter === g ? '#00c030' : 'transparent', color: filter === g ? '#000' : '#888', border: '1px solid #333', borderRadius: 20, padding: '0.3rem 0.9rem', fontSize: 12, cursor: 'pointer' }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedFilms.map((film, i) => {
              const title = film.Name || film.Title
              const isWatched = watched.has(title)
              return (
                <div key={title} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', opacity: isWatched ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#333', minWidth: 28, paddingTop: 4 }}>
                    {i + 1}
                  </div>
                  {film.poster && (
                    <img src={film.poster} alt={title} style={{ width: 46, height: 69, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <p style={{ fontWeight: 600, fontSize: 15 }}>{title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ color: '#00c030', fontWeight: 700, fontSize: 14 }}>{film.score > 0 ? `${film.score} pts` : '—'}</p>
                          {film.tmdbRating && <p className="muted" style={{ fontSize: 11 }}>TMDb {film.tmdbRating.toFixed(1)}★</p>}
                        </div>
                        <button
                          onClick={() => toggleWatched(title)}
                          title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                          style={{ background: isWatched ? '#00c030' : 'transparent', border: '1px solid #333', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: isWatched ? '#000' : '#555', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.3rem 0' }}>
                      {film.genres?.slice(0, 3).map(g => (
                        <span key={g} style={{ fontSize: 11, padding: '2px 8px', background: '#222', borderRadius: 20, color: '#888' }}>{g}</span>
                      ))}
                      {film.runtime && <span style={{ fontSize: 11, padding: '2px 8px', background: '#222', borderRadius: 20, color: '#888' }}>{film.runtime}m</span>}
                      {film.director && <span style={{ fontSize: 11, padding: '2px 8px', background: '#222', borderRadius: 20, color: '#888' }}>{film.director}</span>}
                    </div>
                    {film.reasons?.length > 0 && (
                      <p style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Because {film.reasons.join(' · ')}</p>
                    )}
                    {film.overview && (
                      <p style={{ fontSize: 12, color: '#555', marginTop: 4, lineHeight: 1.5 }}>
                        {film.overview.slice(0, 120)}{film.overview.length > 120 ? '…' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {watchedFilms.length > 0 && (
            <div>
              <button
                onClick={() => setShowWatched(v => !v)}
                style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 8, padding: '0.4rem 1rem', fontSize: 13, cursor: 'pointer', marginBottom: '0.75rem' }}
              >
                {showWatched ? 'Hide' : 'Show'} watched ({watchedFilms.length})
              </button>
              {showWatched && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {watchedFilms.map(film => {
                    const title = film.Name || film.Title
                    return (
                      <div key={title} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.4 }}>
                        <span style={{ fontSize: 14 }}>{title}</span>
                        <button
                          onClick={() => toggleWatched(title)}
                          style={{ background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#888', padding: '0.2rem 0.6rem', fontSize: 12, cursor: 'pointer' }}
                        >
                          Unmark
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}