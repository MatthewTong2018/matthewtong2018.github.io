import os
import time
import json
import pandas as pd
from nba_api.stats.endpoints import leaguedashplayerstats

DATA_DIR = os.path.join("c:\\Users\\Matthew\\githubBlog\\matthewtong.github.io", "nba_data")

seasons = [f"{year}-{str(year+1)[2:]}" for year in range(1973, 1996)]

for season in seasons:
    print(f"Fetching player stats for {season}...")
    try:
        time.sleep(0.5)
        stats = leaguedashplayerstats.LeagueDashPlayerStats(season=season).get_data_frames()[0]
        
        if stats.empty:
            continue
            
        cols_to_keep = [
            "PLAYER_ID", "PLAYER_NAME", "TEAM_ID", "AGE", "GP", 
            "MIN", "FGM", "FGA", "FG_PCT", "FG3M", "FG3A", "FG3_PCT",
            "FTM", "FTA", "FT_PCT", "OREB", "DREB", "REB", "AST", 
            "TOV", "STL", "BLK", "PTS", "PF"
        ]
        
        compact_stats = stats[cols_to_keep].copy()
        
        stats_dict = compact_stats.to_dict(orient="records")
        with open(os.path.join(DATA_DIR, f"player_stats_{season}.json"), "w") as f:
            json.dump(stats_dict, f)
            
    except Exception as e:
        print(f"Error fetching player stats for {season}: {e}")
