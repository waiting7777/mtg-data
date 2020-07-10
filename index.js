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
        queryDB(queryString)
        console.log(queryString)
    })
    const resR = await doGet('https://api.scryfall.com/cards/search?q=set:m21+rarity:r')
    const dataR = resR.data.filter(v => v.collector_number < 274)
    dataR.forEach(d => {
        console.log(`${d.name} ${d.prices.usd}`)
        const queryString = `INSERT INTO daily_price (card_name, rarity, price) values (\"${d.name}\", "Rare", \"${d.prices.usd}\")`
        queryDB(queryString)
        console.log(queryString)
    })
}

async function getPrice(rarity, time) {
    const queryString = `SELECT * FROM daily_price WHERE rarity="${rarity}" and created_at > "${time}"`
    const res = await queryDB(queryString)
    const contents = []
    res.forEach(v => {
        contents.push({
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
                "text": `$${v.price}`,
                "align": "end",
                "flex": 1,
                // "color": "#70a802"
              }
            ]
        })
    })
    return contents
}

async function test() {
    const d = new Date()
    const today = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
    // const yesterday = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()-1}`
    const mythicContent = await getPrice('Mythic', today)
    const rareContent = await getPrice('Rare', today)
    
    const replyJSON = {
        "type": "carousel",
        "contents": [
          {
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "M21-Mythic",
                  "weight": "bold"
                },
                {
                    "type": "text",
                    "text": `${today}`,
                    "align": "end"
                }
              ]
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": mythicContent
            }
          },
          {
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "M21-Rare",
                  "weight": "bold"
                },
                {
                    "type": "text",
                    "text": `${today}`,
                    "align": "end"
                }
              ]
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": rareContent
            }
          }
        ]
    }
    client.pushMessage(process.env.GROUPID, {
        type: 'flex',
        altText: 'Daily Price',
        contents: replyJSON
    }).then(res => console.log(res)).catch(err => console.log(err.originalError.response.data))
}

main()
