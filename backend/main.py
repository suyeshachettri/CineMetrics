from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from scraper import get_user_films, get_user_profile
import os
from dotenv import load_dotenv
import httpx

load_dotenv()
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

app = FastAPI(title="BoxOfficd API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://yourusername.github.io"],
    allow_methods=["*"],
    allow_headers=["*"],
)

cache = {}

@app.get("/user/{username}")
async def get_user(username: str):
    if username in cache:
        return cache[username]

    profile = await get_user_profile(username)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    films = await get_user_films(username)
    result = {**profile, "films": films}
    cache[username] = result
    return result


@app.get("/blend/{user1}/{user2}")
async def blend(user1: str, user2: str):
    u1_films = await get_user_films(user1)
    u2_films = await get_user_films(user2)

    u1_rated = {f["slug"]: f["rating"] for f in u1_films if f["rating"]}
    u2_rated = {f["slug"]: f["rating"] for f in u2_films if f["rating"]}

    common = set(u1_rated.keys()) & set(u2_rated.keys())

    if not common:
        return {"score": 0, "common_films": [], "watchlist": []}

    diffs = [abs(u1_rated[s] - u2_rated[s]) for s in common]
    avg_diff = sum(diffs) / len(diffs)
    score = round(max(0, 100 - (avg_diff * 20)), 1)

    common_films = [
        {
            "slug": s,
            "u1_rating": u1_rated[s],
            "u2_rating": u2_rated[s],
        }
        for s in list(common)[:20]
    ]

    u1_slugs = {f["slug"] for f in u1_films}
    u2_slugs = {f["slug"] for f in u2_films}
    only_u1 = [f for f in u1_films if f["slug"] not in u2_slugs and f["rating"] and f["rating"] >= 4]
    only_u2 = [f for f in u2_films if f["slug"] not in u1_slugs and f["rating"] and f["rating"] >= 4]
    watchlist = only_u1[:10] + only_u2[:10]

    return {
        "score": score,
        "common_films": common_films,
        "watchlist": watchlist,
    }


@app.get("/stats/{username}")
async def stats(username: str):
    films = await get_user_films(username)
    rated = [f for f in films if f["rating"]]

    if not rated:
        return {"total": len(films), "rated": 0, "avg_rating": 0, "ratings_dist": {}}

    avg = round(sum(f["rating"] for f in rated) / len(rated), 2)

    dist = {}
    for f in rated:
        r = str(f["rating"])
        dist[r] = dist.get(r, 0) + 1

    return {
        "total": len(films),
        "rated": len(rated),
        "avg_rating": avg,
        "ratings_dist": dist,
    }


@app.get("/wrapped/{username}")
async def wrapped(username: str):
    films = await get_user_films(username)
    rated = [f for f in films if f["rating"]]

    top = sorted(rated, key=lambda f: f["rating"], reverse=True)[:5]
    total = len(films)
    avg = round(sum(f["rating"] for f in rated) / len(rated), 2) if rated else 0

    return {
        "total_watched": total,
        "total_rated": len(rated),
        "avg_rating": avg,
        "top_films": top,
    }