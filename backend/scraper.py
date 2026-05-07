import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://letterboxd.com"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Referer": "https://letterboxd.com/",
}

async def get_user_films(username: str):
    films = []
    page = 1

    async with httpx.AsyncClient(timeout=15, headers=HEADERS, follow_redirects=True) as client:
        while True:
            url = f"{BASE_URL}/{username}/films/page/{page}/"
            response = await client.get(url)

            if response.status_code != 200:
                break

            soup = BeautifulSoup(response.text, "html.parser")

            film_items = (
                soup.select("li.poster-container") or
                soup.select("li[class*='poster']") or
                soup.select("div.film-poster") or
                soup.select("li.film-list-entry")
            )

            if not film_items:
                break

            for item in film_items:
                poster = item.find(attrs={"data-film-slug": True}) or item
                slug = poster.get("data-film-slug", "")
                name = poster.get("data-film-name", "") or poster.get("data-film-id", slug)
                
                rating_span = item.find("span", class_=lambda c: c and "rated-" in c)
                rating = None
                if rating_span:
                    for cls in rating_span.get("class", []):
                        if cls.startswith("rated-"):
                            try:
                                rating = int(cls.replace("rated-", "")) / 2
                            except:
                                pass
                            break

                if slug:
                    films.append({
                        "slug": slug,
                        "name": name or slug.replace("-", " ").title(),
                        "rating": rating,
                    })

            page += 1
            if page > 50:
                break

    return films


async def get_user_profile(username: str):
    url = f"{BASE_URL}/{username}/"
    async with httpx.AsyncClient(timeout=15, headers=HEADERS, follow_redirects=True) as client:
        response = await client.get(url)

    if response.status_code != 200:
        return None

    soup = BeautifulSoup(response.text, "html.parser")

    display_name = username
    for selector in ["h1.title-1", "h1.person-display-name", "span.name"]:
        tag = soup.select_one(selector)
        if tag:
            display_name = tag.text.strip()
            break

    avatar = ""
    avatar_tag = soup.select_one("div.profile-avatar img, img.avatar")
    if avatar_tag:
        avatar = avatar_tag.get("src", "")

    return {
        "username": username,
        "display_name": display_name,
        "avatar": avatar,
    }