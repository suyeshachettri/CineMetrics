import { useState } from 'react'
import { parseCSV } from '../../lib/parseCSV'
import { getMovieDetail } from '../../lib/tmdb'

const TMDB_KEY = '4e821150c78f844f37119e05f64490ba'
const BASE = 'https://api.themoviedb.org/3'

async function fetchGenreIds() {
  const res = await fetch(`${BASE}/genre/movie/list?api_key=${TMDB_KEY}`)
  const data = await res.json()
  return Object.fromEntries(data.genres.map(g => [g.name, g.id]))
}

async function discoverFilms(genreId, page = 1) {
  const res = await fetch(
    `${BASE}/discover/movie?api_key=${TMDB_KEY}&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=500&page=${page}`
  )
  const data = await res.json()
  return data.results || []
}

async function getDetail(id) {
  const res = await fetch(`${BASE}/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits`)
  return await res.json()
}

function buildTasteProfile(films) {
  const decades = {}
  films.forEach(f => {
    const rating = parseFloat(f.Rating)
    if (!rating) return
    const y = parseInt(f.Year || f['Release Year'])
    if (y) {
      const decade = Math.floor(y / 10) * 10 + 's'
      if (!decades[decade]) decades[decade] = { sum: 0, count: 0 }
      decades[decade].sum += rating
      decades[decade].count++
    }
  })
  return { genres: {}, directors: {}, decades }
}

function scoreFilm(film, tasteProfile, genreNameMap) {
  let score = 0
  const reasons = []

  const filmGenres = film.genre_ids?.map(id => genreNameMap[id]).filter(Boolean) || []

  filmGenres.forEach(g => {
    const gProfile = tasteProfile.genres[g]
    if (gProfile) {
      score += gProfile.avg * gProfile.count * 0.05
      if (gProfile.avg >= 3.5) reasons.push(`you love ${g}`)
    }
  })

  if (film.director && tasteProfile.directors[film.director]) {
    const d = tasteProfile.directors[film.director]
    score += d.avg * d.count * 0.1
    reasons.push(`you rate ${film.director} ${d.avg}★ avg`)
  }

  const y = parseInt((film.release_date || '').slice(0, 4))
  if (y) {
    const decade = Math.floor(y / 10) * 10 + 's'
    const dProfile = tasteProfile.decades[decade]
    if (dProfile) {
      score += (dProfile.sum / dProfile.count) * 0.05
    }
  }

  score += (film.vote_average / 10) * 2

  return {
    score: Math.round(score * 10) / 10,
    reasons: [...new Set(reasons)].slice(0, 2)
  }
}

export default function Recs() {
  const [films, setFilms] = useState(null)
  const [watched, setWatched] = useState(null)
  const [recs, setRecs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { setFilms(parseCSV(ev.target.result)); setRecs(null); setError('') }
      catch { setError('Could not parse ratings.csv') }
    }
    reader.readAsText(file)
  }

  function handleWatched(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { setWatched(parseCSV(ev.target.result)) }
      catch { setError('Could not parse watched.csv') }
    }
    reader.readAsText(file)
  }

  async function generateRecs() {
    if (!films) return
    setLoading(true)
    setRecs(null)

    const rated = films.filter(f => f.Rating)
    const seen = new Set([
      ...rated.map(f => (f.Name || f.Title || '').toLowerCase()),
      ...(watched || []).map(f => (f.Name || f.Title || '').toLowerCase()),
    ])

    setProgress('Building taste profile...')
    const tasteProfile = buildTasteProfile(rated)

    setProgress('Fetching TMDb genre list...')
    const genreIdMap = await fetchGenreIds()
    const genreNameMap = Object.fromEntries(Object.entries(genreIdMap).map(([name, id]) => [id, name]))

    setProgress('Analysing your top rated films...')
    const genreCounts = {}
    const directorCounts = {}

    for (const film of rated.slice(0, 60)) {
      const name = film.Name || film.Title
      const year = film.Year || film['Release Year']
      const rating = parseFloat(film.Rating)
      try {
        const res = await fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}&year=${year}`)
        const data = await res.json()
        const movie = data.results?.[0]
        if (!movie) continue

        movie.genre_ids?.forEach(id => {
          const gName = genreNameMap[id]
          if (gName) {
            if (!genreCounts[gName]) genreCounts[gName] = { sum: 0, count: 0 }
            genreCounts[gName].sum += rating
            genreCounts[gName].count++
          }
        })

        const detail = await getDetail(movie.id)
        const director = detail?.credits?.crew?.find(c => c.job === 'Director')?.name
        if (director) {
          if (!directorCounts[director]) directorCounts[director] = { sum: 0, count: 0 }
          directorCounts[director].sum += rating
          directorCounts[director].count++
        }
      } catch { continue }
    }

    tasteProfile.genres = Object.fromEntries(
      Object.entries(genreCounts).map(([g, v]) => [g, { avg: Math.round(v.sum / v.count * 100) / 100, count: v.count }])
    )
    tasteProfile.directors = Object.fromEntries(
      Object.entries(directorCounts)
        .filter(([, v]) => v.count >= 2)
        .map(([d, v]) => [d, { avg: Math.round(v.sum / v.count * 100) / 100, count: v.count }])
    )

    const topGenres = Object.entries(tasteProfile.genres)
      .sort((a, b) => b[1].avg - a[1].avg)
      .slice(0, 5)
      .map(([g]) => g)

    setProgress('Discovering films you might love...')
    const candidates = []
    const seen_ids = new Set()

    for (let page = 1; page <= 2; page++) {
      for (const genre of topGenres) {
        const genreId = genreIdMap[genre]
        if (!genreId) continue
        const results = await discoverFilms(genreId, page)
        results.forEach(f => {
          if (!seen_ids.has(f.id) && !seen.has(f.title?.toLowerCase())) {
            seen_ids.add(f.id)
            candidates.push(f)
          }
        })
      }
    }

    setProgress('Scoring recommendations...')
    const scored = candidates
      .map(film => {
        const { score, reasons } = scoreFilm(film, tasteProfile, genreNameMap)
        const genres = film.genre_ids?.map(id => genreNameMap[id]).filter(Boolean) || []
        return {
          id: film.id,
          title: film.title,
          year: (film.release_date || '').slice(0, 4),
          tmdbRating: Math.round(film.vote_average / 2 * 10) / 10,
          poster: film.poster_path ? `https://image.tmdb.org/t/p/w92${film.poster_path}` : null,
          overview: film.overview || '',
          genres,
          score,
          reasons,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)

    setRecs(scored)
    setProgress('')
    setLoading(false)
  }

  const allGenres = recs ? [...new Set(recs.flatMap(f => f.genres))].sort() : []
  const filtered = recs ? filter === 'all' ? recs : recs.filter(f => f.genres.includes(filter)) : []

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Recommendations</h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Films you haven't seen that you'd probably love, based on your taste profile.
        Export from Letterboxd → Settings → Data → Export Your Data.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>ratings.csv (required)</p>
          <input type="file" accept=".csv" onChange={handleFile} />
          {films && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{films.filter(f => f.Rating).length} rated films loaded</p>}
        </div>
        <div>
          <p style={{ fontSize: 13, marginBottom: 4, color: '#888' }}>watched.csv (recommended)</p>
          <input type="file" accept=".csv" onChange={handleWatched} />
          {watched && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{watched.length} watched films loaded</p>}
        </div>
      </div>

      <button onClick={generateRecs} disabled={!films || loading}>
        {loading ? progress || 'Loading...' : recs ? 'Regenerate' : 'Get recommendations'}
      </button>

      {error && <p className="error">{error}</p>}

      {recs && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">Recommendations</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{recs.length}</p>
            </div>
            <div className="card" style={{ textAlign: 'center', gridColumn: 'span 2', background: '#0d1a0d', border: '1px solid #1a3a1a' }}>
              <p style={{ color: '#00c030', fontSize: 13, marginBottom: 4 }}>Top recommendation</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{recs[0]?.title}</p>
              {recs[0]?.reasons?.length > 0 && (
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Because {recs[0].reasons.join(' · ')}</p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilter('all')}
              style={{ background: filter === 'all' ? '#00c030' : 'transparent', color: filter === 'all' ? '#000' : '#888', border: '1px solid #333', borderRadius: 20, padding: '0.3rem 0.9rem', fontSize: 12, cursor: 'pointer' }}
            >
              All
            </button>
            {allGenres.map(g => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                style={{ background: filter === g ? '#00c030' : 'transparent', color: filter === g ? '#000' : '#888', border: '1px solid #333', borderRadius: 20, padding: '0.3rem 0.9rem', fontSize: 12, cursor: 'pointer' }}
              >
                {g}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map((film, i) => (
              <div key={film.id} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#333', minWidth: 28, paddingTop: 4 }}>
                  {i + 1}
                </div>
                {film.poster && (
                  <img src={film.poster} alt={film.title} style={{ width: 46, height: 69, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{film.title}</p>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ color: '#00c030', fontWeight: 700, fontSize: 14 }}>{film.score} pts</p>
                      <p className="muted" style={{ fontSize: 11 }}>TMDb {film.tmdbRating}★</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.3rem 0' }}>
                    {film.genres.slice(0, 3).map(g => (
                      <span key={g} style={{ fontSize: 11, padding: '2px 8px', background: '#222', borderRadius: 20, color: '#888' }}>{g}</span>
                    ))}
                    {film.year && <span style={{ fontSize: 11, padding: '2px 8px', background: '#222', borderRadius: 20, color: '#888' }}>{film.year}</span>}
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
            ))}
          </div>

        </div>
      )}
    </div>
  )
}