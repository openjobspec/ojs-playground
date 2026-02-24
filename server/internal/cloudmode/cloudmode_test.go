package cloudmode

import (
	"testing"
	"time"
)

func TestProvisionAndGet(t *testing.T) {
	m := NewManager(Config{Enabled: true, CloudURL: "http://cloud:8081", TenantTTL: time.Hour})
	tenant, err := m.Provision("session-1")
	if err != nil {
		t.Fatalf("Provision: %v", err)
	}
	if tenant.Endpoint != "http://cloud:8081" {
		t.Errorf("expected cloud endpoint, got %s", tenant.Endpoint)
	}

	got, ok := m.Get("session-1")
	if !ok {
		t.Fatal("expected to find tenant")
	}
	if got.ID != tenant.ID {
		t.Errorf("expected %s, got %s", tenant.ID, got.ID)
	}
}

func TestExpiredTenant(t *testing.T) {
	m := NewManager(Config{Enabled: true, CloudURL: "http://cloud:8081", TenantTTL: time.Millisecond})
	m.Provision("session-1")
	time.Sleep(10 * time.Millisecond)

	_, ok := m.Get("session-1")
	if ok {
		t.Error("expected expired tenant to not be found")
	}
}

func TestMaxTenants(t *testing.T) {
	m := NewManager(Config{Enabled: true, CloudURL: "http://cloud:8081", MaxTenants: 2, TenantTTL: time.Hour})
	m.Provision("s1")
	m.Provision("s2")
	_, err := m.Provision("s3")
	if err == nil {
		t.Error("expected error when max tenants reached")
	}
}

func TestMaxTenantsWithCleanup(t *testing.T) {
	m := NewManager(Config{Enabled: true, CloudURL: "http://cloud:8081", MaxTenants: 2, TenantTTL: time.Millisecond})
	m.Provision("s1")
	m.Provision("s2")
	time.Sleep(10 * time.Millisecond) // let them expire

	_, err := m.Provision("s3")
	if err != nil {
		t.Errorf("expected cleanup to free slot: %v", err)
	}
}

func TestRevoke(t *testing.T) {
	m := NewManager(Config{Enabled: true, CloudURL: "http://cloud:8081"})
	m.Provision("s1")
	m.Revoke("s1")
	_, ok := m.Get("s1")
	if ok {
		t.Error("expected revoked tenant to not be found")
	}
}

func TestIsEnabled(t *testing.T) {
	m1 := NewManager(Config{Enabled: false})
	if m1.IsEnabled() {
		t.Error("expected disabled")
	}
	m2 := NewManager(Config{Enabled: true, CloudURL: ""})
	if m2.IsEnabled() {
		t.Error("expected disabled without URL")
	}
	m3 := NewManager(Config{Enabled: true, CloudURL: "http://cloud:8081"})
	if !m3.IsEnabled() {
		t.Error("expected enabled")
	}
}

func TestActiveCount(t *testing.T) {
	m := NewManager(Config{Enabled: true, CloudURL: "http://cloud:8081", TenantTTL: time.Hour})
	m.Provision("s1")
	m.Provision("s2")
	if m.ActiveCount() != 2 {
		t.Errorf("expected 2 active, got %d", m.ActiveCount())
	}
}
