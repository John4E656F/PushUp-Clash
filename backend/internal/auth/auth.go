// Package auth verifies Clerk session JWTs and exposes the authed user via context.
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
)

type ctxKey string

const claimsKey ctxKey = "clerkClaims"

// Init configures the Clerk SDK with the secret key. Call once at startup.
func Init(secretKey string) {
	clerk.SetKey(secretKey)
}

// Middleware verifies the `Authorization: Bearer <jwt>` header against Clerk
// and stores the session claims in the request context. Unauthenticated
// requests are rejected with 401.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}

		claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{Token: token})
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ClerkUserID returns the Clerk user id ("sub") for the authed request.
func ClerkUserID(ctx context.Context) (string, bool) {
	claims, ok := ctx.Value(claimsKey).(*clerk.SessionClaims)
	if !ok || claims == nil {
		return "", false
	}
	return claims.Subject, true
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if h == "" {
		return ""
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
		return strings.TrimSpace(parts[1])
	}
	return ""
}
