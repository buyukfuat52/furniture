package domain

type ID string

type Role string

const (
	RoleAdmin       Role = "admin"
	RoleSales       Role = "sales"
	RoleDesigner    Role = "designer"
	RoleCosting     Role = "costing"
	RoleProcurement Role = "procurement"
	RoleProduction  Role = "production"
	RoleViewer      Role = "viewer"
)

type MoneyMinor struct {
	AmountMinor int64  `json:"amount_minor"`
	Currency    string `json:"currency"`
}

type Millimetres int64

type Company struct {
	ID       ID     `json:"id"`
	Name     string `json:"name"`
	Currency string `json:"currency"`
}

type User struct {
	ID        ID     `json:"id"`
	CompanyID ID     `json:"company_id"`
	Email     string `json:"email"`
	Roles     []Role  `json:"roles"`
}

type TenantContext struct {
	CompanyID ID     `json:"company_id"`
	ActorID   ID     `json:"actor_id"`
	Roles     []Role  `json:"roles"`
	TraceID   string `json:"trace_id,omitempty"`
}

type Session struct {
	Token     string `json:"token"`
	User      User   `json:"user"`
	CompanyID ID    `json:"company_id"`
}

type Project struct {
	ID           ID     `json:"id"`
	CompanyID    ID     `json:"company_id"`
	CustomerID   ID     `json:"customer_id,omitempty"`
	CustomerName string `json:"customer_name"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	Version      int    `json:"version"`
}

type MaterialSKU struct {
	ID            ID          `json:"id"`
	CompanyID     ID          `json:"company_id"`
	SKU           string      `json:"sku"`
	Name          string      `json:"name"`
	ThicknessMM   Millimetres `json:"thickness_mm"`
	SheetWidthMM  Millimetres `json:"sheet_width_mm"`
	SheetHeightMM Millimetres `json:"sheet_height_mm"`
	PricePerSheet MoneyMinor  `json:"price_per_sheet"`
}

type Customer struct {
	ID        ID     `json:"id"`
	CompanyID ID     `json:"company_id"`
	Name      string `json:"name"`
	Email     string `json:"email,omitempty"`
	Phone     string `json:"phone,omitempty"`
	Version   int    `json:"version"`
}

type EdgeBandSKU struct {
	ID       ID         `json:"id"`
	CompanyID ID       `json:"company_id"`
	SKU      string     `json:"sku"`
	Name     string     `json:"name"`
	PricePerM MoneyMinor `json:"price_per_m"`
}

type LaborOperation struct {
	ID            ID         `json:"id"`
	CompanyID     ID        `json:"company_id"`
	Code          string     `json:"code"`
	Name          string     `json:"name"`
	UnitLaborCost MoneyMinor `json:"unit_labor_cost"`
}

type WardrobeConfig struct {
	ProjectID     ID `json:"project_id"`
	Quantity      int `json:"quantity"`
	WidthMM       Millimetres `json:"width_mm"`
	HeightMM      Millimetres `json:"height_mm"`
	DepthMM       Millimetres `json:"depth_mm"`
	MaterialSKU   string `json:"material_sku"`
	EdgeBandSKU   string `json:"edge_band_sku"`
	ShelfCount    int `json:"shelf_count"`
	DoorCount     int `json:"door_count"`
	MarkupBps     int `json:"markup_bps"`
	VatBps        int `json:"vat_bps"`
}

type BOMPart struct {
	Code        string      `json:"code"`
	Name        string      `json:"name"`
	WidthMM     Millimetres `json:"width_mm"`
	HeightMM    Millimetres `json:"height_mm"`
	Quantity    int         `json:"quantity"`
	MaterialSKU string      `json:"material_sku"`
	AreaMM2     int64       `json:"area_mm2"`
}

type EdgeRequirement struct {
	PartCode     string      `json:"part_code"`
	Edge         string      `json:"edge"`
	LengthMM     Millimetres `json:"length_mm"`
	Quantity     int         `json:"quantity"`
	Visibility   string      `json:"visibility"`
	BandSKU      string      `json:"band_sku"`
	Process      string      `json:"process"`
	WasteBps     int64       `json:"waste_bps"`
	SetupMM      Millimetres `json:"setup_mm"`
	BillableMM   Millimetres `json:"billable_mm"`
}

type LaborLine struct {
	Code          string     `json:"code"`
	Name          string     `json:"name"`
	UnitCost      MoneyMinor `json:"unit_cost"`
	Quantity      int        `json:"quantity"`
	TotalCost     MoneyMinor `json:"total_cost"`
	Formula       string     `json:"formula"`
}

type CostCategory struct {
	Category string     `json:"category"`
	Amount   MoneyMinor `json:"amount"`
}

type CostSnapshot struct {
	ID             ID             `json:"id"`
	FormulaVersion string         `json:"formula_version"`
	Categories     []CostCategory `json:"categories"`
	Subtotal       MoneyMinor     `json:"subtotal"`
	Markup         MoneyMinor     `json:"markup"`
	Vat            MoneyMinor     `json:"vat"`
	GrandTotal     MoneyMinor     `json:"grand_total"`
	Provenance     []string       `json:"provenance"`
}

type QuoteDocument struct {
	ID                 ID     `json:"id"`
	CompanyID          ID     `json:"company_id"`
	RevisionID         ID     `json:"revision_id"`
	CostSnapshotID     ID     `json:"cost_snapshot_id"`
	CostSnapshotHash   string `json:"cost_snapshot_hash"`
	CostFormulaVersion string `json:"cost_formula_version"`
	ContentType        string `json:"content_type"`
	SizeBytes          int64  `json:"size_bytes"`
	SHA256             string `json:"sha256"`
	HTML               string `json:"html"`
}

type QuoteRevision struct {
	ID              ID                 `json:"id"`
	CompanyID       ID                `json:"company_id"`
	ProjectID       ID                `json:"project_id"`
	RevisionNumber  int               `json:"revision_number"`
	State           string            `json:"state"`
	ParentRevisionID ID               `json:"parent_revision_id,omitempty"`
	Config          WardrobeConfig    `json:"config"`
	BOM             []BOMPart         `json:"bom"`
	Edges           []EdgeRequirement `json:"edges"`
	Labor           []LaborLine       `json:"labor"`
	Cost            CostSnapshot      `json:"cost"`
	Document        *QuoteDocument    `json:"document,omitempty"`
	Version         int               `json:"version"`
}

type DiffEntry struct {
	Category string `json:"category"`
	Field    string `json:"field"`
	Before   string `json:"before"`
	After    string `json:"after"`
}

type RevisionDiff struct {
	LeftRevisionID  ID          `json:"left_revision_id"`
	RightRevisionID ID          `json:"right_revision_id"`
	Entries         []DiffEntry `json:"entries"`
}
