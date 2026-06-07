package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User is a PushupClash player. Identity is owned by Clerk; we mirror the
// profile and own all the gameplay stats.
type User struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ClerkID   string             `bson:"clerkId" json:"clerkId"`
	Username  string             `bson:"username,omitempty" json:"username"`
	Email     string             `bson:"email,omitempty" json:"email"`
	AvatarURL string             `bson:"avatarUrl,omitempty" json:"avatarUrl"`

	// Gamification
	XP           int        `bson:"xp" json:"xp"`
	Level        int        `bson:"level" json:"level"`
	TotalReps    int        `bson:"totalReps" json:"totalReps"`
	Streak       int        `bson:"streak" json:"streak"`
	BestStreak   int        `bson:"bestStreak" json:"bestStreak"`
	LastActiveAt *time.Time `bson:"lastActiveAt,omitempty" json:"lastActiveAt,omitempty"`
	Badges       []string   `bson:"badges" json:"badges"`

	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time `bson:"updatedAt" json:"updatedAt"`
}

// Workout is a single completed pushup session counted by the on-device AI.
type Workout struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	Reps        int                `bson:"reps" json:"reps"`
	DurationSec int                `bson:"durationSec" json:"durationSec"`
	Source      string             `bson:"source" json:"source"` // "free", "challenge", "battle"
	BattleID    *primitive.ObjectID `bson:"battleId,omitempty" json:"battleId,omitempty"`
	ClipURL     string             `bson:"clipUrl,omitempty" json:"clipUrl,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
}

// Challenge is the daily challenge. One document per calendar day (UTC).
type Challenge struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Date       string             `bson:"date" json:"date"` // "2006-01-02"
	TargetReps int                `bson:"targetReps" json:"targetReps"`
	XPReward   int                `bson:"xpReward" json:"xpReward"`
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
}

// BattleStatus enumerates the lifecycle of a duel.
type BattleStatus string

const (
	BattlePending  BattleStatus = "pending"  // invited, not yet accepted
	BattleActive   BattleStatus = "active"   // both in, counting
	BattleComplete BattleStatus = "complete" // resolved
)

// BattleEntry is one participant's result within a battle.
type BattleEntry struct {
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	Reps        int                `bson:"reps" json:"reps"`
	SubmittedAt *time.Time         `bson:"submittedAt,omitempty" json:"submittedAt,omitempty"`
}

// Battle is a head-to-head pushup duel between two users.
type Battle struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Participants []primitive.ObjectID `bson:"participants" json:"participants"`
	Entries      []BattleEntry        `bson:"entries" json:"entries"`
	TargetReps   int                  `bson:"targetReps" json:"targetReps"`
	Status       BattleStatus         `bson:"status" json:"status"`
	WinnerID     *primitive.ObjectID  `bson:"winnerId,omitempty" json:"winnerId,omitempty"`
	CreatedBy    primitive.ObjectID   `bson:"createdBy" json:"createdBy"`
	CreatedAt    time.Time            `bson:"createdAt" json:"createdAt"`
	ExpiresAt    time.Time            `bson:"expiresAt" json:"expiresAt"`
}
