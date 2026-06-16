import os
import time
import json
import pandas as pd
import numpy as np
from nba_api.stats.endpoints import leaguegamelog

DATA_DIR = os.path.join("c:\\Users\\Matthew\\githubBlog\\matthewtong.github.io", "nba_data")
seasons = [f"{year}-{str(year+1)[2:]}" for year in range(1973, 1996)]

for season in seasons:
    print(f"Fetching player gamelogs to aggregate for {season}...")
    try:
        time.sleep(1.0)
        logs = leaguegamelog.LeagueGameLog(season=season, player_or_team_abbreviation="P").get_data_frames()[0]
        if logs.empty:
            continue
            
        # Group by Player to aggregate stats
        # Convert necessary cols to numeric
        numeric_cols = ["MIN", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB", "AST", "TOV", "STL", "BLK", "PTS", "PF"]
        for col in numeric_cols:
            if col in logs.columns:
                logs[col] = pd.to_numeric(logs[col], errors="coerce").fillna(0)
            else:
                logs[col] = 0.0

        # Custom aggregation
        agg_funcs = {
            "PLAYER_NAME": "first",
            "TEAM_ID": "last", # Player might play for multiple teams, use the last one
            "GAME_ID": "count", # This is GP
        }
        for col in numeric_cols:
            agg_funcs[col] = "sum"

        grouped = logs.groupby("PLAYER_ID").agg(agg_funcs).reset_index()
        grouped = grouped.rename(columns={"GAME_ID": "GP"})
        
        # Calculate percentages
        grouped["FG_PCT"] = np.where(grouped["FGA"] > 0, grouped["FGM"] / grouped["FGA"], 0)
        grouped["FG3_PCT"] = np.where(grouped["FG3A"] > 0, grouped["FG3M"] / grouped["FG3A"], 0)
        grouped["FT_PCT"] = np.where(grouped["FTA"] > 0, grouped["FTM"] / grouped["FTA"], 0)
        
        # Set AGE to 0 since gamelog doesn't have it
        grouped["AGE"] = "-"
        
        cols_to_keep = [
            "PLAYER_ID", "PLAYER_NAME", "TEAM_ID", "AGE", "GP", 
            "MIN", "FGM", "FGA", "FG_PCT", "FG3M", "FG3A", "FG3_PCT",
            "FTM", "FTA", "FT_PCT", "OREB", "DREB", "REB", "AST", 
            "TOV", "STL", "BLK", "PTS", "PF"
        ]
        
        # ensure all columns exist
        for col in cols_to_keep:
            if col not in grouped.columns:
                grouped[col] = 0
                
        final_df = grouped[cols_to_keep]
        
        stats_dict = final_df.to_dict(orient="records")
        out_path = os.path.join(DATA_DIR, f"player_stats_{season}.json")
        with open(out_path, "w") as f:
            json.dump(stats_dict, f)
        print(f"Saved {out_path}")
            
    except Exception as e:
        print(f"Error fetching stats for {season}: {e}")
