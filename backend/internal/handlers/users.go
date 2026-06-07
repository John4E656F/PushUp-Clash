package handlers

import (
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/john4e656f/pushupclash/backend/internal/auth"
)

type syncUserRequest struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatarUrl"`
}

// SyncUser upserts the authed Clerk user into our users collection. Called by
// the mobile app right after sign-in so we always have a local profile row.
func (h *Handler) SyncUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	clerkID, ok := auth.ClerkUserID(ctx)
	if !ok {
		writeErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body syncUserRequest
	if err := decode(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}

	now := time.Now().UTC()
	// $setOnInsert seeds gameplay stats only on first sync; profile fields
	// from Clerk are refreshed every time.
	update := bson.M{
		"$set": bson.M{
			"username":  body.Username,
			"email":     body.Email,
			"avatarUrl": body.AvatarURL,
			"updatedAt": now,
		},
		"$setOnInsert": bson.M{
			"clerkId":    clerkID,
			"xp":         0,
			"level":      1,
			"totalReps":  0,
			"streak":     0,
			"bestStreak": 0,
			"badges":     []string{},
			"createdAt":  now,
		},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var updated bson.M
	err := h.DB.Users().FindOneAndUpdate(ctx, bson.M{"clerkId": clerkID}, update, opts).Decode(&updated)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to sync user")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// Me returns the authed user's full profile + stats.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, u)
}
