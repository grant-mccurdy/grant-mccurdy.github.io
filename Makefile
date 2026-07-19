.PHONY: all check links inventory assessment-manifest accessibility-smoke external-links live-services tracking-contract visual-smoke dashboard-logic publish-hotel-comp

PYTHON ?= python3
NODE ?= $(shell command -v node 2>/dev/null || command -v node.exe 2>/dev/null || printf node)

all: check

check: links inventory assessment-manifest tracking-contract visual-smoke accessibility-smoke dashboard-logic

links:
	$(PYTHON) scripts/check_links.py

inventory:
	"$(NODE)" scripts/check_portfolio_inventory.mjs

assessment-manifest:
	$(PYTHON) scripts/check_assessment_manifest.py

external-links:
	$(PYTHON) scripts/check_external_links.py

live-services:
	"$(NODE)" scripts/live_service_smoke.mjs

tracking-contract:
	"$(NODE)" scripts/check_tracking_contract.mjs

visual-smoke:
	"$(NODE)" scripts/visual_smoke.mjs

accessibility-smoke:
	"$(NODE)" scripts/accessibility_smoke.mjs

dashboard-logic:
	"$(NODE)" scripts/dashboard_logic_smoke.mjs

publish-hotel-comp:
	$(PYTHON) scripts/publish_hotel_comp_site.py
