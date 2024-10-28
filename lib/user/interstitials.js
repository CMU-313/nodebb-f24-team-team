'use strict';

const winston = require('winston');
const util = require('util');
const user = require('.');
const db = require('../database');
const meta = require('../meta');
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');

const sleep = util.promisify(setTimeout);
const Interstitials = module.exports;

Interstitials.get = async (req, userData) => plugins.hooks.fire('filter:register.interstitial', {
	req,
	userData,
	interstitials: [],
});

Interstitials.email = async (data) => {
	if (!data.userData) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!data.userData.updateEmail) {
		return data;
	}

	const [hasPassword, hasPending] = await Promise.all([
		user.hasPassword(data.userData.uid),
		user.email.isValidationPending(data.userData.uid),
	]);

	let email;
	if (data.userData.uid) {
		email = await user.getUserField(data.userData.uid, 'email');
	}

	data.interstitials.push({
		template: 'partials/email_update',
		data: {
			email,
			requireEmailAddress: meta.config.requireEmailAddress,
			issuePasswordChallenge: hasPassword,
			hasPending,
		},
		callback: async (userData, formData) => {
			if (formData.email) {
				formData.email = String(formData.email).trim();
			}

			if (userData.uid) {
				const isSelf = parseInt(userData.uid, 10) === parseInt(data.req.uid, 10);
				const [
					isPasswordCorrect,
					canEdit,
					{ email: current, 'email:confirmed': confirmed },
					{ allowed, error },
				] = await Promise.all([
					user.isPasswordCorrect(userData.uid, formData.password, data.req.ip),
					privileges.users.canEdit(data.req.uid, userData.uid),
					user.getUserFields(userData.uid, ['email', 'email:confirmed']),
					plugins.hooks.fire('filter:user.saveEmail', {
						uid: userData.uid,
						email: formData.email,
						registration: false,
						allowed: true,
						error: '[[error:invalid-email]]',
					}),
				]);

				if (!isPasswordCorrect) {
					await sleep(2000);
				}

				if (formData.email && formData.email.length) {
					if (!allowed || !utils.isEmailValid(formData.email)) {
						throw new Error(error);
					}

					const isCurrentEmail = formData.email === current;
					const canSendValidation = await user.email.canSendValidation(userData.uid, current);

					if (isCurrentEmail && confirmed) {
						throw new Error('[[error:email-nochange]]');
					} else if (isCurrentEmail && !canSendValidation) {
						throw new Error(
							`[[error:confirm-email-already-sent, ${meta.config.emailConfirmInterval}]]`
						);
					}

					if (canEdit) {
						if (hasPassword && !isPasswordCorrect) {
							throw new Error('[[error:invalid-password]]');
						}

						try {
							await user.email.sendValidationEmail(userData.uid, {
								email: formData.email,
								force: true,
							});
						} catch (err) {
							winston.error(
								`[user.interstitials.email] Validation email failed to send\n[emailer.send] ${err.stack}`
							);
						}

						if (isSelf) {
							data.req.session.emailChanged = 1;
						}
					} else {
						throw new Error('[[error:no-privileges]]');
					}
				} else {
					if (meta.config.requireEmailAddress) {
						throw new Error('[[error:invalid-email]]');
					}

					const shouldRemoveEmail = current.length &&
                        (!hasPassword || (hasPassword && isPasswordCorrect));

					if (shouldRemoveEmail) {
						await user.email.remove(
							userData.uid,
							isSelf ? data.req.session.id : null
						);
					}
				}
			} else {
				const { allowed, error } = await plugins.hooks.fire('filter:user.saveEmail', {
					uid: null,
					email: formData.email,
					registration: true,
					allowed: true,
					error: '[[error:invalid-email]]',
				});

				const isEmailInvalid = !allowed ||
                    (meta.config.requireEmailAddress && !(formData.email && formData.email.length));

				if (isEmailInvalid) {
					throw new Error(error);
				}

				userData.email = formData.email;
			}
			delete userData.updateEmail;
		},
	});
	return data;
};

Interstitials.gdpr = async function (data) {
	const hasConsented = data.userData && data.userData.gdpr_consent;
	if (!meta.config.gdpr_enabled || hasConsented) {
		return data;
	}

	if (!data.userData) {
		throw new Error('[[error:invalid-data]]');
	}

	if (data.userData.uid) {
		const consented = await db.getObjectField(`user:${data.userData.uid}`, 'gdpr_consent');
		if (parseInt(consented, 10)) {
			return data;
		}
	}

	data.interstitials.push({
		template: 'partials/gdpr_consent',
		data: {
			digestFrequency: meta.config.dailyDigestFreq,
			digestEnabled: meta.config.dailyDigestFreq !== 'off',
		},
		callback: function (userData, formData, next) {
			userData.gdpr_consent = formData.gdpr_agree_data === 'on' &&
                formData.gdpr_agree_email === 'on';

			next(userData.gdpr_consent ? null : new Error('[[register:gdpr-consent-denied]]'));
		},
	});
	return data;
};

Interstitials.tou = async function (data) {
	if (!data.userData) {
		throw new Error('[[error:invalid-data]]');
	}

	const shouldSkip = !meta.config.termsOfUse || data.userData.acceptTos;
	if (shouldSkip) {
		return data;
	}

	if (data.userData.uid) {
		const accepted = await db.getObjectField(`user:${data.userData.uid}`, 'acceptTos');
		if (parseInt(accepted, 10)) {
			return data;
		}
	}

	const termsOfUse = await plugins.hooks.fire('filter:parse.post', {
		postData: {
			content: meta.config.termsOfUse || '',
		},
	});

	data.interstitials.push({
		template: 'partials/acceptTos',
		data: {
			termsOfUse: termsOfUse.postData.content,
		},
		callback: function (userData, formData, next) {
			userData.acceptTos = formData['agree-terms'] === 'on';
			next(userData.acceptTos ? null : new Error('[[register:terms-of-use-error]]'));
		},
	});
	return data;
};
