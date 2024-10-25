'use strict';

const Iroh = require('iroh');

// Asked help from co-pilot for this function as I needed to simplify parsing for Iroh.
function monitorFunction(fn, name) {
	console.log(`Setting up Iroh monitoring for ${name}`);

	const stage = new Iroh.Stage(`
        function monitored() {
            try {
                return target();
            } catch(e) {
                console.error(e);
                throw e;
            }
        }
    `);

	// Using Iroh's listeners
	stage
		.addListener(Iroh.CALL)
		.on('before', (e) => {
			console.log(`[IROH] ${name} called`);
			e.setData('time', process.hrtime());
		})
		.on('after', (e) => {
			const diff = process.hrtime(e.getData('time'));
			const time = ((diff[0] * 1e9) + diff[1]) / 1e6;
			console.log(`[IROH] ${name} took ${time}ms`);
		});

	// Return the original function with timing
	return async function (...args) {
		const start = process.hrtime();
		console.log(`[START] ${name}`);

		try {
			const result = await fn.apply(this, args);
			const [s, ns] = process.hrtime(start);
			const ms = ((s * 1000) + ns) / 1e6;
			console.log(`[TIME] ${name} took ${ms.toFixed(2)}ms`);
			console.log(`[END] ${name}`);
			return result;
		} catch (error) {
			console.error(`[ERROR] ${name}:`, error);
			throw error;
		}
	};
}

module.exports = {
	monitorFunction: monitorFunction,
	CALL: Iroh.CALL,
	FUNCTION: Iroh.FUNCTION,
	TRY: Iroh.TRY,
};
