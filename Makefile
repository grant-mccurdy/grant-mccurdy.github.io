.PHONY: all check prose links inventory sitemap site-shell chat-ui assessment-core assessment-manifest accessibility-smoke external-links live-services tracking-contract visual-smoke dashboard-logic publish-hotel-comp check-hotel-comp

PYTHON ?= python3
NODE ?= $(shell command -v node 2>/dev/null || command -v node.exe 2>/dev/null || printf node)

all: check

check: prose links inventory sitemap site-shell chat-ui assessment-core assessment-manifest tracking-contract visual-smoke accessibility-smoke dashboard-logic

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

publish-hotel-comp:
	$(PYTHON) scripts/publish_hotel_comp_site.py

check-hotel-comp:
	$(PYTHON) scripts/publish_hotel_comp_site.py --check
