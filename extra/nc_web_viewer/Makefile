all: sdss/bundle.js

sdss/bundle.js: sdss/sdss.js
	browserify sdss/sdss.js --ignore-missing -d -o sdss/bundle.js -v
