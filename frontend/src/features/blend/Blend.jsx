import { useState } from 'react'
import { parseCSV, computeBlend } from '../../lib/parseCSV'
import { enrichFilms } from '../../lib/tmdb'

function scoreLabel(score) {
  if (score >= 90) return "You're basically the same person"
  if (score >= 75) return "Very strong taste match"
  if (score >= 60) return "Solid compatibility"
  if (score >= 40) return "Some overlap, plenty of differences"
  return "Very different taste"
}

function scoreColor(score) {
  if (score >= 75) return '#00c030'
  if (score >= 50) return '#EF9F27'
  return '#E24B4A'
}

function blendPersonality(genres1, genres2) {
  const shared = Object.keys(genres1).filter(g => genres2[g])
  if (!shared.length) return null
  const top = shared.sort((a, b) => (genres1[b] + genres2[b]) - (genres1[a] + genres2[a]))[0]
  const personalities = {
    'Horror': 'The Horror Duo',
    'Romance': 'The Hopeless Romantics',
    'Drama': 'The Drama Kings',
    'Comedy': 'The Comedy Club',
    'Action': 'The Action Junkies',
    'Thriller': 'The Thrill Seekers',
    'Science Fiction': 'The Sci-Fi Nerds',
    'Animation': 'The Animation Lovers',
    'Crime': 'The Crime Partners',
    'Mystery': 'The Mystery Solvers',
    'Fantasy': 'The Fantasy Fans',
    'Adventure': 'The Adventurers',
    'Music': 'The Music Film Buffs',
    'History': 'The History Buffs',
    'War': 'The War Film Fans',
    'Family': 'The Family Film Fans',
  }
  return personalities[top] || `The ${top} Fans`
}

function buildGenreProfile(enriched) {
  const counts = {}
  enriched.forEach(f => {
    const rating = parseFloat(f.Rating)
    if (!rating) return
    f.genres?.forEach(g => {
      if (!counts[g]) counts[g] = { sum: 0, count: 0 }
      counts[g].sum += rating
      counts[g].count++
    })
  })
  return Object.fromEntries(
    Object.entries(counts).map(([g, v]) => [g, Math.round(v.sum / v.count * 100) / 100])
  )
}

function buildDirectorProfile(enriched) {
  const counts = {}
  enriched.forEach(f => {
    const rating = parseFloat(f.Rating)
    if (!rating || !f.director) return
    if (!counts[f.director]) counts[f.director] = { sum: 0, count: 0 }
    counts[f.director].sum += rating
    counts[f.director].count++
  })
  return Object.fromEntries(
    Object.entries(counts)
      .filter(([, v]) => v.count >= 1)
      .map(([d, v]) => [d, Math.round(v.sum / v.count * 100) / 100])
  )
}

export default function Blend() {
  const [films1, setFilms1] = useState(null)
  const [films2, setFilms2] = useState(null)
  const [name1, setName1] = useState('Person 1')
  const [name2, setName2] = useState('Person 2')
  const [data, setData] = useState(null)
  const [enriched1, setEnriched1] = useState(null)
  const [enriched2, setEnriched2] = useState(null)
  const [enriching, setEnriching] = useState(false)
  const [error, setError] = useState('')

  function handleFile(setter) {
    return e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          setter(parseCSV(ev.target.result))
          setData(null)
          setEnriched1(null)
          setEnriched2(null)
          setError('')
        } catch { setError('Could not parse file.') }
      }
      reader.readAsText(file)
    }
  }

  function blend() {
    if (!films1 || !films2) return
    const result = computeBlend(films1, films2)
    result.commonFilms.sort((a, b) => Math.abs(a.r1 - a.r2) - Math.abs(b.r1 - b.r2))
    setData(result)
  }

  async function handleEnrich() {
    if (!films1 || !films2) return
    setEnriching(true)
    const [e1, e2] = await Promise.all([
      enrichFilms(films1.filter(f => f.Rating).slice(0, 80)),
      enrichFilms(films2.filter(f => f.Rating).slice(0, 80)),
    ])
    setEnriched1(e1)
    setEnriched2(e2)
    setEnriching(false)
  }

  const genreProfile1 = enriched1 ? buildGenreProfile(enriched1) : null
  const genreProfile2 = enriched2 ? buildGenreProfile(enriched2) : null
  const directorProfile1 = enriched1 ? buildDirectorProfile(enriched1) : null
  const directorProfile2 = enriched2 ? buildDirectorProfile(enriched2) : null

  const sharedGenres = genreProfile1 && genreProfile2
    ? Object.keys(genreProfile1)
        .filter(g => genreProfile2[g])
        .sort((a, b) => (genreProfile1[b] + genreProfile2[b]) - (genreProfile1[a] + genreProfile2[a]))
        .slice(0, 8)
    : []

  const sharedDirectors = directorProfile1 && directorProfile2
    ? Object.keys(directorProfile1)
        .filter(d => directorProfile2[d])
        .sort((a, b) => (directorProfile1[b] + directorProfile2[b]) - (directorProfile1[a] + directorProfile2[a]))
        .slice(0, 5)
    : []

  const personality = genreProfile1 && genreProfile2
    ? blendPersonality(genreProfile1, genreProfile2)
    : null

  const top5_1 = films1
    ? [...films1].filter(f => f.Rating).sort((a, b) => parseFloat(b.Rating) - parseFloat(a.Rating)).slice(0, 5)
    : []
  const top5_2 = films2
    ? [...films2].filter(f => f.Rating).sort((a, b) => parseFloat(b.Rating) - parseFloat(a.Rating)).slice(0, 5)
    : []

  const disagreements = data?.commonFilms
    ? [...data.commonFilms].sort((a, b) => Math.abs(b.r1 - b.r2) - Math.abs(a.r1 - a.r2)).slice(0, 5)
    : []

  const allGenres = genreProfile1 && genreProfile2
    ? [...new Set([...Object.keys(genreProfile1), ...Object.keys(genreProfile2)])].slice(0, 10)
    : []

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Blend</h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Upload two <code>ratings.csv</code> files to see your film taste compatibility.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card">
          <input
            value={name1}
            onChange={e => setName1(e.target.value)}
            style={{ marginBottom: '0.75rem', fontWeight: 600 }}
            placeholder="Name"
          />
          <input type="file" accept=".csv" onChange={handleFile(setFilms1)} />
          {films1 && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{films1.length} films loaded</p>}
        </div>
        <div className="card">
          <input
            value={name2}
            onChange={e => setName2(e.target.value)}
            style={{ marginBottom: '0.75rem', fontWeight: 600 }}
            placeholder="Name"
          />
          <input type="file" accept=".csv" onChange={handleFile(setFilms2)} />
          {films2 && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{films2.length} films loaded</p>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <button onClick={blend} disabled={!films1 || !films2}>Generate Blend</button>
        {films1 && films2 && (
          <button
            onClick={handleEnrich}
            disabled={enriching}
            style={{ background: 'transparent', border: '1px solid #00c030', color: '#00c030' }}
          >
            {enriching ? 'Fetching TMDb...' : enriched1 ? 'Reload genre analysis' : 'Load genre analysis'}
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Score */}
<div className="card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
  <div style={{
    position: 'absolute', inset: 0, opacity: 0.06,
    background: `radial-gradient(circle at 50% 50%, ${scoreColor(data.score)}, transparent 70%)`
  }} />
  {personality && (
    <p style={{ fontSize: 14, color: scoreColor(data.score), marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {personality}
    </p>
  )}
  <p className="muted" style={{ marginBottom: 4 }}>Compatibility score</p>
  <p style={{ fontSize: '5rem', fontWeight: 700, color: scoreColor(data.score), lineHeight: 1, marginBottom: 8 }}>
    {data.score}%
  </p>
  <div style={{ width: '100%', height: 6, background: '#222', borderRadius: 3, margin: '0.5rem 0' }}>
    <div style={{ width: `${data.score}%`, height: '100%', borderRadius: 3, background: `linear-gradient(to right, #E24B4A, #EF9F27, #00c030)`, transition: 'width 0.8s ease' }} />
  </div>
  <p style={{ fontSize: '0.95rem', color: scoreColor(data.score), marginTop: 8 }}>
    {scoreLabel(data.score)}
  </p>
  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
    Based on {data.commonFilms.length} films you've both seen
  </p>
</div>

          {/* Top 5s */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{name1}'s top 5</p>
              {top5_1.map((f, i) => (
                <div key={f.Name || f.Title} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #222' }}>
                  <span style={{ fontSize: 13 }}>{i + 1}. {f.Name || f.Title}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{f.Rating}★</span>
                </div>
              ))}
            </div>
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{name2}'s top 5</p>
              {top5_2.map((f, i) => (
                <div key={f.Name || f.Title} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #222' }}>
                  <span style={{ fontSize: 13 }}>{i + 1}. {f.Name || f.Title}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{f.Rating}★</span>
                </div>
              ))}
            </div>
          </div>

          {/* Genre comparison */}
          {genreProfile1 && genreProfile2 && allGenres.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Genre taste comparison</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#666', textAlign: 'right' }}>{name1}</span>
                <span style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>Genre</span>
                <span style={{ fontSize: 12, color: '#666' }}>{name2}</span>
                {allGenres.map(g => (
                  <>
                    <div key={g + '1'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <span style={{ fontSize: 12, color: '#888' }}>{genreProfile1[g] ? `${genreProfile1[g]}★` : '—'}</span>
                      <div style={{ height: 8, borderRadius: 4, background: '#00c030', width: `${((genreProfile1[g] || 0) / 5) * 80}px` }} />
                    </div>
                    <span key={g + 'label'} style={{ fontSize: 12, textAlign: 'center', color: '#e8e8e8' }}>{g}</span>
                    <div key={g + '2'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ height: 8, borderRadius: 4, background: '#7f77dd', width: `${((genreProfile2[g] || 0) / 5) * 80}px` }} />
                      <span style={{ fontSize: 12, color: '#888' }}>{genreProfile2[g] ? `${genreProfile2[g]}★` : '—'}</span>
                    </div>
                  </>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 12, height: 8, background: '#00c030', borderRadius: 4 }} />
                  <span style={{ fontSize: 12, color: '#888' }}>{name1}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 12, height: 8, background: '#7f77dd', borderRadius: 4 }} />
                  <span style={{ fontSize: 12, color: '#888' }}>{name2}</span>
                </div>
              </div>
            </div>
          )}

          {/* Shared directors */}
          {sharedDirectors.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Directors you both love</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {sharedDirectors.map(d => (
                  <div key={d} style={{ background: '#111', borderRadius: 8, padding: '0.4rem 0.75rem' }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{d}</p>
                    <p className="muted" style={{ fontSize: 11 }}>
                      {directorProfile1[d]}★ · {directorProfile2[d]}★
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common films */}
          {data.commonFilms.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Films you've both seen</p>
              <p className="muted" style={{ fontSize: 13, marginBottom: '0.75rem' }}>Sorted by closest rating match</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 1rem', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#666', paddingBottom: 6 }}>Film</span>
                <span style={{ fontSize: 12, color: '#666', paddingBottom: 6 }}>{name1}</span>
                <span style={{ fontSize: 12, color: '#666', paddingBottom: 6 }}>{name2}</span>
                {data.commonFilms.map(f => (
                  <>
                    <span key={f.name + 'n'} style={{ padding: '0.35rem 0', borderTop: '1px solid #222', fontSize: 14 }}>{f.name}</span>
                    <span key={f.name + 'r1'} style={{ padding: '0.35rem 0', borderTop: '1px solid #222', color: '#888', fontSize: 13, textAlign: 'right' }}>{f.r1}★</span>
                    <span key={f.name + 'r2'} style={{ padding: '0.35rem 0', borderTop: '1px solid #222', color: '#888', fontSize: 13, textAlign: 'right' }}>{f.r2}★</span>
                  </>
                ))}
              </div>
            </div>
          )}

          {/* Agree vs Disagree */}
{data.commonFilms.length > 0 && (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
    <div className="card" style={{ borderColor: '#1a3a1a' }}>
      <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#00c030' }}>You'd agree on</p>
      <p className="muted" style={{ fontSize: 13, marginBottom: '0.75rem' }}>Rated within 0.5★ of each other</p>
      {data.commonFilms
        .filter(f => Math.abs(f.r1 - f.r2) <= 0.5)
        .slice(0, 8)
        .map(f => (
          <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #222' }}>
            <span style={{ fontSize: 13 }}>{f.name}</span>
            <span style={{ fontSize: 12, color: '#00c030' }}>{f.r1}★ · {f.r2}★</span>
          </div>
        ))}
      {data.commonFilms.filter(f => Math.abs(f.r1 - f.r2) <= 0.5).length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>No close matches found</p>
      )}
    </div>

    <div className="card" style={{ borderColor: '#3a1a1a' }}>
      <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#E24B4A' }}>You'd disagree on</p>
      <p className="muted" style={{ fontSize: 13, marginBottom: '0.75rem' }}>Rated 1.5★+ apart</p>
      {data.commonFilms
        .filter(f => Math.abs(f.r1 - f.r2) >= 1.5)
        .slice(0, 8)
        .map(f => (
          <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #222' }}>
            <span style={{ fontSize: 13 }}>{f.name}</span>
            <div style={{ display: 'flex', gap: '0.4rem', fontSize: 12 }}>
              <span style={{ color: f.r1 > f.r2 ? '#00c030' : '#E24B4A' }}>{f.r1}★</span>
              <span style={{ color: '#444' }}>·</span>
              <span style={{ color: f.r2 > f.r1 ? '#00c030' : '#E24B4A' }}>{f.r2}★</span>
            </div>
          </div>
        ))}
      {data.commonFilms.filter(f => Math.abs(f.r1 - f.r2) >= 1.5).length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>No major disagreements found</p>
      )}
    </div>
  </div>
)}

{/* Watch together */}
{data.watchlist.length > 0 && (
  <div className="card">
    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Watch together</p>
    <p className="muted" style={{ fontSize: 13, marginBottom: '0.75rem' }}>
      Films one of you loved that the other hasn't seen yet
    </p>
    {data.watchlist.map(f => (
      <div key={f.Name || f.Title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #222' }}>
        <span style={{ fontSize: 14 }}>{f.Name || f.Title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: 12, color: '#666' }}>
            {films1.find(x => (x.Name || x.Title) === (f.Name || f.Title)) ? name1 : name2} loved it
          </span>
          <span className="muted" style={{ fontSize: 13 }}>{f.Rating}★</span>
        </div>
      </div>
    ))}
  </div>
)}

{/* Watch together */}
{data.watchlist.length > 0 && (
  <div className="card">
    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Watch together</p>
    <p className="muted" style={{ fontSize: 13, marginBottom: '0.75rem' }}>
      Films one of you loved that the other hasn't seen yet
    </p>
    {data.watchlist.map(f => (
      <div key={f.Name || f.Title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #222' }}>
        <span style={{ fontSize: 14 }}>{f.Name || f.Title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: 12, color: '#666' }}>
            {films1.find(x => (x.Name || x.Title) === (f.Name || f.Title)) ? name1 : name2} loved it
          </span>
          <span className="muted" style={{ fontSize: 13 }}>{f.Rating}★</span>
        </div>
      </div>
    ))}
  </div>
)}

        </div>
      )}
    </div>
  )
}