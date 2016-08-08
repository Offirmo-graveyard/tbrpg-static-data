const path = require('path')

module.exports = {
	models_top_dir: path.join(__dirname, '../src'),
	langs: [ 'en', 'fr' ],
	i18n_subdir: 'i18n',
	migrations_subdir: 'migrations',
}
