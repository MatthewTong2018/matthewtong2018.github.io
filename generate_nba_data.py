import os
import time
import json
import pandas as pd
import numpy as np
from nba_api.stats.endpoints import leaguegamelog, shotchartdetail, leaguedashplayerstats
from nba_api.stats.static import teams

DATA_DIR = os.path.join("c:\\Users\\Matthew\\githubBlog\\matthewtong.github.io", "nba_data")

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

all_teams = teams.get_teams()
with open(os.path.join(DATA_DIR, "teams.json"), "w") as f:
    json.dump(all_teams, f)
print("Saved teams.json")

seasons = [f"{year}-{str(year+1)[2:]}" for year in range(1973, 2026)]

all_gamelogs = []

for season in seasons:
    print(f"Fetching game logs for season {season}...")
    try:
        time.sleep(0.8)
        log = leaguegamelog.LeagueGameLog(season=season, player_or_team_abbreviation="T").get_data_frames()[0]
        if log.empty:
            print(f"Season {season} is empty.")
            continue
            
        if "OREB" not in log.columns:
            log["OREB"] = 11.0
        if "DREB" not in log.columns:
            log["DREB"] = 29.0
        if "TOV" not in log.columns:
            log["TOV"] = 14.0
            
        log["OREB"] = pd.to_numeric(log["OREB"], errors="coerce").fillna(11.0)
        log["DREB"] = pd.to_numeric(log["DREB"], errors="coerce").fillna(29.0)
        log["TOV"] = pd.to_numeric(log["TOV"], errors="coerce").fillna(14.0)
        log["PTS"] = pd.to_numeric(log["PTS"], errors="coerce").fillna(0.0)
        log["FGA"] = pd.to_numeric(log["FGA"], errors="coerce").fillna(0.0)
        log["FTA"] = pd.to_numeric(log["FTA"], errors="coerce").fillna(0.0)
        
        df_opp = log.rename(columns=lambda x: f"OPP_{x}" if x not in ["GAME_ID", "GAME_DATE"] else x)
        merged = log.merge(df_opp, on=["GAME_ID", "GAME_DATE"])
        merged = merged[merged["TEAM_ID"] != merged["OPP_TEAM_ID"]]
        
        merged["POSS"] = merged["FGA"] + 0.44 * merged["FTA"] - merged["OREB"] + merged["TOV"]
        merged["OPP_POSS"] = merged["OPP_FGA"] + 0.44 * merged["OPP_FTA"] - merged["OPP_OREB"] + merged["OPP_TOV"]
        merged["PACE"] = (merged["POSS"] + merged["OPP_POSS"]) / 2.0
        merged["PACE"] = merged["PACE"].replace(0, 1)
        merged.loc[merged["PACE"] < 50, "PACE"] = 100.0
        
        merged["OFF_RTG"] = (merged["PTS"] / merged["PACE"]) * 100.0
        merged["DEF_RTG"] = (merged["OPP_PTS"] / merged["PACE"]) * 100.0
        merged["NET_RTG"] = merged["OFF_RTG"] - merged["DEF_RTG"]
        
        team_season_stats = merged.groupby("TEAM_ID").agg({
            "PTS": "sum",
            "OPP_PTS": "sum",
            "PACE": "mean"
        }).reset_index()
        
        team_season_stats = team_season_stats.rename(columns={
            "PTS": "SEASON_PTS",
            "OPP_PTS": "SEASON_OPP_PTS",
            "PACE": "SEASON_PACE"
        })
        
        team_season_stats["SEASON_OFF_RTG"] = (team_season_stats["SEASON_PTS"] / (team_season_stats["SEASON_PACE"] * 82)) * 100.0
        team_season_stats["SEASON_DEF_RTG"] = (team_season_stats["SEASON_OPP_PTS"] / (team_season_stats["SEASON_PACE"] * 82)) * 100.0
        
        merged = merged.merge(team_season_stats, on="TEAM_ID", how="left")
        
        opp_season_stats = team_season_stats.rename(columns=lambda x: f"OPP_{x}" if x != "TEAM_ID" else "OPP_TEAM_ID")
        merged = merged.merge(opp_season_stats, on="OPP_TEAM_ID", how="left")
        
        merged["SEASON"] = season
        merged["GAME_DATE"] = merged["GAME_DATE"].astype(str)
        
        compact_cols = [
            "SEASON", "TEAM_ID", "GAME_ID", "GAME_DATE", "MATCHUP", "WL", 
            "PTS", "OPP_PTS", "PACE", "OFF_RTG", "DEF_RTG", "NET_RTG",
            "OPP_SEASON_DEF_RTG", "OPP_TEAM_ABBREVIATION"
        ]
        all_gamelogs.append(merged[compact_cols])
            
    except Exception as e:
        print(f"Error for season {season}: {e}")

if all_gamelogs:
    df_all_logs = pd.concat(all_gamelogs, ignore_index=True)
    logs_dict = df_all_logs.to_dict(orient="records")
    with open(os.path.join(DATA_DIR, "all_gamelogs.json"), "w") as f:
        json.dump(logs_dict, f)
    print("Saved all gamelogs.")

for season in seasons:
    year = int(season.split("-")[0])
    if year < 1996:
        continue
        
    print(f"Fetching shot chart for season {season}...")
    try:
        time.sleep(1.0)
        shots = shotchartdetail.ShotChartDetail(
            team_id=0,
            player_id=0,
            season_nullable=season,
            context_measure_simple="FGA"
        ).get_data_frames()[0]
        
        if not shots.empty:
            shots["LOC_X"] = pd.to_numeric(shots["LOC_X"], errors="coerce")
            shots["LOC_Y"] = pd.to_numeric(shots["LOC_Y"], errors="coerce")
            shots = shots.dropna(subset=["LOC_X", "LOC_Y"])
            shots = shots[shots["LOC_Y"] < 420]
            
            compact_shots = shots[[
                "TEAM_ID", "LOC_X", "LOC_Y", "SHOT_MADE_FLAG", "SHOT_DISTANCE"
            ]].copy()
            
            compact_shots["LOC_X"] = compact_shots["LOC_X"].round().astype(int)
            compact_shots["LOC_Y"] = compact_shots["LOC_Y"].round().astype(int)
            
            shots_dict = compact_shots.to_dict(orient="records")
            with open(os.path.join(DATA_DIR, f"shots_{season}.json"), "w") as f:
                json.dump(shots_dict, f)
            print(f"Saved shots for season {season}.")
    except Exception as e:
        print(f"Error fetching shots for {season}: {e}")
        
    print(f"Fetching player stats for {season}...")
    try:
        time.sleep(1.0)
        stats = leaguedashplayerstats.LeagueDashPlayerStats(season=season).get_data_frames()[0]
        if not stats.empty:
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
            print(f"Saved player stats for season {season}.")
    except Exception as e:
        print(f"Error fetching player stats for {season}: {e}")
