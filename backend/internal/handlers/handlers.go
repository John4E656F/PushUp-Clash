// Package handlers implements the HTTP handlers for the PushupClash API.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/john4e656f/pushupclash/backend/internal/auth"
	"github.com/john4e656f/pushupclash/backend/internal/db"
	"github.com/john4e656f/pushupclash/backend/internal/models"
	"github.com/john4e656f/pushupclash/backend/internal/storage"
)

// Handler bundles the dependencies every route needs.
type Handler struct {
	DB      *db.DB
	Storage *storage.Client
}

func New(database *db.DB, store *storage.Client) *Handler {
	return &Handler{DB: database, Storage: store}
}

// currentUser loads the authed user (by Clerk id) from Mongo.
func (h *Handler) currentUser(ctx context.Context) (*models.User, error) {
	clerkID, ok := auth.ClerkUserID(ctx)
	if !ok {
		return nil, errUnauthorized
	}
	var u models.User
	err := h.DB.Users().FindOne(ctx, bson.M{"clerkId": clerkID}).Decode(&u)
	if err == mongo.ErrNoDocuments {
		return nil, errUserNotSynced
	}
	return &u, err
}

// --- response helpers -------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// reqCtx returns a request-scoped context with a sane default timeout.
func reqCtx(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 8*time.Second)
}
