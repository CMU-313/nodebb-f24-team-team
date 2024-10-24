'use strict';

define('composer/tags', ['alerts'], (alerts) => {
	const tags = {};
	let minTags;
	let maxTags;
	tags.init = function (postContainer, postData) {
		const tagEl = postContainer.find('.tags');
		if (!tagEl.length) {
			return;
		}
		minTags = ajaxify.data.hasOwnProperty('minTags') ? ajaxify.data.minTags : config.minimumTagsPerTopic;
		maxTags = ajaxify.data.hasOwnProperty('maxTags') ? ajaxify.data.maxTags : config.maximumTagsPerTopic;
		tagEl.tagsinput({
			tagClass: 'badge bg-info rounded-1',
			confirmKeys: [13, 44],
			trimValue: true,
		});
		const input = postContainer.find('.bootstrap-tagsinput input');
		toggleTagInput(postContainer, postData, ajaxify.data);
		app.loadJQueryUI(() => {
			input.autocomplete({
				delay: 100,
				position: {
					my: 'left bottom',
					at: 'left top',
					collision: 'flip',
				},
				appendTo: postContainer.find('.bootstrap-tagsinput'),
				open: function () {
					$(this).autocomplete('widget').css('z-index', 20000);
				},
				source: function (request, response) {
					socket.emit('topics.autocompleteTags', {
						query: request.term,
						cid: postData.cid,
					}, (err, tags) => {
						if (err) {
							return alerts.error(err);
						}
						if (tags) {
							response(tags);
						}
						$('.ui-autocomplete a').attr('data-ajaxify', 'false');
					});
				},
				select: function /* event, ui */
				() {
					// when autocomplete is selected from the dropdown simulate a enter key down to turn it into a tag
					triggerEnter(input);
				},
			});
			addTags(postData.tags, tagEl);
			tagEl.on('beforeItemAdd', (event) => {
				const reachedMaxTags = maxTags && maxTags <= tags.getTags(postContainer.attr('data-uuid')).length;
				const cleanTag = utils.cleanUpTag(event.item, config.maximumTagLength);
				const different = cleanTag !== event.item;
				event.cancel = different || event.item.length < config.minimumTagLength || event.item.length > config.maximumTagLength || reachedMaxTags;
				if (event.item.length < config.minimumTagLength) {
					return alerts.error(`[[error:tag-too-short, ${config.minimumTagLength}]]`);
				} else if (event.item.length > config.maximumTagLength) {
					return alerts.error(`[[error:tag-too-long, ${config.maximumTagLength}]]`);
				} else if (reachedMaxTags) {
					return alerts.error(`[[error:too-many-tags, ${maxTags}]]`);
				}
				if (different) {
					tagEl.tagsinput('add', cleanTag);
				}
			});
			let skipAddCheck = false;
			let skipRemoveCheck = false;
			tagEl.on('itemRemoved', (event) => {
				if (skipRemoveCheck) {
					skipRemoveCheck = false;
					return;
				}
				if (!event.item) {
					return;
				}
				socket.emit('topics.canRemoveTag', {
					tag: event.item,
				}, (err, allowed) => {
					if (err) {
						return alerts.error(err);
					}
					if (!allowed) {
						alerts.error('[[error:cant-remove-system-tag]]');
						skipAddCheck = true;
						tagEl.tagsinput('add', event.item);
					}
				});
			});
			tagEl.on('itemAdded', (event) => {
				if (skipAddCheck) {
					skipAddCheck = false;
					return;
				}
				const cid = postData.hasOwnProperty('cid') ? postData.cid : ajaxify.data.cid;
				socket.emit('topics.isTagAllowed', {
					tag: event.item,
					cid: cid || 0,
				}, (err, allowed) => {
					if (err) {
						return alerts.error(err);
					}
					if (!allowed) {
						skipRemoveCheck = true;
						return tagEl.tagsinput('remove', event.item);
					}
					$(window).trigger('action:tag.added', {
						cid: cid,
						tagEl: tagEl,
						tag: event.item,
					});
					if (input.length) {
						input.autocomplete('close');
					}
				});
			});
		});
		input.attr('tabIndex', tagEl.attr('tabIndex'));
		input.on('blur', () => {
			triggerEnter(input);
		});
		$('[component="composer/tag/dropdown"]').on('click', 'li', function () {
			const tag = $(this).attr('data-tag');
			if (tag) {
				addTags([tag], tagEl);
			}
			return false;
		});
	};
	tags.isEnoughTags = function (post_uuid) {
		return tags.getTags(post_uuid).length >= minTags;
	};
	tags.minTagCount = function () {
		return minTags;
	};
	tags.onChangeCategory = function (postContainer, postData, cid, categoryData) {
		const tagDropdown = postContainer.find('[component="composer/tag/dropdown"]');
		if (!tagDropdown.length) {
			return;
		}
		toggleTagInput(postContainer, postData, categoryData);
		tagDropdown.toggleClass('hidden', !categoryData.tagWhitelist || !categoryData.tagWhitelist.length);
		if (categoryData.tagWhitelist) {
			app.parseAndTranslate('composer', 'tagWhitelist', {
				tagWhitelist: categoryData.tagWhitelist,
			}, (html) => {
				tagDropdown.find('.dropdown-menu').html(html);
			});
		}
	};
	function toggleTagInput(postContainer, postData, data) {
		const tagEl = postContainer.find('.tags');
		const input = postContainer.find('.bootstrap-tagsinput input');
		if (!input.length) {
			return;
		}
		if (data.hasOwnProperty('minTags')) {
			minTags = data.minTags;
		}
		if (data.hasOwnProperty('maxTags')) {
			maxTags = data.maxTags;
		}
		if (data.tagWhitelist && data.tagWhitelist.length) {
			input.attr('readonly', '');
			input.attr('placeholder', '');
			tagEl.tagsinput('items').slice().forEach((tag) => {
				if (data.tagWhitelist.indexOf(tag) === -1) {
					tagEl.tagsinput('remove', tag);
				}
			});
		} else {
			input.removeAttr('readonly');
			input.attr('placeholder', postContainer.find('input.tags').attr('placeholder'));
		}
		postContainer.find('.tags-container').toggleClass('haswhitelist', !!(data.tagWhitelist && data.tagWhitelist.length));
		postContainer.find('.tags-container').toggleClass('hidden', data.privileges && data.privileges.hasOwnProperty('topics:tag') && !data.privileges['topics:tag'] || maxTags === 0 && !postData && !postData.tags && !postData.tags.length);
		if (data.privileges && data.privileges.hasOwnProperty('topics:tag') && !data.privileges['topics:tag']) {
			tagEl.tagsinput('removeAll');
		}
		$(window).trigger('action:tag.toggleInput', {
			postContainer: postContainer,
			tagWhitelist: data.tagWhitelist,
			tagsInput: input,
		});
	}
	function triggerEnter(input) {
		// http://stackoverflow.com/a/3276819/583363
		const e = jQuery.Event('keypress');
		e.which = 13;
		e.keyCode = 13;
		setTimeout(() => {
			input.trigger(e);
		}, 100);
	}
	function addTags(tags, tagEl) {
		if (tags && tags.length) {
			for (let i = 0; i < tags.length; ++i) {
				tagEl.tagsinput('add', tags[i]);
			}
		}
	}
	tags.getTags = function (post_uuid) {
		return $(`.composer[data-uuid="${post_uuid}"] .tags`).tagsinput('items');
	};
	return tags;
});
