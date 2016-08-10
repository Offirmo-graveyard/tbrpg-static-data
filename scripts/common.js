
const KEY_SEPARATOR = '|'

function make_primary_key_builder(model_name, schema) {
	const human_unique_key_components = schema.offirmo_extensions.human_unique_key_components

	return data => [
		model_name,
		human_unique_key_components.map(key => data[key]).join(',')
	].join(KEY_SEPARATOR)
}

function make_i18n_keys_builder(model_name, schema, lang) {
	const primary_key_builder = make_primary_key_builder(model_name, schema)

	const mandatory_i18n_keys =
		(schema.offirmo_extensions.i18n_keys_mandatory['*'] || [])
		.concat((schema.offirmo_extensions.i18n_keys_mandatory[lang]|| []))

	const optional_i18n_keys =
		(schema.offirmo_extensions.i18n_keys_optional['*'] || [])
			.concat((schema.offirmo_extensions.i18n_keys_optional[lang]|| []))

	return data => ({
		mandatory: mandatory_i18n_keys.map(key => primary_key_builder(data) + KEY_SEPARATOR + key),
		optional: optional_i18n_keys.map(key => primary_key_builder(data) + KEY_SEPARATOR + key),
	})
}

module.exports = {
	make_primary_key_builder,
	make_i18n_keys_builder
}
