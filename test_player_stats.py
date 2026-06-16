import time
from nba_api.stats.endpoints import leaguedashplayerstats

try:
    print("Testing leaguedashplayerstats for 1996-97...")
    stats = leaguedashplayerstats.LeagueDashPlayerStats(season="1996-97").get_data_frames()[0]
    print(f"1996-97 Players found: {len(stats)}")
except Exception as e:
    print(f"Error: {e}")
