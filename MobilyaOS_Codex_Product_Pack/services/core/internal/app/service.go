package app

import (
	"crypto/sha256"
	"encoding/json"
	"encoding/hex"
	"errors"
	"fmt"
	"html"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/buyukfuat52/furniture/services/core/internal/domain"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrForbidden          = errors.New("forbidden")
	ErrValidation         = errors.New("validation failed")
	ErrImmutable          = errors.New("revision is immutable")
)

type Clock func() time.Time

type Service struct {
	mu        sync.RWMutex
	clock     Clock
	company   domain.Company
	users     map[string]demoUser
	sessions  map[string]domain.Session
	customers []domain.Customer
	projects  []domain.Project
	materials []domain.MaterialSKU
	edgeBands []domain.EdgeBandSKU
	laborOps  []domain.LaborOperation
	revisions []domain.QuoteRevision
	nextID    int
}

type demoUser struct {
	user     domain.User
	password string
	token    string
}

func NewDemoService(clock Clock) *Service {
	companyID := domain.ID("11111111-1111-4111-8111-111111111111")
	admin := domain.User{
		ID:        domain.ID("22222222-2222-4222-8222-222222222222"),
		CompanyID: companyID,
		Email:     "admin@demo.local",
		Roles:     []domain.Role{domain.RoleAdmin},
	}
	sales := domain.User{
		ID:        domain.ID("33333333-3333-4333-8333-333333333333"),
		CompanyID: companyID,
		Email:     "satis@demo.local",
		Roles:     []domain.Role{domain.RoleSales},
	}
	viewer := domain.User{
		ID:        domain.ID("66666666-6666-4666-8666-666666666666"),
		CompanyID: companyID,
		Email:     "viewer@demo.local",
		Roles:     []domain.Role{domain.RoleViewer},
	}
	foreignCompanyID := domain.ID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
	foreignSales := domain.User{
		ID:        domain.ID("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
		CompanyID: foreignCompanyID,
		Email:     "satis@foreign.local",
		Roles:     []domain.Role{domain.RoleSales},
	}
	return &Service{
		clock: clock,
		company: domain.Company{
			ID:       companyID,
			Name:     "Demo Mobilya A.S.",
			Currency: "TRY",
		},
		users: map[string]demoUser{
			admin.Email:        {user: admin, password: "Demo1234!ChangeMe", token: "demo-admin-token"},
			sales.Email:        {user: sales, password: "Demo1234!ChangeMe", token: "demo-sales-token"},
			viewer.Email:       {user: viewer, password: "Demo1234!ChangeMe", token: "demo-viewer-token"},
			foreignSales.Email: {user: foreignSales, password: "Demo1234!ChangeMe", token: "foreign-sales-token"},
		},
		sessions: map[string]domain.Session{},
		customers: []domain.Customer{
			{
				ID:        domain.ID("77777777-7777-4777-8777-777777777777"),
				CompanyID: companyID,
				Name:      "Demo Musteri",
				Email:     "demo@example.local",
				Phone:     "+90 555 000 00 00",
				Version:   1,
			},
		},
		projects: []domain.Project{
			{
				ID:           domain.ID("44444444-4444-4444-8444-444444444444"),
				CompanyID:    companyID,
				CustomerID:   domain.ID("77777777-7777-4777-8777-777777777777"),
				CustomerName: "Demo Musteri",
				Name:         "Demo Vestiyer Projesi",
				Status:       "draft",
				Version:      1,
			},
		},
		materials: []domain.MaterialSKU{
			{
				ID:            domain.ID("55555555-5555-4555-8555-555555555555"),
				CompanyID:     companyID,
				SKU:           "PNL-MDF-18-BEYAZ",
				Name:          "18 mm MDFLAM Beyaz",
				ThicknessMM:   18,
				SheetWidthMM:  2100,
				SheetHeightMM: 2800,
				PricePerSheet: domain.MoneyMinor{AmountMinor: 145000, Currency: "TRY"},
			},
		},
		edgeBands: []domain.EdgeBandSKU{
			{
				ID:        domain.ID("88888888-8888-4888-8888-888888888888"),
				CompanyID: companyID,
				SKU:       "EDGE-PVC-22-BEYAZ",
				Name:      "22 mm PVC Beyaz Kenar Bandi",
				PricePerM: domain.MoneyMinor{AmountMinor: 1200, Currency: "TRY"},
			},
		},
		laborOps: []domain.LaborOperation{
			{
				ID:            domain.ID("99999999-9999-4999-8999-999999999999"),
				CompanyID:     companyID,
				Code:          "MONTAJ",
				Name:          "Vestiyer montaj isciligi",
				UnitLaborCost: domain.MoneyMinor{AmountMinor: 35000, Currency: "TRY"},
			},
			{
				ID:            domain.ID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
				CompanyID:     companyID,
				Code:          "KESIM",
				Name:          "Panel kesim ve delik hazirligi",
				UnitLaborCost: domain.MoneyMinor{AmountMinor: 22000, Currency: "TRY"},
			},
		},
		revisions: []domain.QuoteRevision{},
		nextID: 1,
	}
}

func (s *Service) Health() map[string]string {
	return map[string]string{
		"status":  "ok",
		"service": "core",
		"version": "0.1.0",
	}
}

func (s *Service) Login(email string, password string) (domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[strings.ToLower(strings.TrimSpace(email))]
	if !ok || user.password != password {
		return domain.Session{}, ErrInvalidCredentials
	}
	session := domain.Session{
		Token:     user.token,
		User:      user.user,
		CompanyID: user.user.CompanyID,
	}
	s.sessions[user.token] = session
	return session, nil
}

func (s *Service) TenantFromToken(token string) (domain.TenantContext, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[token]
	if !ok {
		for _, user := range s.users {
			if user.token == token {
				session = domain.Session{Token: token, User: user.user, CompanyID: user.user.CompanyID}
				ok = true
				break
			}
		}
	}
	if !ok {
		return domain.TenantContext{}, ErrUnauthorized
	}
	return domain.TenantContext{
		CompanyID: session.CompanyID,
		ActorID:   session.User.ID,
		Roles:     session.User.Roles,
	}, nil
}

func (s *Service) CurrentCompany(ctx domain.TenantContext) (domain.Company, error) {
	if ctx.CompanyID != s.company.ID {
		return domain.Company{}, ErrForbidden
	}
	return s.company, nil
}

func (s *Service) ListCustomers(ctx domain.TenantContext) []domain.Customer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	customers := make([]domain.Customer, 0, len(s.customers))
	for _, customer := range s.customers {
		if customer.CompanyID == ctx.CompanyID {
			customers = append(customers, customer)
		}
	}
	return customers
}

func (s *Service) CreateCustomer(ctx domain.TenantContext, name string, email string, phone string) (domain.Customer, error) {
	if strings.TrimSpace(name) == "" {
		return domain.Customer{}, ErrValidation
	}
	if !hasAnyRole(ctx.Roles, domain.RoleAdmin, domain.RoleSales) {
		return domain.Customer{}, ErrForbidden
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	customer := domain.Customer{
		ID:        s.nextUUID("customer"),
		CompanyID: ctx.CompanyID,
		Name:      strings.TrimSpace(name),
		Email:     strings.TrimSpace(email),
		Phone:     strings.TrimSpace(phone),
		Version:   1,
	}
	s.customers = append(s.customers, customer)
	return customer, nil
}

func (s *Service) ListProjects(ctx domain.TenantContext) []domain.Project {
	s.mu.RLock()
	defer s.mu.RUnlock()

	projects := make([]domain.Project, 0, len(s.projects))
	for _, project := range s.projects {
		if project.CompanyID == ctx.CompanyID {
			projects = append(projects, project)
		}
	}
	return projects
}

func (s *Service) CreateProject(ctx domain.TenantContext, customerName string, name string) (domain.Project, error) {
	if strings.TrimSpace(customerName) == "" || strings.TrimSpace(name) == "" {
		return domain.Project{}, ErrValidation
	}
	if !hasAnyRole(ctx.Roles, domain.RoleAdmin, domain.RoleSales) {
		return domain.Project{}, ErrForbidden
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	id := s.nextUUID("project")
	project := domain.Project{
		ID:           id,
		CompanyID:    ctx.CompanyID,
		CustomerName: strings.TrimSpace(customerName),
		Name:         strings.TrimSpace(name),
		Status:       "draft",
		Version:      1,
	}
	s.projects = append(s.projects, project)
	return project, nil
}

func (s *Service) CreateProjectForCustomer(ctx domain.TenantContext, customerID domain.ID, name string) (domain.Project, error) {
	if strings.TrimSpace(name) == "" || customerID == "" {
		return domain.Project{}, ErrValidation
	}
	if !hasAnyRole(ctx.Roles, domain.RoleAdmin, domain.RoleSales) {
		return domain.Project{}, ErrForbidden
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var customer domain.Customer
	for _, item := range s.customers {
		if item.CompanyID == ctx.CompanyID && item.ID == customerID {
			customer = item
			break
		}
	}
	if customer.ID == "" {
		return domain.Project{}, ErrValidation
	}

	project := domain.Project{
		ID:           s.nextUUID("project"),
		CompanyID:    ctx.CompanyID,
		CustomerID:   customer.ID,
		CustomerName: customer.Name,
		Name:         strings.TrimSpace(name),
		Status:       "draft",
		Version:      1,
	}
	s.projects = append(s.projects, project)
	return project, nil
}

func (s *Service) ListMaterials(ctx domain.TenantContext) []domain.MaterialSKU {
	s.mu.RLock()
	defer s.mu.RUnlock()

	materials := make([]domain.MaterialSKU, 0, len(s.materials))
	for _, material := range s.materials {
		if material.CompanyID == ctx.CompanyID {
			materials = append(materials, material)
		}
	}
	return materials
}

func (s *Service) SeedData(ctx domain.TenantContext) (map[string]any, error) {
	company, err := s.CurrentCompany(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"company":          company,
		"customers":        s.ListCustomers(ctx),
		"projects":         s.ListProjects(ctx),
		"materials":        s.ListMaterials(ctx),
		"edge_bands":       s.listEdgeBands(ctx),
		"labor_operations": s.listLaborOps(ctx),
	}, nil
}

func (s *Service) CreateWardrobeRevision(ctx domain.TenantContext, config domain.WardrobeConfig) (domain.QuoteRevision, error) {
	if !hasAnyRole(ctx.Roles, domain.RoleAdmin, domain.RoleSales, domain.RoleDesigner, domain.RoleCosting) {
		return domain.QuoteRevision{}, ErrForbidden
	}
	if err := validateWardrobeConfig(config); err != nil {
		return domain.QuoteRevision{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.projectExistsLocked(ctx.CompanyID, config.ProjectID) {
		return domain.QuoteRevision{}, ErrValidation
	}
	revisionNumber := 1
	for _, revision := range s.revisions {
		if revision.CompanyID == ctx.CompanyID && revision.ProjectID == config.ProjectID && revision.RevisionNumber >= revisionNumber {
			revisionNumber = revision.RevisionNumber + 1
		}
	}
	revision, err := s.calculateWardrobeLocked(ctx, config, "", revisionNumber)
	if err != nil {
		return domain.QuoteRevision{}, err
	}
	s.revisions = append(s.revisions, revision)
	return revision, nil
}

func (s *Service) GetRevision(ctx domain.TenantContext, revisionID domain.ID) (domain.QuoteRevision, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, revision := range s.revisions {
		if revision.CompanyID == ctx.CompanyID && revision.ID == revisionID {
			return revision, nil
		}
	}
	return domain.QuoteRevision{}, ErrValidation
}

func (s *Service) GenerateQuoteDocument(ctx domain.TenantContext, revisionID domain.ID) (domain.QuoteDocument, error) {
	if !hasAnyRole(ctx.Roles, domain.RoleAdmin, domain.RoleSales, domain.RoleCosting) {
		return domain.QuoteDocument{}, ErrForbidden
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for index := range s.revisions {
		revision := &s.revisions[index]
		if revision.CompanyID != ctx.CompanyID || revision.ID != revisionID {
			continue
		}
		if revision.State == "approved" || revision.State == "sent" {
			return domain.QuoteDocument{}, ErrImmutable
		}
		htmlDocument := renderQuoteHTML(*revision)
		sum := sha256.Sum256([]byte(htmlDocument))
		document := domain.QuoteDocument{
			ID:                 s.nextUUID("document"),
			CompanyID:          revision.CompanyID,
			RevisionID:         revision.ID,
			CostSnapshotID:     revision.Cost.ID,
			CostSnapshotHash:   costSnapshotHash(revision.Cost),
			CostFormulaVersion: revision.Cost.FormulaVersion,
			ContentType:        "text/html; charset=utf-8",
			SizeBytes:          int64(len([]byte(htmlDocument))),
			SHA256:             hex.EncodeToString(sum[:]),
			HTML:               htmlDocument,
		}
		revision.Document = &document
		return document, nil
	}
	return domain.QuoteDocument{}, ErrValidation
}

func (s *Service) ApproveRevision(ctx domain.TenantContext, revisionID domain.ID) (domain.QuoteRevision, error) {
	if !hasAnyRole(ctx.Roles, domain.RoleAdmin, domain.RoleSales) {
		return domain.QuoteRevision{}, ErrForbidden
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for index := range s.revisions {
		revision := &s.revisions[index]
		if revision.CompanyID != ctx.CompanyID || revision.ID != revisionID {
			continue
		}
		if revision.State == "approved" || revision.State == "sent" {
			return domain.QuoteRevision{}, ErrImmutable
		}
		if revision.Document == nil {
			return domain.QuoteRevision{}, ErrValidation
		}
		revision.State = "approved"
		revision.Version++
		return *revision, nil
	}
	return domain.QuoteRevision{}, ErrValidation
}

func (s *Service) ForkRevision(ctx domain.TenantContext, revisionID domain.ID, patch map[string]int) (domain.QuoteRevision, error) {
	if !hasAnyRole(ctx.Roles, domain.RoleAdmin, domain.RoleSales, domain.RoleDesigner, domain.RoleCosting) {
		return domain.QuoteRevision{}, ErrForbidden
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var source domain.QuoteRevision
	for _, revision := range s.revisions {
		if revision.CompanyID == ctx.CompanyID && revision.ID == revisionID {
			source = revision
			break
		}
	}
	if source.ID == "" {
		return domain.QuoteRevision{}, ErrValidation
	}

	config := source.Config
	if value, ok := patch["width_mm"]; ok {
		config.WidthMM = domain.Millimetres(value)
	}
	if value, ok := patch["height_mm"]; ok {
		config.HeightMM = domain.Millimetres(value)
	}
	if value, ok := patch["depth_mm"]; ok {
		config.DepthMM = domain.Millimetres(value)
	}
	if value, ok := patch["quantity"]; ok {
		config.Quantity = value
	}
	if value, ok := patch["shelf_count"]; ok {
		config.ShelfCount = value
	}

	revisionNumber := source.RevisionNumber + 1
	for _, revision := range s.revisions {
		if revision.CompanyID == ctx.CompanyID && revision.ProjectID == source.ProjectID && revision.RevisionNumber >= revisionNumber {
			revisionNumber = revision.RevisionNumber + 1
		}
	}
	fork, err := s.calculateWardrobeLocked(ctx, config, source.ID, revisionNumber)
	if err != nil {
		return domain.QuoteRevision{}, err
	}
	s.revisions = append(s.revisions, fork)
	return fork, nil
}

func (s *Service) DiffRevisions(ctx domain.TenantContext, leftID domain.ID, rightID domain.ID) (domain.RevisionDiff, error) {
	left, err := s.GetRevision(ctx, leftID)
	if err != nil {
		return domain.RevisionDiff{}, err
	}
	right, err := s.GetRevision(ctx, rightID)
	if err != nil {
		return domain.RevisionDiff{}, err
	}

	entries := []domain.DiffEntry{}
	addIfChanged := func(category string, field string, before string, after string) {
		if before != after {
			entries = append(entries, domain.DiffEntry{Category: category, Field: field, Before: before, After: after})
		}
	}
	addIfChanged("parameters", "width_mm", fmt.Sprint(left.Config.WidthMM), fmt.Sprint(right.Config.WidthMM))
	addIfChanged("parameters", "height_mm", fmt.Sprint(left.Config.HeightMM), fmt.Sprint(right.Config.HeightMM))
	addIfChanged("parameters", "depth_mm", fmt.Sprint(left.Config.DepthMM), fmt.Sprint(right.Config.DepthMM))
	addIfChanged("parameters", "quantity", fmt.Sprint(left.Config.Quantity), fmt.Sprint(right.Config.Quantity))
	addIfChanged("bom", "part_count", fmt.Sprint(totalBOMQuantity(left.BOM)), fmt.Sprint(totalBOMQuantity(right.BOM)))
	addIfChanged("edge_band", "billable_mm", fmt.Sprint(totalBillableEdge(left.Edges)), fmt.Sprint(totalBillableEdge(right.Edges)))
	addIfChanged("labor", "total_minor", fmt.Sprint(totalLaborMinor(left.Labor)), fmt.Sprint(totalLaborMinor(right.Labor)))
	addIfChanged("cost", "subtotal_minor", fmt.Sprint(left.Cost.Subtotal.AmountMinor), fmt.Sprint(right.Cost.Subtotal.AmountMinor))
	addIfChanged("quote", "grand_total_minor", fmt.Sprint(left.Cost.GrandTotal.AmountMinor), fmt.Sprint(right.Cost.GrandTotal.AmountMinor))
	SortDiffEntries(entries)
	return domain.RevisionDiff{LeftRevisionID: leftID, RightRevisionID: rightID, Entries: entries}, nil
}

func (s *Service) calculateWardrobeLocked(ctx domain.TenantContext, config domain.WardrobeConfig, parentID domain.ID, revisionNumber int) (domain.QuoteRevision, error) {
	material, ok := findMaterial(s.materials, ctx.CompanyID, config.MaterialSKU)
	if !ok {
		return domain.QuoteRevision{}, ErrValidation
	}
	edgeBand, ok := findEdgeBand(s.edgeBands, ctx.CompanyID, config.EdgeBandSKU)
	if !ok {
		return domain.QuoteRevision{}, ErrValidation
	}
	bom := buildWardrobeBOM(config)
	edges := buildWardrobeEdges(config, bom)
	labor := buildWardrobeLabor(config, filterLaborOps(s.laborOps, ctx.CompanyID))
	cost := buildCostSnapshot(s.nextUUID("cost"), material, edgeBand, bom, edges, labor, config)

	return domain.QuoteRevision{
		ID:               s.nextUUID("revision"),
		CompanyID:        ctx.CompanyID,
		ProjectID:        config.ProjectID,
		RevisionNumber:   revisionNumber,
		State:            "draft",
		ParentRevisionID: parentID,
		Config:           config,
		BOM:              bom,
		Edges:            edges,
		Labor:            labor,
		Cost:             cost,
		Version:          1,
	}, nil
}

func validateWardrobeConfig(config domain.WardrobeConfig) error {
	if config.ProjectID == "" || config.Quantity <= 0 || config.Quantity > 20 {
		return ErrValidation
	}
	if config.WidthMM < 600 || config.WidthMM > 4000 || config.HeightMM < 1200 || config.HeightMM > 3000 || config.DepthMM < 250 || config.DepthMM > 900 {
		return ErrValidation
	}
	if config.ShelfCount < 0 || config.ShelfCount > 12 || config.DoorCount <= 0 || config.DoorCount > 6 {
		return ErrValidation
	}
	if config.MaterialSKU == "" || config.EdgeBandSKU == "" || config.MarkupBps < 0 || config.VatBps < 0 {
		return ErrValidation
	}
	return nil
}

func buildWardrobeBOM(config domain.WardrobeConfig) []domain.BOMPart {
	innerWidth := config.WidthMM - 36
	doorWidth := domain.Millimetres(int64(config.WidthMM) / int64(config.DoorCount))
	parts := []domain.BOMPart{
		newPart("SIDE", "Yan panel", config.DepthMM, config.HeightMM, 2*config.Quantity, config.MaterialSKU),
		newPart("TOP", "Ust panel", innerWidth, config.DepthMM, config.Quantity, config.MaterialSKU),
		newPart("BOTTOM", "Alt panel", innerWidth, config.DepthMM, config.Quantity, config.MaterialSKU),
		newPart("SHELF", "Raf", innerWidth, config.DepthMM, config.ShelfCount*config.Quantity, config.MaterialSKU),
		newPart("BACK", "Arkalik panel", config.WidthMM, config.HeightMM, config.Quantity, config.MaterialSKU),
		newPart("DOOR", "Kapak", doorWidth, config.HeightMM, config.DoorCount*config.Quantity, config.MaterialSKU),
	}
	return parts
}

func newPart(code string, name string, width domain.Millimetres, height domain.Millimetres, quantity int, sku string) domain.BOMPart {
	return domain.BOMPart{
		Code:        code,
		Name:        name,
		WidthMM:     width,
		HeightMM:    height,
		Quantity:    quantity,
		MaterialSKU: sku,
		AreaMM2:     int64(width) * int64(height) * int64(quantity),
	}
}

func buildWardrobeEdges(config domain.WardrobeConfig, bom []domain.BOMPart) []domain.EdgeRequirement {
	edges := []domain.EdgeRequirement{}
	for _, part := range bom {
		switch part.Code {
		case "DOOR":
			edges = append(edges,
				edge(part, "north", part.WidthMM, "front-visible", config.EdgeBandSKU, 800, 80),
				edge(part, "east", part.HeightMM, "front-visible", config.EdgeBandSKU, 800, 80),
				edge(part, "south", part.WidthMM, "front-visible", config.EdgeBandSKU, 800, 80),
				edge(part, "west", part.HeightMM, "front-visible", config.EdgeBandSKU, 800, 80),
			)
		case "SIDE", "TOP", "BOTTOM", "SHELF":
			edges = append(edges, edge(part, "front", part.WidthMM, "front-visible", config.EdgeBandSKU, 800, 80))
		}
	}
	return edges
}

func edge(part domain.BOMPart, side string, length domain.Millimetres, visibility string, sku string, wasteBps int64, setup int64) domain.EdgeRequirement {
	base := int64(length) * int64(part.Quantity)
	billable := divRound(base*(10000+wasteBps), 10000) + setup
	return domain.EdgeRequirement{
		PartCode:   part.Code,
		Edge:       side,
		LengthMM:   length,
		Quantity:   part.Quantity,
		Visibility: visibility,
		BandSKU:    sku,
		Process:    "straight",
		BillableMM: domain.Millimetres(billable),
		WasteBps:   wasteBps,
		SetupMM:    domain.Millimetres(setup),
	}
}

func buildWardrobeLabor(config domain.WardrobeConfig, operations []domain.LaborOperation) []domain.LaborLine {
	lines := make([]domain.LaborLine, 0, len(operations))
	for _, operation := range operations {
		total := operation.UnitLaborCost.AmountMinor * int64(config.Quantity)
		lines = append(lines, domain.LaborLine{
			Code:      operation.Code,
			Name:      operation.Name,
			UnitCost:  operation.UnitLaborCost,
			Quantity:  config.Quantity,
			TotalCost: domain.MoneyMinor{AmountMinor: total, Currency: operation.UnitLaborCost.Currency},
			Formula:   "unit_labor_minor * product_quantity",
		})
	}
	return lines
}

func buildCostSnapshot(id domain.ID, material domain.MaterialSKU, edgeBand domain.EdgeBandSKU, bom []domain.BOMPart, edges []domain.EdgeRequirement, labor []domain.LaborLine, config domain.WardrobeConfig) domain.CostSnapshot {
	totalArea := int64(0)
	for _, part := range bom {
		totalArea += part.AreaMM2
	}
	sheetArea := int64(material.SheetWidthMM) * int64(material.SheetHeightMM)
	panelCost := divRound(totalArea*material.PricePerSheet.AmountMinor, sheetArea)

	edgeMM := int64(totalBillableEdge(edges))
	edgeCost := divRound(edgeMM*edgeBand.PricePerM.AmountMinor, 1000)

	laborCost := totalLaborMinor(labor)
	subtotal := panelCost + edgeCost + laborCost
	markup := divRound(subtotal*int64(config.MarkupBps), 10000)
	beforeVat := subtotal + markup
	vat := divRound(beforeVat*int64(config.VatBps), 10000)
	grandTotal := beforeVat + vat

	currency := material.PricePerSheet.Currency
	return domain.CostSnapshot{
		ID:             id,
		FormulaVersion: "wardrobe-cost-v1",
		Categories: []domain.CostCategory{
			{Category: "panels", Amount: domain.MoneyMinor{AmountMinor: panelCost, Currency: currency}},
			{Category: "edge_band", Amount: domain.MoneyMinor{AmountMinor: edgeCost, Currency: currency}},
			{Category: "unit_labor", Amount: domain.MoneyMinor{AmountMinor: laborCost, Currency: currency}},
		},
		Subtotal:   domain.MoneyMinor{AmountMinor: subtotal, Currency: currency},
		Markup:     domain.MoneyMinor{AmountMinor: markup, Currency: currency},
		Vat:        domain.MoneyMinor{AmountMinor: vat, Currency: currency},
		GrandTotal: domain.MoneyMinor{AmountMinor: grandTotal, Currency: currency},
		Provenance: []string{
			"material_price_observation:demo-panel-sheet-v1",
			"edge_price_observation:demo-edge-v1",
			"labor_policy:demo-labor-v1",
			"formula:wardrobe-cost-v1",
		},
	}
}

func renderQuoteHTML(revision domain.QuoteRevision) string {
	return fmt.Sprintf(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Teklif Revizyon %d</title></head>
<body>
<h1>MobilyaOS Teklif</h1>
<p>Revizyon: %d</p>
<p>Urun: Vestiyer / Gardrop</p>
<p>Olcu: %d x %d x %d mm</p>
<p>Adet: %d</p>
<p>Ara toplam: %s</p>
<p>Kar/markup: %s</p>
<p>KDV: %s</p>
<h2>Genel toplam: %s</h2>
<p>Snapshot: %s / %s</p>
<p>Bu belge deterministik maliyet motoru tarafindan uretilen onaylanabilir snapshot'a dayanir.</p>
</body></html>`,
		revision.RevisionNumber,
		revision.RevisionNumber,
		revision.Config.WidthMM,
		revision.Config.HeightMM,
		revision.Config.DepthMM,
		revision.Config.Quantity,
		formatMoney(revision.Cost.Subtotal),
		formatMoney(revision.Cost.Markup),
		formatMoney(revision.Cost.Vat),
		formatMoney(revision.Cost.GrandTotal),
		html.EscapeString(string(revision.Cost.ID)),
		html.EscapeString(revision.Cost.FormulaVersion),
	)
}

func costSnapshotHash(snapshot domain.CostSnapshot) string {
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func formatMoney(money domain.MoneyMinor) string {
	return fmt.Sprintf("%d.%02d %s", money.AmountMinor/100, money.AmountMinor%100, money.Currency)
}

func findMaterial(materials []domain.MaterialSKU, companyID domain.ID, sku string) (domain.MaterialSKU, bool) {
	for _, material := range materials {
		if material.CompanyID == companyID && material.SKU == sku {
			return material, true
		}
	}
	return domain.MaterialSKU{}, false
}

func findEdgeBand(edges []domain.EdgeBandSKU, companyID domain.ID, sku string) (domain.EdgeBandSKU, bool) {
	for _, edgeBand := range edges {
		if edgeBand.CompanyID == companyID && edgeBand.SKU == sku {
			return edgeBand, true
		}
	}
	return domain.EdgeBandSKU{}, false
}

func (s *Service) listEdgeBands(ctx domain.TenantContext) []domain.EdgeBandSKU {
	items := make([]domain.EdgeBandSKU, 0, len(s.edgeBands))
	for _, item := range s.edgeBands {
		if item.CompanyID == ctx.CompanyID {
			items = append(items, item)
		}
	}
	return items
}

func (s *Service) listLaborOps(ctx domain.TenantContext) []domain.LaborOperation {
	items := make([]domain.LaborOperation, 0, len(s.laborOps))
	for _, item := range s.laborOps {
		if item.CompanyID == ctx.CompanyID {
			items = append(items, item)
		}
	}
	return items
}

func filterLaborOps(operations []domain.LaborOperation, companyID domain.ID) []domain.LaborOperation {
	items := make([]domain.LaborOperation, 0, len(operations))
	for _, item := range operations {
		if item.CompanyID == companyID {
			items = append(items, item)
		}
	}
	return items
}

func (s *Service) projectExistsLocked(companyID domain.ID, projectID domain.ID) bool {
	for _, project := range s.projects {
		if project.CompanyID == companyID && project.ID == projectID {
			return true
		}
	}
	return false
}

func (s *Service) nextUUID(kind string) domain.ID {
	prefixes := map[string]string{
		"customer": "10000000-0000-4000-8000-",
		"project":  "20000000-0000-4000-8000-",
		"revision": "30000000-0000-4000-8000-",
		"cost":     "40000000-0000-4000-8000-",
		"document": "50000000-0000-4000-8000-",
	}
	prefix := prefixes[kind]
	if prefix == "" {
		prefix = "90000000-0000-4000-8000-"
	}
	id := domain.ID(fmt.Sprintf("%s%012d", prefix, s.nextID))
	s.nextID++
	return id
}

func divRound(numerator int64, denominator int64) int64 {
	if denominator == 0 {
		return 0
	}
	return (numerator + denominator/2) / denominator
}

func totalBOMQuantity(parts []domain.BOMPart) int {
	total := 0
	for _, part := range parts {
		total += part.Quantity
	}
	return total
}

func totalBillableEdge(edges []domain.EdgeRequirement) domain.Millimetres {
	total := int64(0)
	for _, item := range edges {
		total += int64(item.BillableMM)
	}
	return domain.Millimetres(total)
}

func totalLaborMinor(lines []domain.LaborLine) int64 {
	total := int64(0)
	for _, line := range lines {
		total += line.TotalCost.AmountMinor
	}
	return total
}

func SortDiffEntries(entries []domain.DiffEntry) {
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Category == entries[j].Category {
			return entries[i].Field < entries[j].Field
		}
		return entries[i].Category < entries[j].Category
	})
}

func hasAnyRole(roles []domain.Role, allowed ...domain.Role) bool {
	for _, role := range roles {
		for _, allow := range allowed {
			if role == allow {
				return true
			}
		}
	}
	return false
}
