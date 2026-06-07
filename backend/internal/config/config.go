package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration loaded from the environment.
type Config struct {
	Port string
	Env  string

	MongoURI string
	MongoDB  string

	ClerkSecretKey string

	B2Endpoint string
	B2Region   string
	B2KeyID    string
	B2AppKey   string
	B2Bucket   string
}

// Load reads configuration from a .env file (if present) and the environment.
func Load() *Config {
	// .env is optional; in production the values come from the real environment.
	if err := godotenv.Load(); err != nil {
		log.Println("config: no .env file found, relying on environment")
	}

	cfg := &Config{
		Port:           get("PORT", "8080"),
		Env:            get("ENV", "development"),
		MongoURI:       get("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:        get("MONGO_DB", "pushupclash"),
		ClerkSecretKey: get("CLERK_SECRET_KEY", ""),
		B2Endpoint:     get("B2_ENDPOINT", ""),
		B2Region:       get("B2_REGION", "us-west-004"),
		B2KeyID:        get("B2_KEY_ID", ""),
		B2AppKey:       get("B2_APP_KEY", ""),
		B2Bucket:       get("B2_BUCKET", ""),
	}

	if cfg.ClerkSecretKey == "" {
		log.Println("config: WARNING CLERK_SECRET_KEY is empty — auth will reject all requests")
	}
	return cfg
}

func get(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
