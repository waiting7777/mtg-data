require('dotenv').config()
const axios = require('axios')
const mysql = require('mysql')
const line = require('@line/bot-sdk')
const cheerio = require('cheerio')
const { trim } = require('lodash')

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

function stringColor(diff) {
  if (diff == 0) {
    return '#000000'
  } else if (diff > 0) {
    return '#70a802'
  } else {
    return '#ea036f'
  }
}

function stringNumber(diff) {
  if (diff == 0) {
    return ''
  } else if (diff > 0) {
    return `(+${diff})`
  } else {
    return `(${diff})`
  }
}

async function getPrice(rarity, today, yesterday) {
    let queryString = `SELECT * FROM daily_price WHERE rarity="${rarity}" and created_at > "${today}"`
    const res = await queryDB(queryString)
    queryString = `SELECT * FROM daily_price WHERE rarity="${rarity}" and created_at > "${yesterday}" and created_at < "${today}"`
    const resYesterday = await queryDB(queryString)
    const contents = []
    res.forEach((v, i) => {
        const diff = +(Number(v.price) - Number(resYesterday[i].price)).toFixed(1)
	const price = (v.price) ? v.price.toFixed(1) : 'NULL'
        contents.push({
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": `${v.card_name}`,
                "flex": 3
              },
              {
                "type": "text",
                "text": `$${price}${stringNumber(diff)}`,
                "align": "end",
                "flex": 2,
                "color": stringColor(diff)
              }
            ]
        })
    })
    return contents
}

async function test() {
    const d = new Date()
    const today = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
    const yesterday = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()-1}`
    const mythicContent = await getPrice('Mythic', today, yesterday)
    const rareContent = await getPrice('Rare', today, yesterday)
    
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

async function getDeck(type) {
  const res = await doGet(`https://mtgdecks.net/${type}/date-1`);
  const $ = cheerio.load(res);
  let deck_name, usage_p, img
  $('tbody tr td').each(async function(i, e) {
    if (i > 29) return

    switch(i % 6) {
      case 0:
        img = trim($(this).find('img').attr('src'))
        break
      case 1:
        deck_name = trim($(this).text())
        break
      case 2:
        usage_p = trim($(this).text())
        break
      case 5:
        const queryString = `INSERT INTO meta (deck_name, usage_p, img, type) VALUES (\'${deck_name}\', \'${usage_p}\', \'${img}\', \'${type}\')`
        const res = await queryDB(queryString)
        console.log(queryString)
    }
  })
}

//test()
//main()
getDeck('Modern')
