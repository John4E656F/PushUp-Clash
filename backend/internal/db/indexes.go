package db

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ensureIndexes creates the indexes the app relies on. Safe to run repeatedly.
func (d *DB) ensureIndexes(ctx context.Context) error {
	_, err := d.Users().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "clerkId", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "xp", Value: -1}}}, // leaderboard
		{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
	})
	if err != nil {
		return err
	}

	_, err = d.Workouts().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}},
	})
	if err != nil {
		return err
	}

	_, err = d.Challenges().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "date", Value: 1}}, Options: options.Index().SetUnique(true)},
	})
	if err != nil {
		return err
	}

	_, err = d.Battles().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "participants", Value: 1}, {Key: "status", Value: 1}}},
	})
	return err
}
