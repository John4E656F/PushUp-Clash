// Package storage wraps Backblaze B2 (S3-compatible) for media uploads such as
// workout clips and avatars. We hand the mobile client short-lived presigned
// PUT URLs so large media never streams through the API.
package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Client is a thin wrapper over the S3 client pointed at Backblaze B2.
type Client struct {
	s3       *s3.Client
	presign  *s3.PresignClient
	bucket   string
	endpoint string
}

// New builds a B2 client from credentials. endpoint is the B2 S3 endpoint,
// e.g. https://s3.us-west-004.backblazeb2.com
func New(ctx context.Context, endpoint, region, keyID, appKey, bucket string) (*Client, error) {
	if keyID == "" || appKey == "" || bucket == "" {
		return nil, fmt.Errorf("storage: missing B2 credentials or bucket")
	}

	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(keyID, appKey, ""),
		),
	)
	if err != nil {
		return nil, err
	}

	s3c := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true // B2 works most reliably with path-style addressing
	})

	return &Client{
		s3:       s3c,
		presign:  s3.NewPresignClient(s3c),
		bucket:   bucket,
		endpoint: endpoint,
	}, nil
}

// PresignedUpload returns a presigned PUT URL for the given object key plus the
// public URL the object will live at once uploaded.
func (c *Client) PresignedUpload(ctx context.Context, key, contentType string, ttl time.Duration) (uploadURL, publicURL string, err error) {
	req, err := c.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", "", err
	}
	public := fmt.Sprintf("%s/%s/%s", c.endpoint, c.bucket, key)
	return req.URL, public, nil
}
