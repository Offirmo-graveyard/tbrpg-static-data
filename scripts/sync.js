const path = require('path')
const _ = require('@offirmo/cli-toolbox/lodash')
const jsen = require('jsen')
const visual_tasks = require('@offirmo/cli-toolbox/stdout/visual_tasks')
const fs = require('@offirmo/cli-toolbox/fs/extra')
const json = require('@offirmo/cli-toolbox/fs/json')
const tildify = require('@offirmo/cli-toolbox/string/tildify')
const prettify_json = require('@offirmo/cli-toolbox/string/prettify-json')

const MODELS_TOP_DIR = path.join(__dirname, '../data')
const langs = [ 'en', 'fr' ]

let models = []

visual_tasks.run([
	{
		title: 'Gathering list of models',
		task: () => {
			models = fs.lsDirs(MODELS_TOP_DIR)
		}
	},
	{
		title: 'Synchronizing models',
		task: () => {
			return visual_tasks.create(models.map(model => ({
				title: `Synchronizing "${model}"`,
				skip: () => (model[0] === '_') ? 'experimental model, not ready yet.' : undefined,
				task: synchronize_model.bind(undefined, model)
			})), {concurrent: true})
		}
	},
	{
		title: 'All done',
		task: () => {}
	}
])
.catch(err => {
	console.error(prettify_json(err))
})



function synchronize_model(model) {
	const model_top_dir = path.join(MODELS_TOP_DIR, model)
	const model_i18n_dir = path.join(model_top_dir, 'i18n')
	const model_migrations_dir = path.join(model_top_dir, 'migrations')

	const schema_path = path.join(model_top_dir, 'schema.json')

	let schema, data, data_keys = [], bad_data_entries = []

	return visual_tasks.create([
		{
			title: `Reading schema ${tildify(schema_path)}`,
			task: () => json.read(schema_path).then(s => schema = s)
		},
		{
			title: `Ensuring schema validity`,
			task: () => {
				console.log(schema)
				const is_schema_valid = jsen({'$ref': 'http://json-schema.org/draft-04/schema#'})(schema)
				if (! is_schema_valid)
					throw new Error(`schema is invalid !`)
			}
		},
		{
			title: `Reading data`,
			task: () => data = require(model_top_dir)
		},
		{
			title: `Ensuring data validity`,
			task: () => {
				const validate = jsen(schema, {
					greedy: true,
					formats: {},
				})

				const err = new Error(`Model ${model}: provided data are invalid !`)
				err.errors = []

				data.forEach((entry, index) => {
					if (! _.isObject(entry)) {
						console.error(`${model_top_dir} entry #${index} is not an object !`, entry)
						bad_data_entries.push[entry]
						return
					}
					if (!entry.hid) {
						console.error(`${model_top_dir} entry #${index} is missing its hid !`, entry)
						bad_data_entries.push[entry]
						return
					}

					data_keys.push(entry.hid)

					if (! validate(entry)) {
						err.errors.push({
							hid: entry.hid,
							bad_data: entry,
							validation_errors: _.cloneDeep(validate.errors)
						})
					}
				})

				if (err.errors.length)
					throw err
			}
		},
		{
			title: `sorting data`,
			skip: () => 'not implemented',
			task: () => { /* TODO */ }
		},
		{
			title: `Ensuring migrations dir ${tildify(model_migrations_dir)}`,
			task: () => fs.ensureDirSync(model_migrations_dir)
		},
		{
			title: `Ensuring i18n dir`,
			task: () => fs.ensureDirSync(model_i18n_dir)
		},
		{
			title: `Ensuring i18n files`,
			task: () => langs.map(lang => {
				const lang_file_path = path.join(model_i18n_dir, lang + '.json')
				return fs.ensureFileSync(lang_file_path)
			})
		},
		{
			title: `Ensuring i18n contents`,
			task: () => visual_tasks.create(langs.map(lang => ({
				title: `Ensuring i18n contents for "${lang}"`,
				task: () => {
					let err
					const lang_file_path = path.join(model_i18n_dir, lang + '.json')
					return json.read(lang_file_path)
						.catch(err => {
							if (_.s.startsWith(err.message, 'No data, empty input'))
								return {}
							throw err
						})
						.then(i18n_data => {
						console.log(lang, i18n_data)
						i18n_data.lang = lang
						const i18n_keys = []
						_.forEach(i18n_data, (value, key) => {
							if (! _.isString(value)) console.error(`i18n for lang ${lang} for key ${key} value is not a string !`)
							if (key === 'lang') return
							if (key[0] === '_') return
							i18n_keys.push(key)
						})

						// check if i18n matches with data
						const mismatched_keys = _.xor(data_keys, i18n_keys);
						mismatched_keys.forEach(key => {
							if (data_keys.includes(key)) {
								console.error(`Model data entry "${key}" has no i18n for ${lang} !`)
								// add a filler i18n entry
							}
							else {
								console.error(`Model data i18n references an unknown data "${key}" !`)
							}
						})

						json.write(lang_file_path, i18n_data, { sortKeys: true })
						return err
					})
				}
			})), {concurrent: true})
		},
	])

}
