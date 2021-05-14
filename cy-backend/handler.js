const AWS = require('aws-sdk')
const table = process.env.TABLE
const testState = process.env.TEST_STATE
const dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: process.env.REGION || 'us-east-1'
})

const http = {
    html: (x) => ({
        statusCode: 200,
        body: x,
        headers: {
            'Content-Type': 'text/html'
        }
    }),
    success: (x) => ({
        statusCode: 200,
        body: JSON.stringify(x)
    }),
    error: (m) => ({
        statusCode: 500,
        body: JSON.stringify({
            message: m
        })
    })
}

const makeId = () =>
    Math.random()
        .toString(36)
        .replace(/[^a-z]+/g, '')
        .substr(0, 5)

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
FRONTEND
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
module.exports.main = async (event) => {
    return http.html(`
<div>
    <h1>My App</h1>
    <p id='status' data-cy='status'></p>
    <ul id='list' data-cy='list'></ul>
    <button id='create-button' data-cy='create-button'>Create</button>
</div>
<script>
const ui = {
  status: document.getElementById('status'),
  list: document.getElementById('list'),
  createButton: document.getElementById('create-button')
}

const getNotes = () => {
  fetch('${process.env.ENDPOINT}/api/listnotes')
    .then(x => x.json())
    .then(x => {
      ui.list.innerHTML = x.notes
        .map(x => '<li id="' + x.id + '" onclick="remove(\\'' + x.id +'\\')">' + x.name + '</li>')
        .reduce((a, x) => a + x, '')
    })
}

getNotes()


const create = () => {
  ui.status.innerHTML = 'saving'
  fetch('${process.env.ENDPOINT}/api/createnote', {
    method: "POST"
  })
  .then(x => x.json())
  .then(x => {
    getNotes()
    ui.status.innerHTML = 'success'
    setTimeout(() => {
        ui.status.innerHTML = ''
    }, 200)
  })
}

const remove = (id) => {
  ui.status.innerHTML = 'saving'
  fetch('${process.env.ENDPOINT}/api/removenote', {
    method: "POST",
    body: JSON.stringify({
      id: id
    })
  })
  .then(x => x.json())
  .then(x => {
    getNotes()
    ui.status.innerHTML = 'success'
    setTimeout(() => {
        ui.status.innerHTML = ''
    }, 200)
  })
}

ui.createButton.addEventListener('click', create)

</script>
`)
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
API
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
module.exports.listnotes = async (event) => {
    try {
        const params = {
            TableName: table
        }
        const x = await dynamoDb.scan(params).promise()
        return http.success({
            notes: x.Items.map((x) => ({
                id: x.SK,
                name: x.name
            }))
        })
    } catch (e) {
        return http.error(e.message)
    }
}

module.exports.createnote = async (event) => {
    try {
        const id = makeId()
        const params = {
            TableName: table,
            Item: {
                PK: 'app',
                SK: id,
                name: 'name-' + id
            }
        }
        await dynamoDb.put(params).promise()
        return http.success({
            id
        })
    } catch (e) {
        return http.error(e.message)
    }
}

module.exports.removenote = async (event) => {
    try {
        const data = JSON.parse(event.body)

        const params = {
            TableName: table,
            Key: {
                PK: 'app',
                SK: data.id
            }
        }
        await dynamoDb.delete(params).promise()
        return http.success({
            id: data.id
        })
    } catch (e) {
        return http.error(e.message)
    }
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
TEST
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */
module.exports.addState = async (event) => {
    try {
        const data = JSON.parse(event.body)
        const params = {
            TableName: testState,
            Item: {
                PK: 'app',
                SK: data.id,
                TTL: Math.floor(Date.now() / 1000) + 10
            }
        }
        await dynamoDb.put(params).promise()
        return http.success({
            status: 'success'
        })
    } catch (e) {
        return http.error(e.message)
    }
}

module.exports.removeState = async (event) => {
    try {
        const data = JSON.parse(event.body)

        const params = {
            TableName: testState,
            Key: {
                PK: 'app',
                SK: data.id
            }
        }
        const x = await dynamoDb.delete(params).promise()

        return http.success({
            status: 'success'
        })
    } catch (e) {
        return http.error(e.message)
    }
}

module.exports.checkState = async () => {
    try {
        const params = {
            TableName: testState
        }
        const x = await dynamoDb.scan(params).promise()

        for (const app of x.Items) {
            if (app.TTL < Math.floor(Date.now() / 1000) + 10) {
                await dynamoDb
                    .delete({
                        TableName: table,
                        Key: {
                            PK: app.PK,
                            SK: app.SK
                        }
                    })
                    .promise()

                await dynamoDb
                    .delete({
                        TableName: testState,
                        Key: {
                            PK: app.PK,
                            SK: app.SK
                        }
                    })
                    .promise()
            }
        }
        return true
    } catch (e) {
        console.log(e)
        return http.error(e.message)
    }
}

module.exports.getState = async () => {
    const params = {
        TableName: testState
    }
    const x = await dynamoDb.scan(params).promise()
    return http.success({
        clean: x.Items.length === 0
    })
}
