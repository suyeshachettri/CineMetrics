import { useEffect, useRef } from 'react'

export default function WrappedCard({ year, data, onClose }) {
  const { watched, avg, topDecade, streak, top5, topGenre, topDirector, hiddenGem, ratingPersonality, totalHours } = data

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
      onClick={onClose}>
      <div
        id="wrapped-card"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f0f0f',
          border: '1px solid #222',
          borderRadius: 20,
          padding: '2rem',
          width: 380,
          fontFamily: 'system-ui, sans-serif',
          color: '#e8e8e8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ color: '#00c030', fontWeight: 700, fontSize: 20 }}>BoxOfficd</span>
          <span style={{ color: '#666', fontSize: 13 }}>{year} Wrapped</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Films watched</p>
            <p style={{ fontSize: '2rem', fontWeight: 700 }}>{watched}</p>
          </div>
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Avg rating</p>
            <p style={{ fontSize: '2rem', fontWeight: 700 }}>{avg} ★</p>
          </div>
        </div>

        {totalHours > 0 && (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center', marginBottom: '0.75rem' }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Time spent watching</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00c030' }}>{totalHours}h</p>
          </div>
        )}

        {top5?.length > 0 && (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem' }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: '0.75rem' }}>Top films</p>
            {top5.map((f, i) => (
              <div key={f.Name || f.Title} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: i < top5.length - 1 ? '1px solid #222' : 'none' }}>
                <span style={{ fontSize: 13 }}>{i + 1}. {f.Name || f.Title}</span>
                <span style={{ fontSize: 13, color: '#666' }}>{f.Rating}★</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {topDecade && (
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
              <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Fav decade</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#00c030' }}>{topDecade}</p>
            </div>
          )}
          {streak > 0 && (
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
              <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Longest streak</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#EF9F27' }}>{streak} days</p>
            </div>
          )}
        </div>

        {(topGenre || topDirector) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {topGenre && (
              <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Top genre</p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#7f77dd' }}>{topGenre}</p>
              </div>
            )}
            {topDirector && (
              <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Top director</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#7f77dd' }}>{topDirector}</p>
              </div>
            )}
          </div>
        )}

        {hiddenGem && (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center', marginBottom: '0.75rem' }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Hidden gem</p>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#EF9F27' }}>{hiddenGem.Name || hiddenGem.Title}</p>
          </div>
        )}

        {ratingPersonality !== undefined && (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Rating personality</p>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: ratingPersonality > 0.2 ? '#00c030' : ratingPersonality < -0.2 ? '#E24B4A' : '#888' }}>
              {ratingPersonality > 0.2 ? 'Generous rater' : ratingPersonality < -0.2 ? 'Harsh critic' : 'Right on average'}
            </p>
          </div>
        )}

        <p style={{ color: '#333', fontSize: 11, textAlign: 'center' }}>boxofficd.app · powered by Letterboxd data</p>
      </div>

      <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.75rem' }}>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: 8, padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: 14 }}>
          Close
        </button>
        <button
  onClick={async () => {
    const card = document.getElementById('wrapped-card')
    const canvas = await html2canvas(card, { backgroundColor: '#0f0f0f', scale: 2 })
    const link = document.createElement('a')
    link.download = `boxofficd-wrapped-${year}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }}
  style={{ background: '#00c030', color: '#000', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
>
  Download card
</button>
      </div>
    </div>
  )
}