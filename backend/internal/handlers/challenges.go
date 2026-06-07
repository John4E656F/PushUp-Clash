package handlers

import (
	"context"
	"math/rand"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/john4e656f/pushupclash/backend/internal/gamify"
	"github.com/john4e656f/pushupclash/backend/internal/models"
)

// TodayChallenge returns (creating if necessary) today's daily challenge along
// with whether the authed user has already completed it.
func (h *Handler) TodayChallenge(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	ch, err := h.getOrCreateTodayChallenge(ctx)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load challenge")
		return
	}

	// "completed today" = a challenge-sourced workout exists for this user since UTC midnight.
	midnight := time.Now().UTC().Truncate(24 * time.Hour)
	count, _ := h.DB.Workouts().CountDocuments(ctx, bson.M{
		"userId":    u.ID,
		"source":    "challenge",
		"createdAt": bson.M{"$gte": midnight},
	})

	writeJSON(w, http.StatusOK, bson.M{
		"challenge": ch,
		"completed": count > 0,
	})
}

// CompleteTodayChallenge records a challenge-sourced workout and awards the
// challenge XP bonus on top of the per-rep XP.
func (h *Handler) CompleteTodayChallenge(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	var body struct {
		Reps        int `json:"reps"`
		DurationSec int `json:"durationSec"`
	}
	if err := decode(r, &body); err != nil || body.Reps <= 0 {
		writeErr(w, http.StatusBadRequest, "reps must be a positive integer")
		return
	}

	ch, err := h.getOrCreateTodayChallenge(ctx)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load challenge")
		return
	}
	if body.Reps < ch.TargetReps {
		writeErr(w, http.StatusBadRequest, "rep count is below today's target")
		return
	}

	now := time.Now().UTC()
	_, err = h.DB.Workouts().InsertOne(ctx, models.Workout{
		UserID:      u.ID,
		Reps:        body.Reps,
		DurationSec: body.DurationSec,
		Source:      "challenge",
		CreatedAt:   now,
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to save workout")
		return
	}

	newStreak := gamify.UpdateStreak(u.Streak, u.LastActiveAt, now)
	bestStreak := u.BestStreak
	if newStreak > bestStreak {
		bestStreak = newStreak
	}
	newXP := u.XP + body.Reps*gamify.XPPerRep + ch.XPReward
	newLevel := gamify.LevelFor(newXP)

	_, err = h.DB.Users().UpdateByID(ctx, u.ID, bson.M{
		"$set": bson.M{
			"xp": newXP, "level": newLevel, "streak": newStreak,
			"bestStreak": bestStreak, "lastActiveAt": now, "updatedAt": now,
		},
		"$inc": bson.M{"totalReps": body.Reps},
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to update stats")
		return
	}

	writeJSON(w, http.StatusOK, bson.M{
		"xp": newXP, "level": newLevel, "streak": newStreak,
		"xpEarned": body.Reps*gamify.XPPerRep + ch.XPReward,
	})
}

// getOrCreateTodayChallenge is idempotent thanks to the unique index on `date`.
func (h *Handler) getOrCreateTodayChallenge(ctx context.Context) (*models.Challenge, error) {
	date := time.Now().UTC().Format("2006-01-02")

	var ch models.Challenge
	err := h.DB.Challenges().FindOne(ctx, bson.M{"date": date}).Decode(&ch)
	if err == nil {
		return &ch, nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, err
	}

	// Generate a target that ramps with the day-of-year for a little variety.
	target := 20 + rand.Intn(31) // 20..50
	ch = models.Challenge{
		Date:       date,
		TargetReps: target,
		XPReward:   50,
		CreatedAt:  time.Now().UTC(),
	}
	opts := options.Update().SetUpsert(true)
	_, err = h.DB.Challenges().UpdateOne(ctx, bson.M{"date": date}, bson.M{"$setOnInsert": ch}, opts)
	if err != nil {
		return nil, err
	}
	// Re-read to get the canonical document (handles the race where another
	// request inserted first).
	if err := h.DB.Challenges().FindOne(ctx, bson.M{"date": date}).Decode(&ch); err != nil {
		return nil, err
	}
	return &ch, nil
}
