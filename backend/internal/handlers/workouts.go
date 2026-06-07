package handlers

import (
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/john4e656f/pushupclash/backend/internal/gamify"
	"github.com/john4e656f/pushupclash/backend/internal/models"
)

type createWorkoutRequest struct {
	Reps        int    `json:"reps"`
	DurationSec int    `json:"durationSec"`
	Source      string `json:"source"` // "free" | "challenge" | "battle"
	ClipURL     string `json:"clipUrl"`
}

// CreateWorkout records a finished pushup session and rolls the user's XP,
// total reps, streak and level forward.
func (h *Handler) CreateWorkout(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	var body createWorkoutRequest
	if err := decode(r, &body); err != nil || body.Reps <= 0 {
		writeErr(w, http.StatusBadRequest, "reps must be a positive integer")
		return
	}
	if body.Source == "" {
		body.Source = "free"
	}

	now := time.Now().UTC()
	workout := models.Workout{
		UserID:      u.ID,
		Reps:        body.Reps,
		DurationSec: body.DurationSec,
		Source:      body.Source,
		ClipURL:     body.ClipURL,
		CreatedAt:   now,
	}
	res, err := h.DB.Workouts().InsertOne(ctx, workout)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to save workout")
		return
	}
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		workout.ID = oid
	}

	// Roll gamification stats.
	newStreak := gamify.UpdateStreak(u.Streak, u.LastActiveAt, now)
	bestStreak := u.BestStreak
	if newStreak > bestStreak {
		bestStreak = newStreak
	}
	newXP := u.XP + body.Reps*gamify.XPPerRep
	newLevel := gamify.LevelFor(newXP)

	update := bson.M{
		"$set": bson.M{
			"xp":           newXP,
			"level":        newLevel,
			"streak":       newStreak,
			"bestStreak":   bestStreak,
			"lastActiveAt": now,
			"updatedAt":    now,
		},
		"$inc": bson.M{"totalReps": body.Reps},
	}
	if _, err := h.DB.Users().UpdateByID(ctx, u.ID, update); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to update stats")
		return
	}

	writeJSON(w, http.StatusCreated, bson.M{
		"workout": workout,
		"xp":      newXP,
		"level":   newLevel,
		"streak":  newStreak,
		"xpToNextLevel": gamify.NextLevelXP(newXP) - newXP,
	})
}

// ListWorkouts returns the authed user's recent workouts, newest first.
func (h *Handler) ListWorkouts(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(50)
	cur, err := h.DB.Workouts().Find(ctx, bson.M{"userId": u.ID}, opts)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load workouts")
		return
	}
	var workouts []models.Workout
	if err := cur.All(ctx, &workouts); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to decode workouts")
		return
	}
	if workouts == nil {
		workouts = []models.Workout{}
	}
	writeJSON(w, http.StatusOK, bson.M{"workouts": workouts})
}
