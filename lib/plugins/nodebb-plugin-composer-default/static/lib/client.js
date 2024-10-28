'use strict';

$(document).ready(() => {
	$(window).on('action:app.load', () => {
		require(['composer/drafts'], (drafts) => {
			drafts.migrateGuest();
			drafts.loadOpen();
		});
	});
	$(window).on('action:composer.topic.new', (ev, data) => {
		if (config['composer-default'].composeRouteEnabled !== 'on') {
			require(['composer'], (composer) => {
				composer.newTopic({
					cid: data.cid,
					title: data.title || '',
					body: data.body || '',
					tags: data.tags || [],
				});
			});
		} else {
			ajaxify.go(`compose?cid=${data.cid}${data.title ? `&title=${encodeURIComponent(data.title)}` : ''}${data.body ? `&body=${encodeURIComponent(data.body)}` : ''}`);
		}
	});
	$(window).on('action:composer.post.edit', (ev, data) => {
		if (config['composer-default'].composeRouteEnabled !== 'on') {
			require(['composer'], (composer) => {
				composer.editPost({
					pid: data.pid,
				});
			});
		} else {
			ajaxify.go(`compose?pid=${data.pid}`);
		}
	});
	$(window).on('action:composer.post.new', (ev, data) => {
		// backwards compatibility
		data.body = data.body || data.text;
		data.title = data.title || data.topicName;
		if (config['composer-default'].composeRouteEnabled !== 'on') {
			require(['composer'], (composer) => {
				composer.newReply({
					tid: data.tid,
					toPid: data.pid,
					title: data.title,
					body: data.body,
				});
			});
		} else {
			ajaxify.go(`compose?tid=${data.tid}${data.pid ? `&toPid=${data.pid}` : ''}${data.title ? `&title=${encodeURIComponent(data.title)}` : ''}${data.body ? `&body=${encodeURIComponent(data.body)}` : ''}`);
		}
	});
	$(window).on('action:composer.addQuote', (ev, data) => {
		data.body = data.body || data.text;
		data.title = data.title || data.topicName;
		if (config['composer-default'].composeRouteEnabled !== 'on') {
			require(['composer'], (composer) => {
				const topicUUID = composer.findByTid(data.tid);
				composer.addQuote({
					tid: data.tid,
					toPid: data.pid,
					selectedPid: data.selectedPid,
					title: data.title,
					username: data.username,
					body: data.body,
					uuid: topicUUID,
				});
			});
		} else {
			ajaxify.go(`compose?tid=${data.tid}&toPid=${data.pid}&quoted=1&username=${data.username}`);
		}
	});
	$(window).on('action:composer.enhance', (ev, data) => {
		require(['composer'], (composer) => {
			composer.enhance(data.container);
		});
	});
});
