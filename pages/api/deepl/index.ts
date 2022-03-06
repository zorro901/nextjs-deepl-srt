// For Local Environment
import { NextApiRequest, NextApiResponse } from 'next'

const sliceByNumber = (array: string | any[], number: number) => {
  const length = Math.ceil(array.length / number)
  // @ts-ignore
  return new Array(length).fill().map((_, i) => array.slice(i * number, (i + 1) * number))
}
const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))

//モジュールを読み込み
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chromium = require('playwright-aws-lambda')
//Puppeteerを実行
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  //個別パラメータを取得する
  const text = req.body.text
  //Puppeteerを準備する
  //高速化の為に余計なオプションはオフにしておく
  const browser = await chromium.launchChromium({
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      //追加オプション
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list'
    ],
    headless: true
  })
  const context = await browser.newContext()
  const page = await context.newPage()
  //サイト側に日本語認識させるために設定
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja-JP'
  })
  //ページを開く
  await page.goto('https://www.deepl.com/translator')
  // 改行した数を取得
  const indentionNumber = text.split('\n').length // 60
  // 文字数単位の空配列を生成する
  const splitStringArray = Array(Math.ceil(text.length / (5000 - indentionNumber)))
  // 文章を配列に分割して再格納
  const splitArrayNumber = sliceByNumber(text.split('\n'), indentionNumber / splitStringArray.length)

  const returnArr: string[][] = []
  for (let i = 0; i < splitArrayNumber.length; i++) {
    //翻訳元の言葉を入力
    // @ts-ignore
    await page.fill('textarea', splitArrayNumber[i].join('\n'))

    //翻訳を待つ
    await page.waitForSelector('.lmt--active_translation_request', { state: 'hidden' })
    //翻訳結果を取得する
    const targetSentenceField = '.lmt__target_textarea'

    const result = {}
    // @ts-ignore
    result.target = await page.$eval(targetSentenceField, (el: { value: any }) => el.value)

    //改行された場合は分割する
    // @ts-ignore
    const arr = result.target.split(/\r\n|\n/)
    //分割した配列へ整形する
    const arrSplit = () => {
      const arrList = []
      while (0 < arr.length) arrList.push(arr.splice(0, 1))
      return arrList
    }
    //整形したデータを配列へ再格納
    const arrComp = arrSplit()
    // console.log(arrComp)
    returnArr.push(arrComp)
    splitArrayNumber.length >= 2 ? await delay(10000) : null
  }

  res.status(200).json({ body: returnArr.flat() })

  await browser.close()
}
