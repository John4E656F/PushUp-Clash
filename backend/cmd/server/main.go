// Command server is the PushupClash API entrypoint.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/john4e656f/pushupclash/backend/internal/auth"
	"github.com/john4e656f/pushupclash/backend/internal/config"
	"github.com/john4e656f/pushupclash/backend/internal/db"
	"github.com/john4e656f/pushupclash/backend/internal/handlers"
	"github.com/john4e656f/pushupclash/backend/internal/router"
	"github.com/john4e656f/pushupclash/backend/internal/storage"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Auth.
	auth.Init(cfg.ClerkSecretKey)

	// Database.
	database, err := db.Connect(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("startup: mongo connect failed: %v", err)
	}
	defer func() {
		shutdownCtx, c := context.WithTimeout(context.Background(), 5*time.Second)
		defer c()
		_ = database.Disconnect(shutdownCtx)
	}()

	// Media storage is optional in local dev; degrade gracefully if unset.
	var store *storage.Client
	if cfg.B2KeyID != "" && cfg.B2AppKey != "" && cfg.B2Bucket != "" {
		store, err = storage.New(ctx, cfg.B2Endpoint, cfg.B2Region, cfg.B2KeyID, cfg.B2AppKey, cfg.B2Bucket)
		if err != nil {
			log.Printf("startup: B2 storage init failed (media uploads disabled): %v", err)
		} else {
			log.Println("startup: Backblaze B2 storage ready")
		}
	} else {
		log.Println("startup: B2 not configured, media uploads disabled")
	}

	h := handlers.New(database, store)
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router.New(h),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("startup: listening on :%s (env=%s)", cfg.Port, cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Graceful shutdown.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutdown: draining connections")

	shutdownCtx, c := context.WithTimeout(context.Background(), 10*time.Second)
	defer c()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
