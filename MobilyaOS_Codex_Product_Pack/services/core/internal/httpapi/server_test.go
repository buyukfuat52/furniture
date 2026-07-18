package httpapi

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/buyukfuat52/furniture/services/core/internal/app"
)

func TestHealth(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	response := httptest.NewRecorder()

	server.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"status":"ok"`)) {
		t.Fatalf("expected ok health response, got %s", response.Body.String())
	}
}

func TestProjectsRequireBearerToken(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	request := httptest.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	response := httptest.NewRecorder()

	server.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", response.Code)
	}
}

func TestListProjectsWithDemoToken(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	request := httptest.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	request.Header.Set("Authorization", "Bearer demo-sales-token")
	response := httptest.NewRecorder()

	server.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte("Demo Vestiyer Projesi")) {
		t.Fatalf("expected seeded project, got %s", response.Body.String())
	}
}

func TestWardrobeVerticalSlice(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	token := loginForTest(t, server)

	customer := postJSONForTest(t, server, token, "/api/v1/customers", map[string]any{
		"name":  "Ayse Yilmaz",
		"email": "ayse@example.local",
	})
	customerID := stringValue(t, customer, "id")

	project := postJSONForTest(t, server, token, "/api/v1/projects", map[string]any{
		"customer_id": customerID,
		"name":        "Ayse Yilmaz Vestiyer",
	})
	projectID := stringValue(t, project, "id")

	revision := postJSONForTest(t, server, token, "/api/v1/revisions/wardrobe", map[string]any{
		"project_id":    projectID,
		"quantity":      2,
		"width_mm":      1800,
		"height_mm":     2200,
		"depth_mm":      600,
		"material_sku":  "PNL-MDF-18-BEYAZ",
		"edge_band_sku": "EDGE-PVC-22-BEYAZ",
		"shelf_count":   3,
		"door_count":    3,
		"markup_bps":    2500,
		"vat_bps":       2000,
	})
	revisionID := stringValue(t, revision, "id")
	if got := intValue(t, revision, "revision_number"); got != 1 {
		t.Fatalf("expected revision number 1, got %d", got)
	}
	cost := mapValue(t, revision, "cost")
	if got := intValue(t, cost, "grand_total", "amount_minor"); got != 1449151 {
		t.Fatalf("expected deterministic grand total 1449151, got %d", got)
	}
	if got := len(arrayValue(t, revision, "bom")); got != 6 {
		t.Fatalf("expected 6 BOM rows, got %d", got)
	}
	if got := len(arrayValue(t, revision, "edges")); got != 8 {
		t.Fatalf("expected 8 edge policy rows, got %d", got)
	}

	document := postJSONForTest(t, server, token, "/api/v1/revisions/"+revisionID+"/quote-document", map[string]any{})
	if got := stringValue(t, document, "content_type"); got != "text/html; charset=utf-8" {
		t.Fatalf("unexpected document content type %s", got)
	}
	if stringValue(t, document, "sha256") == "" {
		t.Fatalf("expected document hash")
	}
	html := stringValue(t, document, "html")
	if !bytes.Contains([]byte(html), []byte("Genel toplam: 14491.51 TRY")) {
		t.Fatalf("expected quote document total to match cost snapshot, got %s", html)
	}
	if bytes.Contains([]byte(html), []byte("unit_labor")) || bytes.Contains([]byte(html), []byte("edge_band")) || bytes.Contains([]byte(html), []byte("panels")) {
		t.Fatalf("customer quote document leaked internal cost categories: %s", html)
	}
	sum := sha256.Sum256([]byte(html))
	if got := stringValue(t, document, "sha256"); got != hex.EncodeToString(sum[:]) {
		t.Fatalf("expected sha256 to match HTML content")
	}
	if stringValue(t, document, "cost_snapshot_id") != stringValue(t, cost, "id") {
		t.Fatalf("expected document to reference the revision cost snapshot")
	}
	if stringValue(t, document, "cost_snapshot_hash") == "" {
		t.Fatalf("expected cost snapshot hash")
	}
	if stringValue(t, document, "cost_formula_version") != "wardrobe-cost-v1" {
		t.Fatalf("expected cost formula version")
	}

	fork := postJSONForTest(t, server, token, "/api/v1/revisions/"+revisionID+"/fork", map[string]any{
		"patch": map[string]any{"width_mm": 2000, "quantity": 3},
	})
	forkID := stringValue(t, fork, "id")
	if parent := stringValue(t, fork, "parent_revision_id"); parent != revisionID {
		t.Fatalf("expected parent revision %s, got %s", revisionID, parent)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/v1/revisions/"+revisionID+"/diff/"+forkID, nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected diff status 200, got %d body %s", response.Code, response.Body.String())
	}
	var diff map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &diff); err != nil {
		t.Fatal(err)
	}
	if got := len(arrayValue(t, diff, "entries")); got == 0 {
		t.Fatalf("expected diff entries")
	}
}

func TestTenantIsolationBlocksForeignCompanyProjectAccess(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	token := loginForTest(t, server)
	revision := createWardrobeRevisionForTest(t, server, token)
	revisionID := stringValue(t, revision, "id")
	projectID := stringValue(t, revision, "project_id")

	request := httptest.NewRequest(http.MethodGet, "/api/v1/revisions/"+revisionID, nil)
	request.Header.Set("Authorization", "Bearer foreign-sales-token")
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code == http.StatusOK {
		t.Fatalf("foreign company token accessed revision: %s", response.Body.String())
	}

	foreignCreate := httptest.NewRequest(http.MethodPost, "/api/v1/revisions/wardrobe", bytes.NewBufferString(`{
		"project_id":"`+projectID+`",
		"quantity":2,
		"width_mm":1800,
		"height_mm":2200,
		"depth_mm":600,
		"material_sku":"PNL-MDF-18-BEYAZ",
		"edge_band_sku":"EDGE-PVC-22-BEYAZ",
		"shelf_count":3,
		"door_count":3,
		"markup_bps":2500,
		"vat_bps":2000
	}`))
	foreignCreate.Header.Set("Authorization", "Bearer foreign-sales-token")
	foreignCreate.Header.Set("Idempotency-Key", "foreign-create")
	response = httptest.NewRecorder()
	server.ServeHTTP(response, foreignCreate)
	if response.Code == http.StatusCreated {
		t.Fatalf("foreign company token created revision for demo project: %s", response.Body.String())
	}
}

func TestViewerCannotGenerateQuoteDocument(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	token := loginForTest(t, server)
	revision := createWardrobeRevisionForTest(t, server, token)
	revisionID := stringValue(t, revision, "id")

	request := httptest.NewRequest(http.MethodPost, "/api/v1/revisions/"+revisionID+"/quote-document", bytes.NewBufferString(`{}`))
	request.Header.Set("Authorization", "Bearer demo-viewer-token")
	request.Header.Set("Idempotency-Key", "viewer-document")
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected viewer quote document status 403, got %d body %s", response.Code, response.Body.String())
	}
}

func TestApprovedRevisionCannotRegenerateDocument(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	token := loginForTest(t, server)
	revision := createWardrobeRevisionForTest(t, server, token)
	revisionID := stringValue(t, revision, "id")
	postJSONForTest(t, server, token, "/api/v1/revisions/"+revisionID+"/quote-document", map[string]any{})

	approved := postJSONForTest(t, server, token, "/api/v1/revisions/"+revisionID+"/approve", map[string]any{})
	if state := stringValue(t, approved, "state"); state != "approved" {
		t.Fatalf("expected approved state, got %s", state)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/v1/revisions/"+revisionID+"/quote-document", bytes.NewBufferString(`{}`))
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Idempotency-Key", "regenerate-approved-document")
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("expected approved revision document regeneration status 409, got %d body %s", response.Code, response.Body.String())
	}

	fork := postJSONForTest(t, server, token, "/api/v1/revisions/"+revisionID+"/fork", map[string]any{
		"patch": map[string]any{"width_mm": 1900},
	})
	if parent := stringValue(t, fork, "parent_revision_id"); parent != revisionID {
		t.Fatalf("expected approved revision fork parent %s, got %s", revisionID, parent)
	}
}

func TestLaborEdgeAndMoneyInvariants(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	token := loginForTest(t, server)
	revision := createWardrobeRevisionForTest(t, server, token)

	if got := totalMoneyMinor(t, arrayValue(t, revision, "labor")); got != 114000 {
		t.Fatalf("expected unit labor x quantity total 114000, got %d", got)
	}
	if got := totalBillableMM(t, arrayValue(t, revision, "edges")); got != 58571 {
		t.Fatalf("expected deterministic edge billable total 58571 mm, got %d", got)
	}
	cost := mapValue(t, revision, "cost")
	if got := intValue(t, cost, "grand_total", "amount_minor"); got != 1449151 {
		t.Fatalf("expected exact grand total 1449151 minor units, got %d", got)
	}
	if got := costCategoryMinor(t, arrayValue(t, cost, "categories"), "edge_band"); got != 70285 {
		t.Fatalf("expected edge band cost 70285 minor units, got %d", got)
	}
}

func TestMutatingEndpointsRequireIdempotencyKey(t *testing.T) {
	server := NewServer(app.NewDemoService(time.Now), slog.Default())
	token := loginForTest(t, server)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/customers", bytes.NewBufferString(`{"name":"No Key"}`))
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()

	server.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", response.Code)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte("missing_idempotency_key")) {
		t.Fatalf("expected missing idempotency error, got %s", response.Body.String())
	}
}

func loginForTest(t *testing.T, server *Server) string {
	t.Helper()
	return loginForTestAs(t, server, "satis@demo.local")
}

func loginForTestAs(t *testing.T, server *Server, email string) string {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"email":"`+email+`","password":"Demo1234!ChangeMe"}`))
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", response.Code, response.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	return stringValue(t, payload, "access_token")
}

func createWardrobeRevisionForTest(t *testing.T, server *Server, token string) map[string]any {
	t.Helper()
	customer := postJSONForTest(t, server, token, "/api/v1/customers", map[string]any{
		"name": "P4 Musteri",
	})
	project := postJSONForTest(t, server, token, "/api/v1/projects", map[string]any{
		"customer_id": stringValue(t, customer, "id"),
		"name":        "P4 Vestiyer",
	})
	return postJSONForTest(t, server, token, "/api/v1/revisions/wardrobe", map[string]any{
		"project_id":    stringValue(t, project, "id"),
		"quantity":      2,
		"width_mm":      1800,
		"height_mm":     2200,
		"depth_mm":      600,
		"material_sku":  "PNL-MDF-18-BEYAZ",
		"edge_band_sku": "EDGE-PVC-22-BEYAZ",
		"shelf_count":   3,
		"door_count":    3,
		"markup_bps":    2500,
		"vat_bps":       2000,
	})
}

func postJSONForTest(t *testing.T, server *Server, token string, path string, payload map[string]any) map[string]any {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", "test-key-"+path)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code < 200 || response.Code >= 300 {
		t.Fatalf("POST %s failed: %d %s", path, response.Code, response.Body.String())
	}
	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func stringValue(t *testing.T, payload map[string]any, path ...string) string {
	t.Helper()
	value := nestedValue(t, payload, path...)
	text, ok := value.(string)
	if !ok {
		t.Fatalf("expected string at %v, got %T", path, value)
	}
	return text
}

func intValue(t *testing.T, payload map[string]any, path ...string) int {
	t.Helper()
	value := nestedValue(t, payload, path...)
	number, ok := value.(float64)
	if !ok {
		t.Fatalf("expected number at %v, got %T", path, value)
	}
	return int(number)
}

func mapValue(t *testing.T, payload map[string]any, path ...string) map[string]any {
	t.Helper()
	value := nestedValue(t, payload, path...)
	mapped, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("expected object at %v, got %T", path, value)
	}
	return mapped
}

func arrayValue(t *testing.T, payload map[string]any, path ...string) []any {
	t.Helper()
	value := nestedValue(t, payload, path...)
	items, ok := value.([]any)
	if !ok {
		t.Fatalf("expected array at %v, got %T", path, value)
	}
	return items
}

func nestedValue(t *testing.T, payload map[string]any, path ...string) any {
	t.Helper()
	var current any = payload
	for _, segment := range path {
		mapped, ok := current.(map[string]any)
		if !ok {
			t.Fatalf("expected object before %s, got %T", segment, current)
		}
		current = mapped[segment]
	}
	if current == nil {
		t.Fatalf("missing value at %v", path)
	}
	return current
}

func totalMoneyMinor(t *testing.T, items []any) int {
	t.Helper()
	total := 0
	for _, item := range items {
		mapped, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("expected object in money list, got %T", item)
		}
		total += intValue(t, mapped, "total_cost", "amount_minor")
	}
	return total
}

func totalBillableMM(t *testing.T, items []any) int {
	t.Helper()
	total := 0
	for _, item := range items {
		mapped, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("expected object in edge list, got %T", item)
		}
		total += intValue(t, mapped, "billable_mm")
	}
	return total
}

func costCategoryMinor(t *testing.T, items []any, category string) int {
	t.Helper()
	for _, item := range items {
		mapped, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("expected object in cost category list, got %T", item)
		}
		if stringValue(t, mapped, "category") == category {
			return intValue(t, mapped, "amount", "amount_minor")
		}
	}
	t.Fatalf("missing cost category %s", category)
	return 0
}
