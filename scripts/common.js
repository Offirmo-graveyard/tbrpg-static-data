
const KEY_SEPARATOR = '|'

function make_primary_key_builder(model_name, schema) {
	const primary_key_components = schema.offirmo_non_standard.primary_key_components

	return data => [
		model_name,
		primary_key_components.map(key => data[key]).join(',')
	].join(KEY_SEPARATOR)
}

function make_i18n_keys_builder(model_name, schema, lang) {
	const primary_key_builder = make_primary_key_builder(model_name, schema)
	const i18n_keys = [ 'main' ].concat(schema.offirmo_non_standard.extra_i18n_keys[lang] || [])

	return data => i18n_keys.map(key => primary_key_builder(data) + KEY_SEPARATOR + key)
}

module.exports = {
	make_primary_key_builder,
	make_i18n_keys_builder
}
