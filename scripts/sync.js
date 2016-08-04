const path = require('path')
const _ = require('@offirmo/cli-toolbox/lodash')
const jsen = require('jsen')
const visual_tasks = require('@offirmo/cli-toolbox/stdout/visual_tasks')
const fs = require('@offirmo/cli-toolbox/fs/extra')
const json = require('@offirmo/cli-toolbox/fs/json')
const tildify = require('@offirmo/cli-toolbox/string/tildify')
const prettify_json = require('@offirmo/cli-toolbox/string/prettify-json')
const columnify = require('@offirmo/cli-toolbox/string/columnify')

const make_primary_key_builder = require('./common').make_primary_key_builder
const make_i18n_keys_builder = require('./common').make_i18n_keys_builder

const MODELS_TOP_DIR = path.join(__dirname, '../data')
const langs = [ 'en', 'fr' ]

let models = []

require('@offirmo/cli-toolbox/stdout/clear-cli')()

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


const errors = {}

function synchronize_model(model) {
	const model_top_dir = path.join(MODELS_TOP_DIR, model)
	const model_i18n_dir = path.join(model_top_dir, 'i18n')
	const model_migrations_dir = path.join(model_top_dir, 'migrations')

	const schema_path = path.join(model_top_dir, 'schema.json')

	let schema, entries, bad_data_entries = [], entries_by_primary_key = {}

	return visual_tasks.create([
		{
			title: `Reading schema ${tildify(schema_path)}`,
			task: () => json.read(schema_path).then(s => schema = s)
		},
		{
			title: `Ensuring schema validity`,
			task: () => {
				const is_schema_valid = jsen({'$ref': 'http://json-schema.org/draft-04/schema#'})(schema)
				if (! is_schema_valid)
					throw new Error(`schema is invalid !`)
			}
		},
		{
			title: `Reading data`,
			task: () => entries = require(model_top_dir)
		},
		{
			title: `Ensuring data validity`,
			task: () => {
				const primary_key_builder = make_primary_key_builder(model, schema)
				const validate = jsen(schema, {
					greedy: true,
					formats: {},
				})

				const err = new Error(`Model ${model}: provided data are invalid !`)
				err.errors = []

				entries.forEach((entry, index) => {
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

					if (! validate(entry)) {
						err.errors.push({
							hid: entry.hid,
							bad_data: entry,
							validation_errors: _.cloneDeep(validate.errors)
						})
					}
					else {
						const primary_key = primary_key_builder(entry)
						entries_by_primary_key[primary_key] = entry
					}
				})

				if (err.errors.length)
					throw err

				//console.log(columnify(Object.keys(entries_by_primary_key)))
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
				title: `Ensuring i18n content for "${lang}"`,
				task: () => {
					const i18n_keys_builder = make_i18n_keys_builder(model, schema, lang)
					let err
					const lang_file_path = path.join(model_i18n_dir, lang + '.json')
					return json.read(lang_file_path)
					.catch(err => {
						if (_.s.startsWith(err.message, 'No data, empty input'))
							return {}
						throw err
					})
					.then(i18n_data => {
						i18n_data.lang = lang

						const i18n_keys_found = []
						_.forEach(i18n_data, (value, key) => {
							if (! _.isString(value)) console.error(`i18n for lang ${lang} for key ${key} value is not a string !`)
							if (key === 'lang') return
							if (key[0] === '_') return
							i18n_keys_found.push(key)
						})
						//console.log(`i18n_keys_found for lang ${lang}\n` + columnify(i18n_keys_found))

						const i18n_keys_expected = _.flattenDeep(_.values(entries_by_primary_key).map(i18n_keys_builder))
						//console.log(`i18n_keys_expected for lang ${lang}\n` + columnify(i18n_keys_expected))

						// check if i18n matches with data
						const mismatched_keys = _.xor(i18n_keys_expected, i18n_keys_found);
						const extraneous_i18n_keys = []
						mismatched_keys.forEach(i18n_key => {
							if (i18n_keys_expected.includes(i18n_key)) {
								// add a filler i18n entry
								i18n_data[i18n_key] = `[TOTRANSLATE:${i18n_key}]`
							}
							else
								extraneous_i18n_keys.push(i18n_key)
						})

						const untranslated_i18n_keys = _.values(i18n_data).filter(s => _.isString(s) && _.s.startsWith(s, '[TOTRANSLATE'))
						if (untranslated_i18n_keys.length)
							console.error(`Model "${model}" i18n for lang "${lang}" has untranslated entries !\n` + columnify(untranslated_i18n_keys))
						if (extraneous_i18n_keys.length)
							console.error(`Model "${model}" i18n for lang "${lang}" references unknown data:\n` + columnify(extraneous_i18n_keys))


						json.write(lang_file_path, i18n_data, { sortKeys: true })
						return err
					})
				}

			})), {concurrent: true})
		},
	])

}
