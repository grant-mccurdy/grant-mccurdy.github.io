.PHONY: all check links visual-smoke

PYTHON ?= python3
NODE ?= $(shell command -v node 2>/dev/null || command -v node.exe 2>/dev/null || printf node)

all: check

check: links visual-smoke

links:
	$(PYTHON) scripts/check_links.py

visual-smoke:
	"$(NODE)" scripts/visual_smoke.mjs
