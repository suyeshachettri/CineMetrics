const TMDB_KEY = '4e821150c78f844f37119e05f64490ba'
const BASE = 'https://api.themoviedb.org/3'

export async function searchMovie(name, year) {
  try {
    const res = await fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}&year=${year}`)
    const data = await res.json()
    return data.results?.[0] || null
  } catch { return null }
}

export async function getMovieDetail(id) {
  try {
    const res = await fetch(`${BASE}/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits`)
    return await res.json()
  } catch { return null }
}

export async function enrichFilms(films) {
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
        countries: detail?.production_countries?.map(c => c.name) || [],
        language: detail?.original_language || null,
      })
    } else {
      enriched.push({ ...film, genres: [], director: null, runtime: null, tmdbRating: null, popularity: null, countries: [], language: null })
    }
  }
  return enriched
}