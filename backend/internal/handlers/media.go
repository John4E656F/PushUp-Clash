package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

type uploadURLRequest struct {
	// Kind is "clip" or "avatar"; it selects the object key prefix.
	Kind        string `json:"kind"`
	ContentType string `json:"contentType"`
	Ext         string `json:"ext"` // e.g. "mp4", "jpg"
}

// CreateUploadURL hands the client a short-lived presigned Backblaze B2 PUT URL
// so the app can upload a workout clip or avatar directly to storage.
func (h *Handler) CreateUploadURL(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := reqCtx(r)
	defer cancel()

	if h.Storage == nil {
		writeErr(w, http.StatusServiceUnavailable, "media storage not configured")
		return
	}

	u, err := h.currentUser(ctx)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	var body uploadURLRequest
	if err := decode(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	kind := body.Kind
	if kind != "clip" && kind != "avatar" {
		kind = "clip"
	}
	if body.ContentType == "" {
		body.ContentType = "application/octet-stream"
	}
	ext := strings.TrimPrefix(body.Ext, ".")
	if ext == "" {
		ext = "bin"
	}

	key := fmt.Sprintf("%s/%s/%d.%s", kind, u.ID.Hex(), time.Now().UnixNano(), ext)
	uploadURL, publicURL, err := h.Storage.PresignedUpload(ctx, key, body.ContentType, 10*time.Minute)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to create upload url")
		return
	}

	writeJSON(w, http.StatusOK, bson.M{
		"uploadUrl": uploadURL,
		"publicUrl": publicURL,
		"key":       key,
		"expiresIn": 600,
	})
}
