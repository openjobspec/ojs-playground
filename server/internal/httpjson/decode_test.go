package httpjson

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeRejectsOversizedContentLength(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(strings.Repeat("x", 20)))
	req.ContentLength = 20
	err := Decode(httptest.NewRecorder(), req, &struct{}{}, 10, false)
	if err == nil || err.Status != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %#v", err)
	}
}

func TestDecodeRejectsOversizedChunkedBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", io.NopCloser(strings.NewReader(`{"name":"`+strings.Repeat("x", 128)+`"}`)))
	req.ContentLength = -1
	req.TransferEncoding = []string{"chunked"}
	var dst struct {
		Name string `json:"name"`
	}
	err := Decode(httptest.NewRecorder(), req, &dst, 32, false)
	if err == nil || err.Status != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected chunked body to return 413, got %#v", err)
	}
}

func TestDecodeRejectsUnknownAndTrailingFields(t *testing.T) {
	for name, body := range map[string]string{
		"unknown":  `{"name":"ok","extra":true}`,
		"trailing": `{"name":"ok"} {"name":"again"}`,
	} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
			var dst struct {
				Name string `json:"name"`
			}
			err := Decode(httptest.NewRecorder(), req, &dst, 1024, false)
			if err == nil || err.Status != http.StatusBadRequest {
				t.Fatalf("expected 400, got %#v", err)
			}
		})
	}
}

func TestDecodeLenientAllowsUnknownButRejectsTrailingValues(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"ok","extension":true}`))
	var dst struct {
		Name string `json:"name"`
	}
	if err := DecodeLenient(httptest.NewRecorder(), req, &dst, 1024, false); err != nil {
		t.Fatalf("expected unknown extension to be accepted, got %#v", err)
	}
	if dst.Name != "ok" {
		t.Fatalf("decoded name = %q, want ok", dst.Name)
	}

	trailing := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"ok"} {}`))
	if err := DecodeLenient(httptest.NewRecorder(), trailing, &dst, 1024, false); err == nil ||
		err.Status != http.StatusBadRequest {
		t.Fatalf("expected trailing value to return 400, got %#v", err)
	}
}

func TestClampPagination(t *testing.T) {
	limit, offset := ClampPagination(1_000_000, -10, 50, 200)
	if limit != 200 || offset != 0 {
		t.Fatalf("unexpected pagination: limit=%d offset=%d", limit, offset)
	}
}
