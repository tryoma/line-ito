import * as dotenv from 'dotenv';
dotenv.config();
import { RequestHandler } from 'express';
import * as line from '@line/bot-sdk';

import fs from 'fs';
import { parse } from 'csv-parse/sync';
const file = fs.readFileSync('src/haa.csv').toString();
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
  titleId: String,
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
  const event = req.body.events[0];
  if (event.type === 'message' && event.message.type === 'text') {
    if (event.message.text === '新規') {
      const titleId =
        records[1 + Math.floor(Math.random() * (records.length - 1))][0];
      const uniqId =
        Math.floor(Math.random() * 101) +
        '-' +
        currentTime.format('YYYYMMDDHH');
      const newNum = 1 + Math.floor(Math.random() * 8);
      const saveData = {
        titleId: titleId,
        uniqId: uniqId,
        usedNumber: [newNum],
        startedOn: new Date(),
      };
      DataModel.create(saveData, (err, data) => {
        if (err) {
          console.log('err');
          console.log(err);
        } else {
          const titleId = Number(data.titleId);
          const selectRecord = records[titleId - 1];
          client.replyMessage(event.replyToken, [
            textTemplate(`あなたの番号は『${newNum}』`),
            textTemplate(`お題IDは『${data.uniqId}』`),
            textTemplate(
              `お題は『${selectRecord[1]}』\n1. ${selectRecord[2]}\n2. ${selectRecord[3]}\n3. ${selectRecord[4]}\n4. ${selectRecord[5]}\n5. ${selectRecord[6]}\n6. ${selectRecord[7]}\n7. ${selectRecord[8]}\n8. ${selectRecord[9]}`
            ),
            textTemplate(
              `コピーしてメモにつかってください。\n1. \n2. \n3. \n4. \n5. \n6. \n7. \n8. `
            ),
          ]);
        }
      });
    } else if (event.message.text === 'お題IDあり') {
      client.replyMessage(
        event.replyToken,
        textTemplate('お題IDを貼り付けて下さい。')
      );
    } else if (isUniqId(event.message.text)) {
      const lineText = event.message.text;
      const data = await DataModel.findOne({ uniqId: event.message.text });
      if (data) {
        const array = data.usedNumber;
        if (array.length >= 8) {
          client.replyMessage(
            event.replyToken,
            textTemplate('人数は8人までです。')
          );
        } else {
          let newNum = Math.floor(1 + Math.random() * 8);
          while (array.includes(newNum)) {
            newNum = Math.floor(1 + Math.random() * 8);
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
          const titleId = Number(data.titleId);
          const selectRecord = records[titleId - 1];
          client.replyMessage(event.replyToken, [
            textTemplate(`あなたの番号は『${newNum}』`),
            textTemplate(
              `お題は『${selectRecord[1]}』\n1. ${selectRecord[2]}\n2. ${selectRecord[3]}\n3. ${selectRecord[4]}\n4. ${selectRecord[5]}\n5. ${selectRecord[6]}\n6. ${selectRecord[7]}\n7. ${selectRecord[8]}\n8. ${selectRecord[9]}`
            ),
            textTemplate(
              `コピーしてメモにつかってください。\n1. \n2. \n3. \n4. \n5. \n6. \n7. \n8. `
            ),
          ]);
        }
      }
    } else {
      client.replyMessage(event.replyToken, confirmTemplate());
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
