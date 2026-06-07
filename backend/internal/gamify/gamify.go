// Package gamify holds the XP / level / streak rules so they live in one place.
package gamify

import "time"

// XPPerRep is the base XP awarded for each counted rep.
const XPPerRep = 2

// LevelFor returns the level for a given XP total. Levels get progressively
// more expensive: level N requires 100 * N * (N-1) / 2 cumulative XP.
func LevelFor(xp int) int {
	level := 1
	for xp >= xpForLevel(level+1) {
		level++
	}
	return level
}

func xpForLevel(level int) int {
	return 100 * level * (level - 1) / 2
}

// NextLevelXP returns the cumulative XP needed to reach the next level.
func NextLevelXP(xp int) int {
	return xpForLevel(LevelFor(xp) + 1)
}

// UpdateStreak returns the new streak count given the previous activity day.
// A streak increments when the user is active on consecutive UTC days, resets
// to 1 after a gap, and is unchanged for same-day repeats.
func UpdateStreak(current int, lastActive *time.Time, now time.Time) int {
	if lastActive == nil {
		return 1
	}
	last := lastActive.UTC().Truncate(24 * time.Hour)
	today := now.UTC().Truncate(24 * time.Hour)

	switch days := int(today.Sub(last).Hours() / 24); {
	case days == 0:
		return current // already counted today
	case days == 1:
		return current + 1
	default:
		return 1 // missed a day, streak resets
	}
}
