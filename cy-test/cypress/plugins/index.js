require('dotenv').config()
const fetch = require('node-fetch')

module.exports = (on, config) => {
    config.baseUrl = process.env.URL

    on('task', {
        async 'testResourcesFlag:set'(id) {
            return fetch(`${process.env.URL}/test/addstate`, {
                method: 'POST',
                body: JSON.stringify({
                    id: id
                })
            }).then(() => {
                if (Math.random() > 0.7) {
                    throw new Error('Forced Error')
                }
                return true
            })
        },
        async 'testResourcesFlag:remove'(id) {
            return fetch(`${process.env.URL}/test/removestate`, {
                method: 'POST',
                body: JSON.stringify({
                    id: id
                })
            })
        },

        async 'confirm:clean'() {
            const raw = await fetch(`${process.env.URL}/test/getstate`)
            const result = await raw.json()
            if (!result.clean) {
                throw new Error(
                    'Database resources have not yet been cleaned up'
                )
            }
            return true
        }
    })
    return config
}
