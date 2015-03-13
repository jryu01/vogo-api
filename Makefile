REPORTER = spec
TESTS = $(shell find test -name "*.spec.js")
TESTS_UNIT = $(shell find test/unit -name "*.spec.js")
TESTS_NEW = $(shell find app -name "*.spec.js")

test:
	@NODE_ENV=test ./node_modules/.bin/mocha $(TESTS) \
	--reporter $(REPORTER)

test-n:
	@NODE_ENV=test ./node_modules/.bin/mocha app/ $(TESTS_NEW) \
	--reporter $(REPORTER) \
	--growl \
	--watch

test-w:
	@NODE_ENV=test ./node_modules/.bin/mocha $(TESTS) \
	--reporter $(REPORTER) \
	--growl \
	--watch

test-w-unit:
	@NODE_ENV=test ./node_modules/.bin/mocha $(TESTS_UNIT) \
	--reporter $(REPORTER) \
	--growl \
	--watch

.PHONY: test test-n test-w test-w-unit
