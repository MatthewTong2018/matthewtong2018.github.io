import os
import time
import json
import pandas as pd
from nba_api.stats.endpoints import shotchartdetail

CELTICS_TEAM_ID = 1610612738
DATA_DIR = os.path.join("c:\\Users\\Matthew\\githubBlog\\matthewtong.github.io", "nba_data")

seasons = [f"{year}-{str(year+1)[2:]}" for year in range(1996, 2025)]

for season in seasons:
    filename = f"celtics_shots_{season}.json"
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        print(f"Already have {season}, skipping.")
        continue
        
    print(f"Fetching missing shot chart for season {season}...")
    try:
        time.sleep(1.2)
        shots = shotchartdetail.ShotChartDetail(
            team_id=CELTICS_TEAM_ID,
            player_id=0,
            season_nullable=season,
            context_measure_simple="FGA"
        ).get_data_frames()[0]
        
        if shots.empty:
            print(f"No shots for season {season}")
            continue
            
        shots["LOC_X"] = pd.to_numeric(shots["LOC_X"], errors="coerce")
        shots["LOC_Y"] = pd.to_numeric(shots["LOC_Y"], errors="coerce")
        shots = shots.dropna(subset=["LOC_X", "LOC_Y"])
        shots = shots[shots["LOC_Y"] < 420]
        
        compact_shots = shots[[
            "LOC_X", "LOC_Y", "SHOT_MADE_FLAG", "SHOT_DISTANCE", "PLAYER_NAME"
        ]].copy()
        
        shots_dict = compact_shots.to_dict(orient="records")
        with open(filepath, "w") as f:
            json.dump(shots_dict, f)
        print(f"Saved shots for season {season}.")
        
    except Exception as e:
        print(f"Error fetching shots for {season}: {e}")
