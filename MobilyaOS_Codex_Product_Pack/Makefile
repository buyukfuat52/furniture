.PHONY: bootstrap dev test lint typecheck verify seed demo clean

bootstrap:
	npm install
	cd services/core && go mod download
	cd services/compute && python -m pip install -e ".[dev]"

dev:
	docker compose up --build

test:
	cd services/core && go test ./...
	cd services/compute && python -m pytest
	npm run test --workspaces --if-present

lint:
	cd services/core && go vet ./...
	cd services/compute && python -m ruff check .
	npm run lint --workspaces --if-present

typecheck:
	cd services/compute && python -m mypy app
	npm run typecheck --workspaces --if-present

verify: lint typecheck test
	py -3.12 scripts/validate_pack.py .
	py -3.12 scripts/secret_scan.py
	npm run build --workspaces --if-present

seed:
	python scripts/seed_demo.py

demo:
	docker compose up -d postgres nats minio
	$(MAKE) seed
	@echo Demo URLs:
	@echo Web: http://localhost:3000
	@echo Core API: http://localhost:8080/api/v1/health
	@echo Compute API: http://localhost:8090/api/v1/health
	@echo Demo users:
	@echo admin@demo.local / Demo1234!ChangeMe
	@echo satis@demo.local / Demo1234!ChangeMe

clean:
	npm run clean --workspaces --if-present
	cd services/compute && python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in [pathlib.Path('.pytest_cache'), pathlib.Path('.mypy_cache'), pathlib.Path('.ruff_cache')]]"
