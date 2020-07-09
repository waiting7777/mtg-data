require('dotenv').config()
const axios = require('axios')
const mysql = require('mysql')
const line = require('@line/bot-sdk')

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
})

// connection.connect()

const config = {
    channelAccessToken: process.env.CHANNELACCESSTOKEN,
    channelSecret: process.env.CHANNELSECRET
}

const client = new line.Client(config)

function doGet(url) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: `${url}`
        })
        .then(res => {
            resolve(res.data)
        })
        .catch(error => {
            resolve(error.response.data)
        })
    })
}

function queryDB(sql) {
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        })
    })
}

async function main() {
    const resM = await doGet('https://api.scryfall.com/cards/search?q=set:m21+rarity:m')
    const dataM = resM.data.filter(v => v.collector_number < 274)
    dataM.forEach(d => {
        const queryString = `INSERT INTO daily_price (card_name, rarity, price) values (\"${d.name}\", "Mythic",  \"${d.prices.usd}\")`
        // queryDB(queryString)
        console.log(queryString)
    })
    const resR = await doGet('https://api.scryfall.com/cards/search?q=set:m21+rarity:r')
    const dataR = resR.data.filter(v => v.collector_number < 274)
    dataR.forEach(d => {
        console.log(`${d.name} ${d.prices.usd}`)
        const queryString = `INSERT INTO daily_price (card_name, rarity, price) values (\"${d.name}\", "Rare", \"${d.prices.usd}\")`
        // queryDB(queryString)
        console.log(queryString)
    })
}

// main()

async function test() {
    client.pushMessage('R5fc2ceb74df4c8d5cb603faf62b7d0ef', {
        type: 'text',
        text: 'test'
    })
}

test()