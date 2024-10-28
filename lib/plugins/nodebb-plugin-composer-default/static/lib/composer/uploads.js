'use strict';

/* global define, $, window, utils, ajaxify, app, config */

define('composer/uploads', [
	'composer/preview',
	'composer/categoryList',
	'translator',
	'alerts',
	'uploadHelpers',
	'jquery-form',
], (preview, categoryList, translator, alerts, uploadHelpers) => {
	const uploads = {
		inProgress: {},
	};
	let uploadingText = '';

	uploads.initialize = function (post_uuid) {
		initializeDragAndDrop(post_uuid);
		initializePaste(post_uuid);
		addChangeHandlers(post_uuid);
		addTopicThumbHandlers(post_uuid);
		translator.translate(`[[modules:composer.uploading, ${0}%]]`, (translated) => {
			uploadingText = translated;
		});
	};

	function addChangeHandlers(post_uuid) {
		const postContainer = $(`.composer[data-uuid="${post_uuid}"]`);
		postContainer.find('#files').on('change', function (e) {
			const files = (e.target || {}).files || ($(this).val() ? [{
				name: $(this).val(),
				type: utils.fileMimeType($(this).val()),
			}] : null);

			if (files) {
				uploadContentFiles({
					files: files,
					post_uuid: post_uuid,
					route: '/api/post/upload',
				});
			}
		});
	}

	function addTopicThumbHandlers(post_uuid) {
		const postContainer = $(`.composer[data-uuid="${post_uuid}"]`);

		postContainer.on('click', '.topic-thumb-clear-btn', function (e) {
			e.preventDefault();
			postContainer.find('input#topic-thumb-url').val('').trigger('change');
			resetInputFile(postContainer.find('input#topic-thumb-file'));
			$(this).addClass('hide');
		});

		postContainer.on('paste change keypress', 'input#topic-thumb-url', function () {
			const urlEl = $(this);
			setTimeout(() => {
				const url = urlEl.val();
				const clearBtn = postContainer.find('.topic-thumb-clear-btn');
				const fileInput = postContainer.find('input#topic-thumb-file');

				if (url) {
					clearBtn.removeClass('hide');
				} else {
					resetInputFile(fileInput);
					clearBtn.addClass('hide');
				}

				postContainer.find('img.topic-thumb-preview').attr('src', url);
			}, 100);
		});
	}

	function resetInputFile($el) {
		$el.wrap('<form />').closest('form').get(0).reset();
		$el.unwrap();
	}

	function initializeDragAndDrop(post_uuid) {
		const postContainer = $(`.composer[data-uuid="${post_uuid}"]`);
		uploadHelpers.handleDragDrop({
			container: postContainer,
			callback: function (upload) {
				uploadContentFiles({
					files: upload.files,
					post_uuid: post_uuid,
					route: '/api/post/upload',
					formData: upload.formData,
				});
			},
		});
	}

	function initializePaste(post_uuid) {
		const postContainer = $(`.composer[data-uuid="${post_uuid}"]`);
		uploadHelpers.handlePaste({
			container: postContainer,
			callback: function (upload) {
				uploadContentFiles({
					files: upload.files,
					fileNames: upload.fileNames,
					post_uuid: post_uuid,
					route: '/api/post/upload',
					formData: upload.formData,
				});
			},
		});
	}

	function escapeRegExp(text) {
		return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
	}

	function insertText(str, index, insert) {
		return str.slice(0, index) + insert + str.slice(index);
	}

	function uploadContentFiles(params) {
		const files = [...params.files];
		const { post_uuid } = params;
		const postContainer = $(`.composer[data-uuid="${post_uuid}"]`);
		const textarea = postContainer.find('textarea');
		const uploadForm = postContainer.find('#fileForm');
		let doneUploading = false;
		let text = textarea.val();

		uploadForm.attr('action', config.relative_path + params.route);

		let cid = categoryList.getSelectedCid();
		if (!cid && ajaxify.data.cid) {
			cid = ajaxify.data.cid;
		}

		// Check privileges for each file
		for (const file of files) {
			const isImage = file.type.match(/image./);
			const hasImagePrivilege = app.user.privileges['upload:post:image'];
			const hasFilePrivilege = app.user.privileges['upload:post:file'];

			if ((isImage && !hasImagePrivilege) || (!isImage && !hasFilePrivilege)) {
				return alerts.error('[[error:no-privileges]]');
			}
		}

		// Create filename mapping and text
		const filenameMapping = files.map((file, i) => `${i}_${Date.now()}_${params.fileNames ? params.fileNames[i] : file.name}`);

		const filesText = files.map((file, i) => {
			const isImage = file.type.match(/image./);
			const fileSize = parseInt(config.maximumFileSize, 10) * 1024;

			if (!app.user.isAdmin && file.size > fileSize) {
				uploadForm[0].reset();
				throw new Error(`[[error:file-too-big, ${config.maximumFileSize}]]`);
			}

			return `${isImage ? '!' : ''}[${filenameMapping[i]}](${uploadingText}) `;
		}).join('');

		const cursorPosition = textarea.getCursorPosition();
		const textLen = text.length;
		text = insertText(text, cursorPosition, filesText);

		if (uploadForm.length) {
			postContainer.find('[data-action="post"]').prop('disabled', true);
		}

		textarea.val(text);

		$(window).trigger('action:composer.uploadStart', {
			post_uuid: post_uuid,
			files: filenameMapping.map((filename, i) => ({
				filename: filename.replace(/^\d+_\d{13}_/, ''),
				isImage: /image./.test(files[i].type),
			})),
			text: uploadingText,
		});

		function updateTextArea(filename, text, trim) {
			const newFilename = trim ? filename.replace(/^\d+_\d{13}_/, '') : filename;
			const current = textarea.val();
			const re = new RegExp(`${escapeRegExp(filename)}]\\([^)]+\\)`, 'g');

			textarea.val(current.replace(re, `${newFilename || filename}](${text})`));

			$(window).trigger('action:composer.uploadUpdate', {
				post_uuid: post_uuid,
				filename: filename,
				text: text,
			});
		}

		uploads.inProgress[post_uuid] = uploads.inProgress[post_uuid] || [];
		uploads.inProgress[post_uuid].push(1);

		if (params.formData) {
			params.formData.append('cid', cid);
		}

		uploadForm.off('submit').submit(function () {
			$(this).ajaxSubmit({
				headers: {
					'x-csrf-token': config.csrf_token,
				},
				resetForm: true,
				clearForm: true,
				formData: params.formData,
				data: { cid: cid },
				error: function (xhr) {
					doneUploading = true;
					postContainer.find('[data-action="post"]').prop('disabled', false);
					const errorMsg = onUploadError(xhr, post_uuid);
					filenameMapping.forEach((filename) => {
						updateTextArea(filename, errorMsg, true);
					});
					preview.render(postContainer);
				},
				uploadProgress: function (event, position, total, percent) {
					if (doneUploading) return;

					translator.translate(`[[modules:composer.uploading, ${percent}%]]`, (translated) => {
						filenameMapping.forEach((filename) => {
							updateTextArea(filename, translated);
						});
					});
				},
				success: function (res) {
					doneUploading = true;
					const uploads = res.response.images;

					if (uploads && uploads.length) {
						uploads.forEach((upload, i) => {
							upload.filename = filenameMapping[i].replace(/^\d+_\d{13}_/, '');
							upload.isImage = /image./.test(files[i].type);
							updateTextArea(filenameMapping[i], upload.url, true);
						});
					}

					preview.render(postContainer);
					textarea.prop('selectionEnd', cursorPosition + textarea.val().length - textLen);
					textarea.focus();
					postContainer.find('[data-action="post"]').prop('disabled', false);

					$(window).trigger('action:composer.upload', {
						post_uuid: post_uuid,
						files: uploads,
					});
				},
				complete: function () {
					uploadForm[0].reset();
					uploads.inProgress[post_uuid].pop();
				},
			});
			return false;
		});

		uploadForm.submit();
	}

	function onUploadError(xhr, post_uuid) {
		const msg = xhr.responseJSON &&
            (xhr.responseJSON.error ||
            (xhr.responseJSON.status && xhr.responseJSON.status.message)) ||
            (xhr.status === 413 ? (xhr.statusText || 'Request Entity Too Large') : '[[error:parse-error]]');

		alerts.error(msg);

		$(window).trigger('action:composer.uploadError', {
			post_uuid: post_uuid,
			message: msg,
		});

		return msg;
	}

	return uploads;
});
