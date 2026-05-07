export function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || []
    return headers.reduce((obj, h, i) => {
      obj[h] = (values[i] || '').replace(/"/g, '').trim()
      return obj
    }, {})
  }).filter(row => row.Name || row.Title)
}

export function computeStats(films) {
  const rated = films.filter(f => f.Rating && f.Rating !== '')
  const ratings = rated.map(f => parseFloat(f.Rating))
  const avg = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
    : 0

  const dist = {}
  ratings.forEach(r => { dist[r] = (dist[r] || 0) + 1 })

  const years = {}
  films.forEach(f => {
    const y = f.Year || f['Release Year']
    if (y) years[y] = (years[y] || 0) + 1
  })

  const unrated = films.filter(f => !f.Rating || f.Rating === '').length

  const extremes = ratings.filter(r => r <= 1.5 || r >= 4.5).length
  const consistencyScore = ratings.length
    ? Math.round((extremes / ratings.length) * 100)
    : 0

  const comfortZone = Object.entries(dist).sort((a, b) => b[1] - a[1])[0]

  return { total: films.length, rated: rated.length, avg, dist, years, unrated, consistencyScore, comfortZone }
}

export function computeBlend(films1, films2) {
  const map1 = {}
  const map2 = {}
  films1.forEach(f => { if (f.Rating) map1[f.Name || f.Title] = parseFloat(f.Rating) })
  films2.forEach(f => { if (f.Rating) map2[f.Name || f.Title] = parseFloat(f.Rating) })

  const common = Object.keys(map1).filter(k => map2[k])
  const diffs = common.map(k => Math.abs(map1[k] - map2[k]))
  const avgDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 5
  const score = Math.round(Math.max(0, 100 - avgDiff * 20))

  const watched1 = new Set(films1.map(f => f.Name || f.Title))
  const watched2 = new Set(films2.map(f => f.Name || f.Title))

  const watchlist = [
    ...films1.filter(f => !watched2.has(f.Name || f.Title) && parseFloat(f.Rating) >= 4).slice(0, 8),
    ...films2.filter(f => !watched1.has(f.Name || f.Title) && parseFloat(f.Rating) >= 4).slice(0, 8),
  ]

  const commonFilms = common.slice(0, 20).map(k => ({
    name: k, r1: map1[k], r2: map2[k]
  }))

  return { score, commonFilms, watchlist }
}

export function computeMonthStats(diary) {
  const months = {}
  diary.forEach(f => {
    const date = f['Watched Date'] || f.Date
    if (date) {
      const month = date.slice(0, 7)
      months[month] = (months[month] || 0) + 1
    }
  })
  return Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }))
}

export function computeYearlyAvg(films) {
  const byYear = {}
  films.forEach(f => {
    const y = f.Year || f['Release Year']
    const r = parseFloat(f.Rating)
    if (y && r) {
      if (!byYear[y]) byYear[y] = { sum: 0, count: 0 }
      byYear[y].sum += r
      byYear[y].count++
    }
  })
  return Object.entries(byYear)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, { sum, count }]) => ({
      year,
      avg: Math.round((sum / count) * 100) / 100
    }))
}

export function filterByYear(films, year) {
  return films.filter(f => {
    const date = f['Watched Date'] || f.Date
    return date && date.startsWith(year)
  })
}

export function topItems(arr, key, n = 10) {
  const counts = {}
  arr.forEach(f => {
    const val = f[key]
    if (Array.isArray(val)) val.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
    else if (val) counts[val] = (counts[val] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

export function computeDiaryStats(diary) {
  if (!diary.length) return {}

  const byYear = {}
  diary.forEach(f => {
    const date = f['Watched Date'] || f.Date
    if (!date) return
    const y = date.slice(0, 4)
    byYear[y] = (byYear[y] || 0) + 1
  })

  const mostProductiveYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0]

  const byMonth = {}
  diary.forEach(f => {
    const date = f['Watched Date'] || f.Date
    if (!date) return
    const m = date.slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
  })
  const mostProductiveMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0]

  const watchingPace = Object.entries(byYear)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, count]) => ({ year, count }))

  const dates = diary.map(f => f['Watched Date'] || f.Date).filter(Boolean)
  const sorted = [...new Set(dates)].sort()
  let maxStreak = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000
    if (diff === 1) { cur++; maxStreak = Math.max(maxStreak, cur) }
    else cur = 1
  }

  return { mostProductiveYear, mostProductiveMonth, watchingPace, allTimeStreak: maxStreak }
}