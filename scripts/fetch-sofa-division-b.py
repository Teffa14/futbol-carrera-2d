#!/usr/bin/env python3
import json
import sys
import time
from curl_cffi import requests

TOURNAMENT_ID = 703
BASES = [
    "https://api.sofascore.com/api/v1",
    "https://api.sofascore.app/api/v1",
    "https://www.sofascore.com/api/v1",
]

session = requests.Session(impersonate="chrome")
headers = {
    "accept": "application/json,text/plain,*/*",
    "referer": "https://www.sofascore.com/",
    "x-requested-with": "XMLHttpRequest",
}


def get_json(path):
    errors = []
    for base in BASES:
        try:
            response = session.get(f"{base}{path}", headers=headers, timeout=25)
            if response.status_code == 200:
                return response.json()
            errors.append(f"{base}: HTTP {response.status_code}")
        except Exception as exc:
            errors.append(f"{base}: {exc}")
    raise RuntimeError(f"Sofascore {path} failed: {'; '.join(errors)}")


def standings_teams(payload):
    teams = {}
    for standing in payload.get("standings", []):
        for row in standing.get("rows", []):
            team = row.get("team") or {}
            if team.get("id") and team.get("name"):
                teams[team["id"]] = {"id": team["id"], "name": team["name"]}
    return list(teams.values())


def main():
    seasons = get_json(f"/unique-tournament/{TOURNAMENT_ID}/seasons").get("seasons", [])
    season = next((item for item in seasons if "2026" in str(item.get("year") or item.get("name") or "")), None)
    if not season or not season.get("id"):
        raise RuntimeError("Primera Nacional 2026 season not found")

    standings = get_json(f"/unique-tournament/{TOURNAMENT_ID}/season/{season['id']}/standings/total")
    teams = standings_teams(standings)
    if len(teams) < 30:
        raise RuntimeError(f"Only {len(teams)} teams found in 2026 standings")

    output = {"seasonId": season["id"], "teams": []}
    for index, team in enumerate(teams):
        squad = get_json(f"/team/{team['id']}/players")
        players = []
        for entry in squad.get("players", []):
            player = entry.get("player") if isinstance(entry, dict) else None
            player = player or entry
            if not isinstance(player, dict) or not player.get("id") or not player.get("name"):
                continue
            players.append(player)
        output["teams"].append({**team, "players": players})
        if index < len(teams) - 1:
            time.sleep(0.06)

    json.dump(output, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
