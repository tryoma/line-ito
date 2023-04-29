import * as dotenv from 'dotenv';
dotenv.config();
import { RequestHandler } from 'express';
import * as line from '@line/bot-sdk';

import fs from 'fs';
import { parse } from 'csv-parse/sync';
const file = fs.readFileSync('src/ito.csv').toString();
const records = parse(file, { columns: false });
const moment = require('moment');
const currentTime = moment();

import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

mongoose
  .connect(process.env.MONGO_DB!)
  .then(() => {
    console.log('success!');
  })
  .catch((err) => {
    console.log('fail!');
  });

const Schema = mongoose.Schema;
const DataSchema = new Schema({
  title: String,
  uniqId: String,
  usedNumber: Array,
  startedOn: Date,
});

const DataModel = mongoose.model('Data', DataSchema);

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);
export const lineEndpoint: RequestHandler = async (req, res, next) => {
  if (req.body.events.length === 0) {
    return res.status(201);
  }
  const event = req.body.events[0];
  if (event.type === 'message' && event.message.type === 'text') {
    if (event.message.text === '新規') {
      const title =
        records[1 + Math.floor(Math.random() * (records.length - 1))][0];
      const uniqId =
        Math.floor(Math.random() * 101) +
        '-' +
        currentTime.format('YYYYMMDDHH');
      const newNum = 1 + Math.floor(Math.random() * 8);
      const saveData = {
        title: title,
        uniqId: uniqId,
        usedNumber: [newNum],
        startedOn: new Date(),
      };
      DataModel.create(saveData, (err, data) => {
        if (err) {
          console.log('err');
          console.log(err);
        } else {
          const title = Number(data.title);
          client.replyMessage(event.replyToken, [
            textTemplate(`お題は 『${saveData.title}』 です。`),
            textTemplate(`お題IDは`),
            textTemplate(`${saveData.uniqId}`),
            textTemplate(`です。`),
          ]);
        }
      });
    } else if (isUniqId(event.message.text)) {
      const lineText = event.message.text;
      const data = await DataModel.findOne({ uniqId: event.message.text });
      if (data) {
        const array = data.usedNumber;
        let newNum = Math.floor(Math.random() * 101);
        while (array.includes(newNum)) {
          newNum = Math.floor(Math.random() * 101);
        }
        const newArray = [...array, newNum];
        await DataModel.updateOne(
          { uniqId: lineText },
          {
            $set: {
              usedNumber: newArray,
            },
          }
        );
        client.replyMessage(event.replyToken, [
          textTemplate(`あなたの番号は『${data.title}』`),
          textTemplate(`お題は『${newNum}』`),
        ]);
      }
    } else {
      client.replyMessage(
        event.replyToken,
        textTemplate('『新規』 または、正しい『お題ID』を入力して下さい')
      );
    }
  }
  res.status(201);
};

const confirmTemplate = () => {
  return {
    type: 'template',
    altText: 'test',
    template: {
      type: 'confirm',
      text: `新規ですか？それとも、\nお題IDをお持ちですか？`,
      actions: [
        {
          type: 'message',
          label: '新規',
          text: '新規',
        },
        {
          type: 'message',
          label: 'お題IDあり',
          text: 'お題IDあり',
        },
      ],
    },
  } as line.Message;
};

const textTemplate = (msg: string) => {
  return {
    type: 'text',
    text: `${msg}`,
  } as line.Message;
};

function isUniqId(test: string): boolean {
  const regex = /\d{1,2}[-]\d{10}/g;
  return !!test.match(regex);
}
