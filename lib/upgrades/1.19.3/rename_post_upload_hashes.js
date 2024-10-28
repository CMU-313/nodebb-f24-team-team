'use strict';

const crypto = require('crypto');
const db = require('../../database');
const batch = require('../../batch');

const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

module.exports = {
	name: 'Rename object and sorted sets used in post uploads',
	timestamp: Date.UTC(2022, 1, 10),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			let keys = pids.map(pid => `post:${pid}:uploads`);
			const exists = await db.exists(keys);
			keys = keys.filter((key, idx) => exists[idx]);
			progress.incr(pids.length);

			const processKeys = async (keys) => {
				const uploadPromises = keys.map(async (key) => {
					const uploads = (await db.getSortedSetRangeWithScores(key, 0, -1))
						.filter(upload => upload && upload.value && !upload.value.startsWith('files/'));

					if (!uploads.length) {
						return null;
					}

					const operations = [
						db.sortedSetRemove(key, uploads.map(upload => upload.value)),
						db.sortedSetAdd(
							key,
							uploads.map(upload => upload.score),
							uploads.map(upload => `files/${upload.value}`)
						),
					];

					const hashes = uploads.map(upload => md5(upload.value));
					const newHashes = uploads.map(upload => md5(`files/${upload.value}`));

					const oldData = await db.getObjects(hashes.map(hash => `upload:${hash}`));

					const bulkSet = oldData.reduce((acc, data, idx) => {
						if (data) {
							acc.push([`upload:${newHashes[idx]}`, data]);
						}
						return acc;
					}, []);

					if (bulkSet.length) {
						operations.push(db.setObjectBulk(bulkSet));
					}

					operations.push(
						db.deleteAll(hashes.map(hash => `upload:${hash}`)),
						...hashes.map((hash, idx) => db.rename(`upload:${hash}:pids`, `upload:${newHashes[idx]}:pids`))
					);

					await Promise.all(operations);
				});

				await Promise.all(uploadPromises);
			};

			await processKeys(keys);
		}, {
			batch: 100,
			progress: progress,
		});
	},
};
