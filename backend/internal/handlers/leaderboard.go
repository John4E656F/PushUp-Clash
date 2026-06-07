package handlers

import (
	"net/http"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// leaderboardEntry is the trimmed public view of a user for ranking lists.
type leaderboardEntry struct {
	Rank      int    `json:"rank"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatarUrl"`
	XP        int    `json:"xp"`
	Level     int    `json:"level"`
	Streak    int    `json:"streak"`
	TotalReps int    `json:"totalReps"`
}

// Leaderboard returns the top players globally, ranked by XP. Supports an
// optional ?limit= (default 50, max 100).
func (h *Handler) Leaderboard(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	limit := int64(50)
	opts := options.Find().
		SetSort(bson.D{{Key: "xp", Value: -1}}).
		SetLimit(limit).
		SetProjection(bson.M{
			"username": 1, "avatarUrl": 1, "xp": 1,
			"level": 1, "streak": 1, "totalReps": 1,
		})

	cur, err := h.DB.Users().Find(ctx, bson.M{}, opts)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load leaderboard")
		return
	}

	var rows []struct {
		Username  string `bson:"username"`
		AvatarURL string `bson:"avatarUrl"`
		XP        int    `bson:"xp"`
		Level     int    `bson:"level"`
		Streak    int    `bson:"streak"`
		TotalReps int    `bson:"totalReps"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to decode leaderboard")
		return
	}

	entries := make([]leaderboardEntry, 0, len(rows))
	for i, row := range rows {
		entries = append(entries, leaderboardEntry{
			Rank: i + 1, Username: row.Username, AvatarURL: row.AvatarURL,
			XP: row.XP, Level: row.Level, Streak: row.Streak, TotalReps: row.TotalReps,
		})
	}
	writeJSON(w, http.StatusOK, bson.M{"leaderboard": entries})
}
