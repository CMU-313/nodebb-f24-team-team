'use strict';

/* global define, $, window, app, screenfull */

define('composer/formatting', [
	'composer/preview',
	'composer/resize',
	'topicThumbs',
	'screenfull',
], (preview, resize, topicThumbs, screenfull) => {
	const formatting = {};
	const formattingDispatchTable = {
		picture: function () {
			const postContainer = this;
			postContainer.find('#files').attr('accept', 'image/*').click();
		},
		upload: function () {
			const postContainer = this;
			postContainer.find('#files').attr('accept', '').click();
		},
		thumbs: function () {
			formatting.exitFullscreen();
			const postContainer = this;
			require(['composer'], (composer) => {
				const uuid = postContainer.get(0).getAttribute('data-uuid');
				const composerObj = composer.posts[uuid];
				const isValidAction = (
					composerObj.action === 'topics.post' ||
                    (composerObj.action === 'posts.edit' && composerObj.isMain)
				);

				if (isValidAction) {
					topicThumbs.modal.open({
						id: uuid,
						pid: composerObj.pid,
					}).then(() => {
						postContainer.trigger('thumb.uploaded');
						composer.updateThumbCount(uuid, postContainer);
					});
				}
			});
		},
		tags: function () {
			const postContainer = this;
			postContainer.find('.tags-container').toggleClass('hidden');
		},
		zen: function () {
			const postContainer = this;
			$(window).one('resize', () => {
				function onResize() {
					if (!screenfull.isFullscreen) {
						app.toggleNavbar(true);
						$('html').removeClass('zen-mode');
						resize.reposition(postContainer);
						$(window).off('resize', onResize);
					}
				}

				if (screenfull.isFullscreen) {
					app.toggleNavbar(false);
					$('html').addClass('zen-mode');
					postContainer.find('.write').focus();
					$(window).on('resize', onResize);
					$(window).one(
						'action:composer.topics.post ' +
                        'action:composer.posts.reply ' +
                        'action:composer.posts.edit ' +
                        'action:composer.discard',
						screenfull.exit
					);
				}
			});

			screenfull.toggle(postContainer.get(0));
			$(window).trigger('action:composer.fullscreen', {
				postContainer: postContainer,
			});
		},
	};

	const buttons = [];

	formatting.exitFullscreen = function () {
		if (screenfull.isEnabled && screenfull.isFullscreen) {
			screenfull.exit();
		}
	};

	formatting.addComposerButtons = function () {
		const formattingBarEl = $('.formatting-bar');
		const fileForm = formattingBarEl.find('.formatting-group #fileForm');

		buttons.forEach((btn) => {
			const markup = Array.isArray(btn.dropdownItems) && btn.dropdownItems.length ?
				generateFormattingDropdown(btn) :
				generateButtonMarkup(btn);
			fileForm.before(markup);
		});

		initializeTooltips(formattingBarEl);
	};

	function generateButtonMarkup(btn) {
		return `
            <li title="${btn.title || ''}">
                <button data-format="${btn.name}" 
                    class="btn btn-sm btn-link text-reset position-relative" 
                    aria-label="${btn.title || ''}">
                    <i class="${btn.iconClass}"></i>
                    ${generateBadgetHtml(btn)}
                </button>
            </li>
        `;
	}

	function initializeTooltips(formattingBarEl) {
		const els = formattingBarEl.find('.formatting-group>li');
		els.tooltip({
			container: '#content',
			animation: false,
			trigger: 'manual',
		}).on('mouseenter', function (ev) {
			const target = $(ev.target);
			const isDropdown = target.hasClass('dropdown-menu') ||
                !!target.parents('.dropdown-menu').length;
			if (!isDropdown) {
				$(this).tooltip('show');
			}
		}).on('click mouseleave', function () {
			$(this).tooltip('hide');
		});
	}

	function generateBadgetHtml(btn) {
		if (!btn.badge) {
			return '';
		}
		return `
            <span class="px-1 position-absolute top-0 start-100 
                translate-middle badge rounded text-bg-info">
            </span>
        `;
	}

	function generateFormattingDropdown(btn) {
		const dropdownItemsHtml = btn.dropdownItems.map(item => `
            <li>
                <a href="#" data-format="${item.name}" 
                    class="dropdown-item rounded-1 position-relative" 
                    role="menuitem">
                    <i class="${item.iconClass} text-secondary"></i> ${item.text}
                    ${generateBadgetHtml(item)}
                </a>
            </li>
        `).join('');

		return `
            <li class="dropdown bottom-sheet" tab-index="-1" title="${btn.title}">
                <button class="btn btn-sm btn-link text-reset" 
                    data-bs-toggle="dropdown" 
                    aria-haspopup="true" 
                    aria-expanded="false" 
                    aria-label="${btn.title}">
                    <i class="${btn.iconClass}"></i>
                </button>
                <ul class="dropdown-menu p-1" role="menu">
                    ${dropdownItemsHtml}
                </ul>
            </li>
        `;
	}

	formatting.addButton = function (iconClass, onClick, title, name) {
		name = name || iconClass.replace('fa fa-', '');
		formattingDispatchTable[name] = onClick;
		buttons.push({ name, iconClass, title });
	};

	formatting.addDropdown = function (data) {
		buttons.push({
			iconClass: data.iconClass,
			title: data.title,
			dropdownItems: data.dropdownItems,
		});

		data.dropdownItems.forEach((btn) => {
			if (btn.name && btn.onClick) {
				formattingDispatchTable[btn.name] = btn.onClick;
			}
		});
	};

	formatting.getDispatchTable = function () {
		return formattingDispatchTable;
	};

	formatting.addButtonDispatch = function (name, onClick) {
		formattingDispatchTable[name] = onClick;
	};

	formatting.addHandler = function (postContainer) {
		postContainer.on('click', '.formatting-bar [data-format]', function (event) {
			const format = $(this).attr('data-format');
			const textarea = $(this).parents('[component="composer"]').find('textarea')[0];

			if (formattingDispatchTable.hasOwnProperty(format)) {
				formattingDispatchTable[format].call(
					postContainer,
					textarea,
					textarea.selectionStart,
					textarea.selectionEnd,
					event
				);
				preview.render(postContainer);
			}
		});
	};

	return formatting;
});
