require('dotenv').config()
const https = require('https')
const express = require('express')
const app = express()
const moment = require('moment')
const currentTime = moment()
const mongoose = require('mongoose')
const fs = require('fs')
const parse = require('csv-parse/sync')
const data = fs.readFileSync('ito.csv')
const records = parse.parse(data, {
  columns: false,
})

const PORT = process.env.PORT || 3000
const TOKEN = process.env.LINE_ACCESS_TOKEN

app.use(express.json())
app.use(
  express.urlencoded({
    extended: true,
  })
)

mongoose.set('strictQuery', true)

mongoose
  .connect(process.env.MONGO_DB)
  .then(() => {
    console.log('success!')
  })
  .catch((err) => {
    console.log('fail!')
  })

const Schema = mongoose.Schema
const DataSchema = new Schema({
  title: String,
  uniqId: String,
  usedNumber: Array,
  startedOn: Date,
})

const DataModel = mongoose.model('Data', DataSchema)

app.get('/', (req, res) => {
  res.sendStatus(200)
})

app.post('/webhook', async (req, res) => {
  console.log(req)
  // ユーザーがボットにメッセージを送った場合、返信メッセージを送る
  if (req.body.events[0].type === 'message') {
    let lineText = req.body.events[0].message.text || ''
    let replyToken = req.body.events[0].replyToken

    if (lineText === '新規') {
      const title = records[Math.floor(Math.random() * records.length)][0]
      const uniqId =
        Math.floor(Math.random() * 101) + '-' + currentTime.format('YYYYMMDDHH')
      const newNum = Math.floor(Math.random() * 101)
      const saveData = {
        title: title,
        uniqId: uniqId,
        usedNumber: [newNum],
        startedOn: new Date(),
      }
      DataModel.create(saveData, (err, savedData) => {
        if (err) {
          messages = [
            {
              type: 'text',
              text: 'エラーがおきました。',
            },
          ]
          request(replyToken, messages)
        } else {
          messages = [
            {
              type: 'text',
              text: `お題は 『${savedData.title}』 です。`,
            },
            {
              type: 'text',
              text: `お題IDは`,
            },
            {
              type: 'text',
              text: `${savedData.uniqId}`,
            },
            {
              type: 'text',
              text: `です。`,
            },
            {
              type: 'text',
              text: `あなたの数字は 『${newNum}』 です。`,
            },
          ]
          request(replyToken, messages)
        }
      })
    } else if (isUniqId(lineText)) {
      const data = await DataModel.findOne({ uniqId: lineText })
      if (data) {
        const array = data.usedNumber
        let newNum = Math.floor(Math.random() * 101)
        while (array.includes(newNum)) {
          newNum = Math.floor(Math.random() * 101)
        }
        const newArray = [...array, newNum]
        await DataModel.updateOne(
          { uniqId: lineText },
          {
            $set: {
              usedNumber: newArray,
            },
          }
        )
        messages = [
          {
            type: 'text',
            text: `お題は『${data.title}』です。`,
          },
          {
            type: 'text',
            text: `あなたの数字は『${newNum}』です。`,
          },
        ]
        request(replyToken, messages)
      } else {
        messages = [
          {
            type: 'text',
            text: '『新規』 または、正しい『お題ID』を入力して下さい',
          },
        ]
        request(replyToken, messages)
      }
    } else {
      messages = [
        {
          type: 'text',
          text: '『新規』 または、『お題ID』を入力して下さい',
        },
      ]
      request(replyToken, messages)
    }
  }
})

function request(replyToken, message) {
  // 文字列化したメッセージデータ
  const dataString = JSON.stringify({
    replyToken: replyToken,
    messages: message,
  })

  // リクエストヘッダー
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + TOKEN,
  }

  // リクエストに渡すオプション
  const webhookOptions = {
    hostname: 'api.line.me',
    path: '/v2/bot/message/reply',
    method: 'POST',
    headers: headers,
    body: dataString,
  }

  // リクエストの定義
  const request = https.request(webhookOptions)

  // エラーをハンドル
  request.on('error', (err) => {
    console.error(err)
  })

  // データを送信
  request.write(dataString)
  request.end()
}

function isUniqId(test) {
  const regex = /\d{1,2}[-]\d{10}/g
  return test.match(regex)
}

app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`)
})
