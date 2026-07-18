package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/buyukfuat52/furniture/services/core/internal/app"
	"github.com/buyukfuat52/furniture/services/core/internal/domain"
)

type Server struct {
	service *app.Service
	logger  *slog.Logger
	mux     *http.ServeMux
}

func NewServer(service *app.Service, logger *slog.Logger) *Server {
	server := &Server{
		service: service,
		logger:  logger,
		mux:     http.NewServeMux(),
	}
	server.routes()
	return server
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Frame-Options", "DENY")
	s.mux.ServeHTTP(w, r)
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /api/v1/health", s.handleHealth)
	s.mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	s.mux.HandleFunc("GET /api/v1/tenant/current", s.withTenant(s.handleTenantCurrent))
	s.mux.HandleFunc("GET /api/v1/demo-seed", s.withTenant(s.handleSeedData))
	s.mux.HandleFunc("GET /api/v1/customers", s.withTenant(s.handleCustomersList))
	s.mux.HandleFunc("POST /api/v1/customers", s.withTenant(s.handleCustomersCreate))
	s.mux.HandleFunc("GET /api/v1/projects", s.withTenant(s.handleProjectsList))
	s.mux.HandleFunc("POST /api/v1/projects", s.withTenant(s.handleProjectsCreate))
	s.mux.HandleFunc("GET /api/v1/catalog/materials", s.withTenant(s.handleMaterialsList))
	s.mux.HandleFunc("POST /api/v1/revisions/wardrobe", s.withTenant(s.handleWardrobeRevisionCreate))
	s.mux.HandleFunc("GET /api/v1/revisions/{revision_id}", s.withTenant(s.handleRevisionGet))
	s.mux.HandleFunc("POST /api/v1/revisions/{revision_id}/quote-document", s.withTenant(s.handleQuoteDocumentCreate))
	s.mux.HandleFunc("POST /api/v1/revisions/{revision_id}/approve", s.withTenant(s.handleRevisionApprove))
	s.mux.HandleFunc("POST /api/v1/revisions/{revision_id}/fork", s.withTenant(s.handleRevisionFork))
	s.mux.HandleFunc("GET /api/v1/revisions/{left_revision_id}/diff/{right_revision_id}", s.withTenant(s.handleRevisionDiff))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.service.Health())
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeProblem(w, r, http.StatusBadRequest, "invalid_json", "Invalid JSON", "Request body could not be decoded.")
		return
	}

	session, err := s.service.Login(request.Email, request.Password)
	if err != nil {
		writeProblem(w, r, http.StatusUnauthorized, "invalid_credentials", "Invalid credentials", "Email or password is incorrect.")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"access_token":       session.Token,
		"token_type":         "Bearer",
		"expires_in_seconds": 3600,
		"user":               session.User,
		"company_id":         session.CompanyID,
	})
}

func (s *Server) handleTenantCurrent(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	writeJSON(w, http.StatusOK, tenant)
}

func (s *Server) handleSeedData(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	seed, err := s.service.SeedData(tenant)
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Seed data unavailable", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, seed)
}

func (s *Server) handleCustomersList(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	writeJSON(w, http.StatusOK, map[string]any{"items": s.service.ListCustomers(tenant)})
}

func (s *Server) handleCustomersCreate(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	if requireIdempotency(w, r) {
		return
	}

	var request struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Phone string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeProblem(w, r, http.StatusBadRequest, "invalid_json", "Invalid JSON", "Request body could not be decoded.")
		return
	}
	customer, err := s.service.CreateCustomer(tenant, request.Name, request.Email, request.Phone)
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Customer not created", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, customer)
}

func (s *Server) handleProjectsList(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	writeJSON(w, http.StatusOK, map[string]any{"items": s.service.ListProjects(tenant)})
}

func (s *Server) handleProjectsCreate(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	if requireIdempotency(w, r) {
		return
	}

	var request struct {
		CustomerID   string `json:"customer_id"`
		CustomerName string `json:"customer_name"`
		Name         string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeProblem(w, r, http.StatusBadRequest, "invalid_json", "Invalid JSON", "Request body could not be decoded.")
		return
	}

	var (
		project domain.Project
		err     error
	)
	if request.CustomerID != "" {
		project, err = s.service.CreateProjectForCustomer(tenant, domain.ID(request.CustomerID), request.Name)
	} else {
		project, err = s.service.CreateProject(tenant, request.CustomerName, request.Name)
	}
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Project not created", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (s *Server) handleMaterialsList(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	writeJSON(w, http.StatusOK, map[string]any{"items": s.service.ListMaterials(tenant)})
}

func (s *Server) handleWardrobeRevisionCreate(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	if requireIdempotency(w, r) {
		return
	}

	var request domain.WardrobeConfig
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeProblem(w, r, http.StatusBadRequest, "invalid_json", "Invalid JSON", "Request body could not be decoded.")
		return
	}
	revision, err := s.service.CreateWardrobeRevision(tenant, request)
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Wardrobe revision not created", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, revision)
}

func (s *Server) handleRevisionGet(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	revision, err := s.service.GetRevision(tenant, domain.ID(r.PathValue("revision_id")))
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Revision not found", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, revision)
}

func (s *Server) handleQuoteDocumentCreate(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	if requireIdempotency(w, r) {
		return
	}
	document, err := s.service.GenerateQuoteDocument(tenant, domain.ID(r.PathValue("revision_id")))
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Quote document not generated", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, document)
}

func (s *Server) handleRevisionFork(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	if requireIdempotency(w, r) {
		return
	}

	var request struct {
		Patch map[string]int `json:"patch"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeProblem(w, r, http.StatusBadRequest, "invalid_json", "Invalid JSON", "Request body could not be decoded.")
		return
	}
	revision, err := s.service.ForkRevision(tenant, domain.ID(r.PathValue("revision_id")), request.Patch)
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Revision not forked", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, revision)
}

func (s *Server) handleRevisionApprove(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	if requireIdempotency(w, r) {
		return
	}

	revision, err := s.service.ApproveRevision(tenant, domain.ID(r.PathValue("revision_id")))
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Revision not approved", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, revision)
}

func (s *Server) handleRevisionDiff(w http.ResponseWriter, r *http.Request, tenant domain.TenantContext) {
	diff, err := s.service.DiffRevisions(
		tenant,
		domain.ID(r.PathValue("left_revision_id")),
		domain.ID(r.PathValue("right_revision_id")),
	)
	if err != nil {
		status, code := statusForError(err)
		writeProblem(w, r, status, code, "Revision diff not available", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, diff)
}

func (s *Server) withTenant(next func(http.ResponseWriter, *http.Request, domain.TenantContext)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		token := strings.TrimPrefix(header, "Bearer ")
		if token == "" || token == header {
			writeProblem(w, r, http.StatusUnauthorized, "missing_bearer_token", "Missing bearer token", "Authorization header must use Bearer token.")
			return
		}
		tenant, err := s.service.TenantFromToken(token)
		if err != nil {
			writeProblem(w, r, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Token is not valid.")
			return
		}
		tenant.TraceID = traceID(r)
		next(w, r, tenant)
	}
}

func statusForError(err error) (int, string) {
	switch {
	case errors.Is(err, app.ErrValidation):
		return http.StatusBadRequest, "validation_failed"
	case errors.Is(err, app.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	case errors.Is(err, app.ErrUnauthorized):
		return http.StatusUnauthorized, "unauthorized"
	case errors.Is(err, app.ErrImmutable):
		return http.StatusConflict, "immutable_revision"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeProblem(w http.ResponseWriter, r *http.Request, status int, code string, title string, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":     "https://mobilyaos.local/problems/" + code,
		"title":    title,
		"status":   status,
		"code":     code,
		"detail":   detail,
		"trace_id": traceID(r),
	})
}

func requireIdempotency(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("Idempotency-Key") == "" {
		writeProblem(w, r, http.StatusBadRequest, "missing_idempotency_key", "Missing idempotency key", "Mutating requests require Idempotency-Key.")
		return true
	}
	return false
}

func traceID(r *http.Request) string {
	if value := r.Header.Get("X-Trace-Id"); value != "" {
		return value
	}
	return "trace-" + time.Now().UTC().Format("20060102150405.000000000")
}
