package handlers

import "errors"

var (
	errUnauthorized  = errors.New("unauthorized")
	errUserNotSynced = errors.New("user not synced; call POST /v1/users/sync first")
)
