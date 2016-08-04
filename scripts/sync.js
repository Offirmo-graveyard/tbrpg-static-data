

const path = require('path')
const _ = require('@offirmo/cli-toolbox/lodash')
const visual_tasks = require('@offirmo/cli-toolbox/stdout/visual_tasks')
const fs = require('@offirmo/cli-toolbox/fs/extra')
const json = require('@offirmo/cli-toolbox/fs/json')
const tildify = require('@offirmo/cli-toolbox/string/tildify')

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
				task: sync_model.bind(undefined, model)
			})), {concurrent: true})
		}
	},
	{
		title: 'All done',
		task: () => {}
	}
])
.catch(err => {
	console.error(err);
})



function sync_model(model) {
	const model_top_dir = path.join(MODELS_TOP_DIR, model)
	const model_i18n_dir = path.join(model_top_dir, 'i18n')
	const model_migrations_dir = path.join(model_top_dir, 'migrations')

	const schema_path = path.join(model_top_dir, 'schema.json')

	let schema, data, data_keys = []


	return visual_tasks.create([
		{
			title: `Reading schema ${tildify(schema_path)}`,
			task: () => schema = json.read(schema_path)
		},
		{
			title: `Reading data`,
			task: () => data = require(model_top_dir)
		},
		{
			title: `Ensuring data validity`,
			task: () => {
				data.forEach((entry, index) => {
					if (! _.isObject(entry)) {
						console.error(`${model_top_dir} entry #${index} is not an object !`, entry)
						return
					}
					if (!entry.hid)
						console.error(`${model_top_dir} entry #${index} is missing its hid !`, entry)
					else
						data_keys.push(entry.hid)
				})
			}
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
						json.write(lang_file_path, i18n_data, { sortKeys: true })
						return err
					})
				}
			})), {concurrent: true})
		},
	])

}
