'use strict';

define('admin/plugins/composer-default', ['settings'], (Settings) => {
	const ACP = {};
	ACP.init = function () {
		Settings.load('composer-default', $('.composer-default-settings'));
		$('#save').on('click', () => {
			Settings.save('composer-default', $('.composer-default-settings'));
		});
	};
	return ACP;
});
