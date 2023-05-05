import { NextApiRequest, NextApiResponse } from 'next'

//モジュールを読み込み
import * as chromium from 'playwright-aws-lambda'

const sliceByNumber = (array: string[], number: number): string[][] => {
  const length = Math.ceil(array.length / number)
  return new Array(length).fill(undefined).map((_, i) => array.slice(i * number, (i + 1) * number))
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

//半角記号を全角へ変換
const toZenWidth = (strVal: string) => {
  const zenVal = strVal.replaceAll(/[<>!@#$%^&*)(+=._-]/g, (tmpStr: string) =>
    String.fromCharCode(tmpStr.charCodeAt(0) + 0xfee0)
  )
  // 文字コードシフトで対応できない文字の変換
  return zenVal.replace(/"/g, '”').replace(/'/g, '’').replace(/`/g, '‘').replace(/\\/g, '￥').replace(/~/g, '〜')
}
//Playwrightを実行
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  //JSONリクエストパラメータを取得する
  const wordObject: Record<string, string> = JSON.parse(req.body)
  const wordlist = []
  for (const [, value] of Object.entries(wordObject)) {
    wordlist.push(`${toZenWidth(value)}`)
  }
  const text = wordlist.join('\n')
  //Puppeteerを準備する
  //高速化の為に余計なオプションはオフにしておく
  const browser = await chromium.launchChromium({
    args: [
      '--allow-running-insecure-content', // https://source.chromium.org/search?q=lang:cpp+symbol:kAllowRunningInsecureContent&ss=chromium
      '--autoplay-policy=user-gesture-required', // https://source.chromium.org/search?q=lang:cpp+symbol:kAutoplayPolicy&ss=chromium
      '--disable-component-update', // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableComponentUpdate&ss=chromium
      '--disable-domain-reliability', // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableDomainReliability&ss=chromium
      '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process', // https://source.chromium.org/search?q=file:content_features.cc&ss=chromium
      '--disable-print-preview', // https://source.chromium.org/search?q=lang:cpp+symbol:kDisablePrintPreview&ss=chromium
      '--disable-setuid-sandbox', // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableSetuidSandbox&ss=chromium
      '--disable-site-isolation-trials', // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableSiteIsolation&ss=chromium
      '--disable-speech-api', // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableSpeechAPI&ss=chromium
      '--disable-web-security', // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableWebSecurity&ss=chromium
      '--disk-cache-size=33554432', // https://source.chromium.org/search?q=lang:cpp+symbol:kDiskCacheSize&ss=chromium
      '--enable-features=SharedArrayBuffer', // https://source.chromium.org/search?q=file:content_features.cc&ss=chromium
      '--hide-scrollbars', // https://source.chromium.org/search?q=lang:cpp+symbol:kHideScrollbars&ss=chromium
      '--ignore-gpu-blocklist', // https://source.chromium.org/search?q=lang:cpp+symbol:kIgnoreGpuBlocklist&ss=chromium
      '--in-process-gpu', // https://source.chromium.org/search?q=lang:cpp+symbol:kInProcessGPU&ss=chromium
      '--mute-audio', // https://source.chromium.org/search?q=lang:cpp+symbol:kMuteAudio&ss=chromium
      '--no-default-browser-check', // https://source.chromium.org/search?q=lang:cpp+symbol:kNoDefaultBrowserCheck&ss=chromium
      '--no-pings', // https://source.chromium.org/search?q=lang:cpp+symbol:kNoPings&ss=chromium
      '--no-sandbox', // https://source.chromium.org/search?q=lang:cpp+symbol:kNoSandbox&ss=chromium
      '--no-zygote', // https://source.chromium.org/search?q=lang:cpp+symbol:kNoZygote&ss=chromium
      '--use-gl=swiftshader', // https://source.chromium.org/search?q=lang:cpp+symbol:kUseGl&ss=chromium
      '--window-size=1920,1080', // https://source.chromium.org/search?q=lang:cpp+symbol:kWindowSize&ss=chromium

      //追加オプション
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
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
  let langSetting = ''
  req.body.original && req.body.exchange ? (langSetting = `#${req.body.original}/${req.body.exchange}/`) : null
  //ページを開く
  await page.goto(`https://www.deepl.com/translator${langSetting}`)

  // 改行した数を取得
  const indentionNumber = text.split('\n').length // 60
  // 文字数単位の空配列を生成する
  const splitStringArray = Array(Math.ceil(text.length / 2900))
  // 文章を配列に分割して再格納
  const splitArrayNumber = sliceByNumber(text.split('\n'), indentionNumber / splitStringArray.length)

  const resultArray = []
  for (let i = 0; i < splitArrayNumber.length; i++) {
    //翻訳元の言葉を入力
    await page.getByRole('textbox', { name: '原文' }).fill(splitArrayNumber[i].join('\n'))

    //翻訳を待つ
    try {
      await page.waitForSelector('.lmt__loadingIndicator_container', { state: 'hidden', timeout: 2000 })
    } catch (error) {
      await page.waitForSelector('div[data-testid="translator-target-toolbar-share-popup"]', { state: 'attached' })
    }

    //翻訳結果を取得する
    const targetSentenceField = '.lmt__target_textarea'
    const pageContentTranslation = await page.$eval(targetSentenceField, (el: HTMLTextAreaElement) => el.value)

    //改行されたテキストを配列に置き換える
    //'Any Text\nAny Text' => [['Any Text'], ['Any Text']]
    const stringArrayFromText = (resultText: string): string[][] => resultText.split(/\r?\n/).map(line => [line])

    resultArray.push(stringArrayFromText(pageContentTranslation))
    splitArrayNumber.length >= 2 ? await delay(10000) : null
  }

  await browser.close()
  const flattenedArray = resultArray.flat()
  for (const [key, value] of Object.entries(wordObject)) {
    const nlCount = (value.match(/\n/g) || []).length
    const words = flattenedArray.splice(0, nlCount + 1)
    switch (key) {
      case 'title':
        wordObject.title = words.join('\n')
        break
      case 'description':
        wordObject.description = words.join('\n')
        break
      case 'body':
        wordObject.body = words.join('\n')
        break
    }
  }
  // 要約後の改行を削除する
  if (wordObject.body) {
    wordObject.body = wordObject.body.trim()
  }
  res.status(200).json({ body: wordObject })
}
