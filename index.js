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
    const d = new Date()
    const today = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
    const yesterday = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()-1}`
    const queryString = `SELECT * FROM daily_price WHERE rarity="Mythic" and created_at > "${yesterday}" and created_at < "${today}"`
    console.log(queryString)
    const res = await queryDB(queryString)
    const cardContents = []
    res.forEach(v => {
        cardContents.push({
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": `${v.card_name}`,
                "flex": 2
              },
              {
                "type": "text",
                "text": `$${v.card_price}`,
                "align": "end",
                "flex": 1,
                // "color": "#70a802"
              }
            ]
        })
    })
    const replyJSON = {
        "type": "carousel",
        "contents": [
          {
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "M21-Mythic",
                  "weight": "bold"
                }
              ]
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": cardContents
            }
          },
          {
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "M21-Rare",
                  "weight": "bold"
                }
              ]
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": cardContents
            }
          }
        ]
    }
    client.pushMessage('R5fc2ceb74df4c8d5cb603faf62b7d0ef', {
        type: 'flex',
        altText: 'Daily Price',
        contents: replyJSON
    }).then(res => console.log(res)).catch(err => console.log(err.originalError.response.data))
}

test()
