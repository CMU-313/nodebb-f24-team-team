'use strict';

const assert = require('assert');


const db = require('../mocks/databasemock');
const topics = require('../../src/topics');
const User = require('../../src/user');
const groups = require('../../src/groups');
const Categories = require('../../src/categories');


describe('Anonymous Posts', () => {
	let postObj;
	let adminUid;
	before(async () => {
		// Setup post object with initial values
		adminUid = await User.create({ username: 'admin', password: '123456', picture: 'some-picture-url' });
		await groups.join('administrators', adminUid);
	});

	it('should not modify non-anonymous post ', async () => {
		const userUid = 1;
		postObj = {
			anonymous: false,
			uid: adminUid,
		};
		await topics.addPostData([postObj], userUid);
		assert(postObj.user.displayname === 'admin');
		assert(postObj.user.userslug === 'admin');
		assert(postObj.user.picture === 'some-picture-url');
		assert(postObj.user['icon:text'] === 'A');
	});

	it('should correctly show anonymous post to post author', async () => {
		postObj = {
			anonymous: true,
			uid: adminUid,
		};
		await topics.addPostData([postObj], adminUid);
		assert(postObj.user.displayname === 'admin (anonymous)');
		assert(postObj.user.userslug === '');
		assert(postObj.user.picture === null);
		assert(postObj.user['icon:text'] === 'A');
	});

	it('should correctly show anonymous post to user other than author', async () => {
		const userUid = adminUid + 1;
		postObj = {
			anonymous: true,
			uid: adminUid,
		};
		await topics.addPostData([postObj], userUid);
		assert(postObj.user.displayname === 'Anonymous');
		assert(postObj.user.userslug === '');
		assert(postObj.user.picture === null);
		assert(postObj.user['icon:text'] === 'A');
	});
});

describe('Anonymous Post Thumbnails', () => {
	let topic;
	let adminUid;
	let guestUid;
	let tid;
	before(async () => {
		// Setup post object with initial values
		adminUid = await User.create({ username: 'admin', password: '123456', picture: 'some-picture-url' });
		guestUid = await User.create({ username: 'guest', password: '1235132' });
		await groups.join('administrators', adminUid);
		const category = await (Categories.create({
			name: 'Test Category 1',
			description: 'Test category created by testing script',
		}));
		topic = await (
			topics.post({
				uid: adminUid,
				anonymous: true,
				cid: category.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
			}));
		tid = topic.topicData.tid;
	});

	it('should correctly display teaser for anonymous post to post author', async () => {
		const result = await topics.getTopicsByTids([tid], adminUid);
		assert(result[0].user.username === 'admin 0');
		assert(result[0].user.userslug === 'admin-0');
		assert(result[0].user.picture === 'some-picture-url');
	});
	it('should not display teaser for anonymous post to user that is not author', async () => {
		const result = await topics.getTopicsByTids([tid], guestUid);
		assert(result[0].user.username === 'Anonymous');
		assert(result[0].user.userslug === '');
		assert(result[0].user.picture === null);
		assert(result[0].user['icon:text'] === 'A');
	});
});

describe('User Registration Validation with "anonymous" in the username', () => {
	it('should prevent registration with the username "anonymous"', async () => {
		try {
			await User.create({ username: 'anonymous', password: 'password123', picture: 'some-picture-url' });
			assert.fail('User creation should have failed with the username "anonymous"');
		} catch (err) {
			assert.strictEqual(err.message, 'Invalid username');
		}
	});

	it('should prevent registration with "anonymous" included in the username', async () => {
		try {
			await User.create({ username: 'useranonymous', password: 'password123', picture: 'some-picture-url' });
			assert.fail('User creation should have failed with a username containing "anonymous"');
		} catch (err) {
			assert.strictEqual(err.message, 'Invalid username');
		}
	});

	it('should allow registration with valid usernames that do not contain "anonymous"', async () => {
		const validUsername = 'validUser123';
		const userUid = await User.create({ username: validUsername, password: 'securePass!@#', picture: 'valid-picture-url' });
		assert.ok(userUid, 'User should have been created successfully');
		const user = await User.get(userUid);
		assert.strictEqual(user.username, validUsername);
	});
});