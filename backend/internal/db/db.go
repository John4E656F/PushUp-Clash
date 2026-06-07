package db

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DB wraps the Mongo client and the application database handle.
type DB struct {
	Client *mongo.Client
	DB     *mongo.Database
}

// Connect dials MongoDB and verifies the connection with a ping.
func Connect(ctx context.Context, uri, name string) (*DB, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}
	log.Printf("db: connected to mongo database %q", name)

	d := &DB{Client: client, DB: client.Database(name)}
	if err := d.ensureIndexes(ctx); err != nil {
		return nil, err
	}
	return d, nil
}

// Collections used across the app.
func (d *DB) Users() *mongo.Collection      { return d.DB.Collection("users") }
func (d *DB) Workouts() *mongo.Collection   { return d.DB.Collection("workouts") }
func (d *DB) Challenges() *mongo.Collection { return d.DB.Collection("challenges") }
func (d *DB) Battles() *mongo.Collection    { return d.DB.Collection("battles") }

// Disconnect closes the underlying client.
func (d *DB) Disconnect(ctx context.Context) error {
	return d.Client.Disconnect(ctx)
}
