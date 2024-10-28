'use strict';

/* global define, $, window, utils, app, ajaxify, config, localStorage, sessionStorage */

define('composer/drafts', ['api', 'alerts'], (api, alerts) => {
    const drafts = {};
    const draftSaveDelay = 1000;

    drafts.init = function (postContainer, postData) {
        const draftIconEl = postContainer.find('.draft-icon');
        const uuid = postContainer.attr('data-uuid');

        function doSaveDraft() {
            // check if composer is still around
            if (!$(`[component="composer"][data-uuid="${uuid}"]`).length) {
                return;
            }

            if (!postData.save_id) {
                postData.save_id = utils.generateSaveId(app.user.uid);
            }

            // Post is modified, save to list of opened drafts
            drafts.addToDraftList('available', postData.save_id);
            drafts.addToDraftList('open', postData.save_id);
            saveDraft(postContainer, draftIconEl, postData);
        }

        const debouncedSave = utils.debounce(doSaveDraft, draftSaveDelay);

        postContainer.on('keyup', 'textarea, input.handle, input.title', debouncedSave);
        postContainer.on('click', 'input[type="checkbox"]', debouncedSave);
        postContainer.on('click', '[component="category/list"] [data-cid]', debouncedSave);
        postContainer.on('itemAdded', '.tags', debouncedSave);
        postContainer.on('thumb.uploaded', doSaveDraft);

        draftIconEl.on('animationend', function () {
            $(this).toggleClass('active', false);
        });

        $(window).on('unload', () => {
            // remove all drafts from the open list
            const open = drafts.getList('open');
            if (open.length) {
                open.forEach(save_id => drafts.removeFromDraftList('open', save_id));
            }
        });

        drafts.migrateGuest();
        drafts.migrateThumbs(postContainer, postData);
    };

    function getStorage(uid) {
        return parseInt(uid, 10) > 0 ? localStorage : sessionStorage;
    }

    drafts.get = function (save_id) {
        if (!save_id) {
            return null;
        }

        const uid = save_id.split(':')[1];
        const storage = getStorage(uid);

        try {
            const draftJson = storage.getItem(save_id);
            const draft = JSON.parse(draftJson);

            if (!draft) {
                throw new Error(`can't parse draft json for ${save_id}`);
            }

            draft.save_id = save_id;
            if (draft.timestamp) {
                draft.timestampISO = utils.toISOString(draft.timestamp);
            }

            $(window).trigger('action:composer.drafts.get', {
                save_id,
                draft,
                storage,
            });

            return draft;
        } catch (e) {
            console.warn(`[composer/drafts] Could not get draft ${save_id}, removing`);
            drafts.removeFromDraftList('available');
            drafts.removeFromDraftList('open');
            return null;
        }
    };

    function saveDraft(postContainer, draftIconEl, postData) {
        const isLocalStorage = app.user.uid ? 'localStorage' : 'sessionStorage';
        if (!canSave(isLocalStorage) || !postData?.save_id || !postContainer.length) {
            return;
        }

        const titleEl = postContainer.find('input.title');
        const title = titleEl?.length && titleEl.val();
        const raw = postContainer.find('textarea').val();
        const storage = getStorage(app.user.uid);

        if (raw.length || (title && title.length)) {
            const draftData = {
                save_id: postData.save_id,
                action: postData.action,
                text: raw,
                uuid: postContainer.attr('data-uuid'),
                timestamp: Date.now(),
            };

            if (postData.action === 'topics.post') {
                // New topic only
                const tags = postContainer.find('input.tags').val();
                draftData.tags = tags;
                draftData.title = title;
                draftData.cid = postData.cid;
            } else if (postData.action === 'posts.reply') {
                // new reply only
                draftData.title = postData.title;
                draftData.tid = postData.tid;
                draftData.toPid = postData.toPid;
            } else if (postData.action === 'posts.edit') {
                draftData.pid = postData.pid;
                draftData.title = title || postData.title;
            }

            if (!app.user.uid) {
                draftData.handle = postContainer.find('input.handle').val();
            }

            storage.setItem(postData.save_id, JSON.stringify(draftData));
            $(window).trigger('action:composer.drafts.save', {
                storage,
                postData,
                postContainer,
            });
            draftIconEl.toggleClass('active', true);
        } else {
            drafts.removeDraft(postData.save_id);
        }
    }

    drafts.removeDraft = function (save_id) {
        if (!save_id) {
            return;
        }

        drafts.removeFromDraftList('available', save_id);
        drafts.removeFromDraftList('open', save_id);

        const uid = save_id.split(':')[1];
        const storage = getStorage(uid);
        storage.removeItem(save_id);

        $(window).trigger('action:composer.drafts.remove', {
            storage,
            save_id,
        });
    };

    drafts.getList = function (set) {
        try {
            const draftIds = localStorage.getItem(`drafts:${set}`);
            return JSON.parse(draftIds) || [];
        } catch (e) {
            console.warn('[composer/drafts] Could not read list of available drafts');
            return [];
        }
    };

    drafts.addToDraftList = function (set, save_id) {
        const isLocalStorage = app.user.uid ? 'localStorage' : 'sessionStorage';
        if (!canSave(isLocalStorage) || !save_id) {
            return;
        }

        const list = drafts.getList(set);
        if (!list.includes(save_id)) {
            list.push(save_id);
            localStorage.setItem(`drafts:${set}`, JSON.stringify(list));
        }
    };

    drafts.removeFromDraftList = function (set, save_id) {
        const isLocalStorage = app.user.uid ? 'localStorage' : 'sessionStorage';
        if (!canSave(isLocalStorage) || !save_id) {
            return;
        }

        const list = drafts.getList(set);
        if (list.includes(save_id)) {
            list.splice(list.indexOf(save_id), 1);
            localStorage.setItem(`drafts:${set}`, JSON.stringify(list));
        }
    };

    drafts.migrateGuest = function () {
        if (!(canSave('localStorage') && app.user.uid)) {
            return;
        }

        const test = /^composer:\d+:\d$/;
        const keys = Object.keys(sessionStorage).filter(key => test.test(key));
        const migrated = new Set();

        const renamed = keys.map((key) => {
            const parts = key.split(':');
            parts[1] = app.user.uid;
            const newKey = parts.join(':');
            migrated.add(newKey);
            return newKey;
        });

        keys.forEach((key, idx) => {
            localStorage.setItem(renamed[idx], sessionStorage.getItem(key));
            sessionStorage.removeItem(key);
        });

        migrated.forEach(save_id => {
            drafts.addToDraftList('available', save_id);
        });

        return migrated;
    };

    drafts.migrateThumbs = function (postContainer, postData) {
        if (!app.user.uid) {
            return;
        }

        const newUUID = postContainer.attr('data-uuid');
        const draft = drafts.get(postData.save_id);

        if (draft?.uuid) {
            api.put(`/topics/${draft.uuid}/thumbs`, {
                tid: newUUID,
            }).then(() => {
                require(['composer'], (composer) => {
                    composer.updateThumbCount(newUUID, postContainer);
                });
            });
        }
    };

    drafts.listAvailable = function () {
        return drafts.getList('available')
            .map(drafts.get)
            .filter(Boolean);
    };

    drafts.getAvailableCount = function () {
        return drafts.listAvailable().length;
    };

    drafts.open = function (save_id) {
        if (!save_id) {
            return;
        }
        const draft = drafts.get(save_id);
        openComposer(save_id, draft);
    };

    drafts.loadOpen = function () {
        const shouldNotLoad = (
            ajaxify.data.template.login ||
            ajaxify.data.template.register ||
            (config.hasOwnProperty('openDraftsOnPageLoad') && !config.openDraftsOnPageLoad)
        );

        if (shouldNotLoad) {
            return;
        }

        const available = drafts.getList('available');
        const open = drafts.getList('open');

        available.forEach((save_id) => {
            if (!save_id || open.includes(save_id)) {
                return;
            }

            const draft = drafts.get(save_id);
            if (!draft || (!draft.text && !draft.title)) {
                drafts.removeFromDraftList('available', save_id);
                drafts.removeFromDraftList('open', save_id);
                return;
            }

            openComposer(save_id, draft);
        });
    };

    function openComposer(save_id, draft) {
        const saveObj = save_id.split(':');
        const uid = saveObj[1];

        if (parseInt(app.user.uid, 10) !== parseInt(uid, 10)) {
            return;
        }

        require(['composer'], (composer) => {
            if (draft.action === 'topics.post') {
                composer.newTopic({
                    save_id: draft.save_id,
                    cid: draft.cid,
                    handle: app.user?.uid ? undefined : utils.escapeHTML(draft.handle),
                    title: utils.escapeHTML(draft.title),
                    body: draft.text,
                    tags: String(draft.tags || '').split(','),
                });
            } else if (draft.action === 'posts.reply') {
                api.get(`/topics/${draft.tid}`, {}, (err, topicObj) => {
                    if (err) {
                        return alerts.error(err);
                    }
                    composer.newReply({
                        save_id: draft.save_id,
                        tid: draft.tid,
                        toPid: draft.toPid,
                        title: topicObj.title,
                        body: draft.text,
                    });
                });
            } else if (draft.action === 'posts.edit') {
                composer.editPost({
                    save_id: draft.save_id,
                    pid: draft.pid,
                    title: draft.title ? utils.escapeHTML(draft.title) : undefined,
                    body: draft.text,
                });
            }
        });
    }

    function canSave(type) {
        try {
            const storage = window[type];
            const x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return (
                e instanceof DOMException &&
                (e.code === 22 ||
                    e.code === 1014 ||
                    e.name === 'QuotaExceededError' ||
                    e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                storage?.length !== 0
            );
        }
    }

    return drafts;
});
