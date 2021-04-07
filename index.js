require('dotenv').config()
const axios = require('axios')
const mysql = require('mysql')
const line = require('@line/bot-sdk')
const cheerio = require('cheerio')
const { trim, cloneDeep } = require('lodash')
const CronJob = require('cron').CronJob
const dayjs = require('dayjs')
const utils = require('./utils')
const fs = require('fs');

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

async function getDailyPrice() {
  const resM = await doGet('https://api.scryfall.com/cards/search?q=set:stx+rarity:m')
  const dataM = resM.data.filter(v => v.collector_number < 285)
  dataM.forEach(d => {
    const queryString = `INSERT INTO daily_price (card_name, rarity, price) values (\"${d.name}\", "Mythic",  \"${d.prices.usd}\")`
    queryDB(queryString)
    console.log(queryString)
  })
  const resR = await doGet('https://api.scryfall.com/cards/search?q=set:stx+rarity:r')
  const dataR = resR.data.filter(v => v.collector_number < 285)
  dataR.forEach(d => {
    const queryString = `INSERT INTO daily_price (card_name, rarity, price) values (\"${d.name}\", "Rare", \"${d.prices.usd}\")`
    queryDB(queryString)
    console.log(queryString)
  })
}

async function getPrice(rarity, today, yesterday) {
    let queryString = `SELECT * FROM daily_price WHERE rarity="${rarity}" and created_at > "${today}"`
    const res = await queryDB(queryString)
    queryString = `SELECT * FROM daily_price WHERE rarity="${rarity}" and created_at > "${yesterday}" and created_at < "${today}"`
    const resYesterday = await queryDB(queryString)
    const contents = []
    res.forEach((v, i) => {
      const diff = resYesterday[i].price ? +(Number(v.price) - Number(resYesterday[i].price)).toFixed(1) : 0
	    const price = (v.price) ? Number(v.price).toFixed(1) : 'NULL'
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
            "text": `$${price}${utils.stringNumber(diff)}`,
            "align": "end",
            "flex": 2,
            "color": utils.stringColor(diff)
          }
        ]
      })
    })
    return contents
}

async function pushDailyPrice() {
    const today = dayjs().format('YYYY-MM-DD')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
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
                "text": "STX-Mythic",
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
                "text": "STX-Rare",
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

const symbolMap = {
  'white': 'W',
  'blue': 'U',
  'black': 'B',
  'red': 'R',
  'green': 'G'
}

// async function getGoldfishMeta(type = 'historic') {
//   const res = await doGet(`https://www.mtggoldfish.com/metagame/${type}#paper`)
//   const $ = cheerio.load(res);
//   $('.archetype-tile').each(async function(i, e) {
//     if (i > 11) return
//     const link = $(e).find('.card-image-tile-link-overlay').attr('href')
//     const deck_name = $(e).find('.deck-price-paper a').text()
//     let temp = []
//     $(e).find('.manacost img').each(function(i, e) {
//       temp.push(symbolMap[$(e).attr('alt')])
//     })
//     const symbol = JSON.stringify(temp)
//     const usage_p = trim($(e).find('.col-freq').text())
//     const queryString = `INSERT INTO meta (deck_name, img, usage_p, symbol, type) VALUES (\'${deck_name}\', \'${link}\', \'${usage_p}\', \'${symbol}\', \'${type}\')`
//     const res = await queryDB(queryString)
//     console.log(queryString)
//   })
// }

// async function getDeck(type) {
//   const res = await doGet(`https://mtgdecks.net/${type}/date-1`);
//   const $ = cheerio.load(res);
//   let deck_name, usage_p, img
//   $('tbody tr td').each(async function(i, e) {
//     if (i > 29) return

//     switch(i % 6) {
//       case 0:
//         img = trim($(this).find('img').attr('src'))
//         break
//       case 1:
//         deck_name = trim($(this).text())
//         break
//       case 2:
//         usage_p = trim($(this).text())
//         break
//       case 5:
//         const queryString = `INSERT INTO meta (deck_name, usage_p, img, type) VALUES (\'${deck_name}\', \'${usage_p}\', \'${img}\', \'${type}\')`
//         const res = await queryDB(queryString)
//         console.log(queryString)
//     }
//   })
// }

const getPriceJob = new CronJob('00 00 00 * * *', () => {
  getDailyPrice()
})

const pushPriceJob = new CronJob('00 00 08 * * *', () => {
  pushDailyPrice()
})

// const getMetaJob = new CronJob('00 01 00 * * *', () => {
//   getGoldfishMeta('Standard')
//   setTimeout(() => {
//     getGoldfishMeta('Historic')
//   }, 3000)
//   setTimeout(() => {
//     getGoldfishMeta('Modern')
//   }, 6000)
// })

getPriceJob.start()
pushPriceJob.start()
// getMetaJob.start()
// pushDailyPrice()
// getGoldfishMeta()
