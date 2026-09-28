.PHONY: all check prose links inventory sitemap site-shell profile-positioning chat-ui assessment-core assessment-manifest accessibility-smoke external-links live-services tracking-contract visual-smoke dashboard-logic

PYTHON ?= python3
NODE ?= $(shell command -v node 2>/dev/null || command -v node.exe 2>/dev/null || printf node)

all: check

check: prose links inventory sitemap site-shell profile-positioning chat-ui assessment-core assessment-manifest logos-alignment department-dashboard tracking-contract visual-smoke accessibility-smoke dashboard-logic

.PHONY: logos-alignment department-dashboard
logos-alignment:
	$(PYTHON) scripts/sync_logos_report.py --check
	$(PYTHON) scripts/test_logos_import.py

department-dashboard:
	"$(NODE)" scripts/department_dashboard_smoke.mjs

prose:
	$(PYTHON) scripts/check_prose_conventions.py

links:
	$(PYTHON) scripts/check_links.py

inventory:
	"$(NODE)" scripts/check_portfolio_inventory.mjs

sitemap:
	"$(NODE)" scripts/build_sitemap.mjs --check

site-shell:
	"$(NODE)" scripts/check_site_shell.mjs

profile-positioning:
	"$(NODE)" scripts/check_profile_positioning.mjs

chat-ui:
	"$(NODE)" scripts/chat_ui_smoke.mjs

assessment-core:
	"$(NODE)" scripts/assessment_core_smoke.mjs

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
