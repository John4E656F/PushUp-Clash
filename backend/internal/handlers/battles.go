package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"github.com/john4e656f/pushupclash/backend/internal/models"
)

type createBattleRequest struct {
	OpponentUserID string `json:"opponentUserId"` // our internal user id
	TargetReps     int    `json:"targetReps"`
}

// CreateBattle opens a head-to-head duel between the authed user and an opponent.
func (h *Handler) CreateBattle(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	var body createBattleRequest
	if err := decode(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	opponentID, err := primitive.ObjectIDFromHex(body.OpponentUserID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid opponentUserId")
		return
	}
	if opponentID == u.ID {
		writeErr(w, http.StatusBadRequest, "you cannot battle yourself")
		return
	}
	if body.TargetReps <= 0 {
		body.TargetReps = 30
	}

	now := time.Now().UTC()
	battle := models.Battle{
		Participants: []primitive.ObjectID{u.ID, opponentID},
		Entries: []models.BattleEntry{
			{UserID: u.ID}, {UserID: opponentID},
		},
		TargetReps: body.TargetReps,
		Status:     models.BattlePending,
		CreatedBy:  u.ID,
		CreatedAt:  now,
		ExpiresAt:  now.Add(24 * time.Hour),
	}
	res, err := h.DB.Battles().InsertOne(ctx, battle)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to create battle")
		return
	}
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		battle.ID = oid
	}
	writeJSON(w, http.StatusCreated, battle)
}

// ListBattles returns battles the authed user participates in, newest first.
func (h *Handler) ListBattles(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	cur, err := h.DB.Battles().Find(ctx, bson.M{"participants": u.ID})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load battles")
		return
	}
	var battles []models.Battle
	if err := cur.All(ctx, &battles); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to decode battles")
		return
	}
	if battles == nil {
		battles = []models.Battle{}
	}
	writeJSON(w, http.StatusOK, bson.M{"battles": battles})
}

type submitBattleRequest struct {
	Reps int `json:"reps"`
}

// SubmitBattle records the authed user's result for a battle and resolves the
// winner once both participants have submitted.
func (h *Handler) SubmitBattle(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	battleID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid battle id")
		return
	}

	var body submitBattleRequest
	if err := decode(r, &body); err != nil || body.Reps < 0 {
		writeErr(w, http.StatusBadRequest, "invalid reps")
		return
	}

	var battle models.Battle
	err = h.DB.Battles().FindOne(ctx, bson.M{"_id": battleID, "participants": u.ID}).Decode(&battle)
	if err != nil {
		writeErr(w, http.StatusNotFound, "battle not found")
		return
	}
	if battle.Status == models.BattleComplete {
		writeErr(w, http.StatusConflict, "battle already complete")
		return
	}

	now := time.Now().UTC()
	for i := range battle.Entries {
		if battle.Entries[i].UserID == u.ID {
			battle.Entries[i].Reps = body.Reps
			battle.Entries[i].SubmittedAt = &now
		}
	}

	// Become active once anyone submits; resolve once everyone has.
	battle.Status = models.BattleActive
	if allSubmitted(battle.Entries) {
		battle.Status = models.BattleComplete
		battle.WinnerID = decideWinner(battle.Entries)
	}

	_, err = h.DB.Battles().UpdateByID(ctx, battleID, bson.M{
		"$set": bson.M{
			"entries":  battle.Entries,
			"status":   battle.Status,
			"winnerId": battle.WinnerID,
		},
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to submit result")
		return
	}
	writeJSON(w, http.StatusOK, battle)
}

func allSubmitted(entries []models.BattleEntry) bool {
	for _, e := range entries {
		if e.SubmittedAt == nil {
			return false
		}
	}
	return true
}

// decideWinner returns the user id with the most reps, or nil on a tie.
func decideWinner(entries []models.BattleEntry) *primitive.ObjectID {
	if len(entries) < 2 {
		return nil
	}
	best := entries[0]
	tie := false
	for _, e := range entries[1:] {
		switch {
		case e.Reps > best.Reps:
			best = e
			tie = false
		case e.Reps == best.Reps:
			tie = true
		}
	}
	if tie {
		return nil
	}
	id := best.UserID
	return &id
}
