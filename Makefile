.PHONY: all check links external-links visual-smoke dashboard-logic

PYTHON ?= python3
NODE ?= $(shell command -v node 2>/dev/null || command -v node.exe 2>/dev/null || printf node)

all: check

check: links visual-smoke dashboard-logic

links:
	$(PYTHON) scripts/check_links.py

external-links:
	$(PYTHON) scripts/check_external_links.py

visual-smoke:
	"$(NODE)" scripts/visual_smoke.mjs

dashboard-logic:
	"$(NODE)" scripts/dashboard_logic_smoke.mjs
