REPORTER = spec
TESTS = $(shell find dist -name "*.spec.js")
INTESTS = $(shell find test -name "*.spec.js")

test:
	@NODE_ENV=development ./node_modules/.bin/mocha dist/ $(TESTS) \
	--reporter $(REPORTER) \
	--growl \
	--watch

test-once:
	@NODE_ENV=test ./node_modules/.bin/mocha dist/ $(TESTS) \
	--reporter $(REPORTER) \
	--growl
	
test-integration:
	@NODE_ENV=test ./node_modules/.bin/mocha $(INTESTS) \
	--reporter $(REPORTER) \
	--growl \
	--watch

.PHONY: test test-once test-integration
