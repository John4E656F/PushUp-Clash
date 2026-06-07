// Package router wires the HTTP routes together.
package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/john4e656f/pushupclash/backend/internal/auth"
	"github.com/john4e656f/pushupclash/backend/internal/handlers"
)

// New builds the application router.
func New(h *handlers.Handler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// Authenticated API surface.
	r.Route("/v1", func(r chi.Router) {
		r.Use(auth.Middleware)

		r.Route("/users", func(r chi.Router) {
			r.Post("/sync", h.SyncUser)
			r.Get("/me", h.Me)
		})

		r.Route("/workouts", func(r chi.Router) {
			r.Post("/", h.CreateWorkout)
			r.Get("/", h.ListWorkouts)
		})

		r.Route("/challenges", func(r chi.Router) {
			r.Get("/today", h.TodayChallenge)
			r.Post("/today/complete", h.CompleteTodayChallenge)
		})

		r.Get("/leaderboard", h.Leaderboard)

		r.Route("/battles", func(r chi.Router) {
			r.Post("/", h.CreateBattle)
			r.Get("/", h.ListBattles)
			r.Post("/{id}/submit", h.SubmitBattle)
		})

		r.Post("/media/upload-url", h.CreateUploadURL)
	})

	return r
}
