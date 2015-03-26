REPORTER = spec
TESTS = $(shell find app -name "*.spec.js")
INTESTS = $(shell find test -name "*.spec.js")

test:
	@NODE_ENV=test ./node_modules/.bin/mocha app/ $(TESTS) \
	--reporter $(REPORTER) \
	--growl \
	--watch

test-once:
	@NODE_ENV=test ./node_modules/.bin/mocha app/ $(TESTS) \
	--reporter $(REPORTER) \
	--growl
	
test-integration:
	@NODE_ENV=test ./node_modules/.bin/mocha $(INTESTS) \
	--reporter $(REPORTER) \
	--growl \
	--watch

.PHONY: test test-once test-integration