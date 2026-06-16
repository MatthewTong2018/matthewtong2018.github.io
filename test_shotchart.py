import time
from nba_api.stats.endpoints import shotchartdetail

try:
    print("Testing shotchartdetail for team_id=0...")
    shots = shotchartdetail.ShotChartDetail(
        team_id=0,
        player_id=0,
        season_nullable="2023-24",
        context_measure_simple="FGA"
    ).get_data_frames()[0]
    
    print(f"Total shots found: {len(shots)}")
    print(shots["TEAM_ID"].unique())
except Exception as e:
    print(f"Error: {e}")
