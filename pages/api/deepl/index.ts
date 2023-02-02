import { NextApiRequest, NextApiResponse } from 'next'
import * as playwright from 'playwright-aws-lambda'
import type { Page } from 'playwright-core'

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

const selectors = {
  dialogDismiss: '[role=dialog] button[aria-label=Close]',
  cookieBannerDismiss: '.dl_cookieBanner--buttonSelected',
  translationActive: '.lmt:not(.lmt--active_translation_request)',
  selectSourceLanguageButton: 'button[dl-test="translator-source-lang-btn"]',
  selectTargetLanguageButton: 'button[dl-test="translator-target-lang-btn"]',
  // sourceLanguageOption: (language: SourceLanguage) =>
  //   `[dl-test="translator-source-lang-list"] [dl-test="translator-lang-option-${language}"]`,
  // targetLanguageOption: (language: TargetLanguage) =>
  //   `[dl-test="translator-target-lang-list"] [dl-test="translator-lang-option-${language}"]`,
  sourceTextarea: '.lmt__source_textarea',
  targetTextarea: '.lmt__target_textarea',
  formalityToggler: '.lmt__formalitySwitch__toggler',
  formalitySwitch: '.lmt__formalitySwitch',
  formalitySwitchMenu: '.lmt__formalitySwitch__menu',
  formalOption: '.lmt__formalitySwitch__menu_item_container:nth-child(1) .lmt__formalitySwitch__menu_item',
  informalOption: '.lmt__formalitySwitch__menu_item_container:nth-child(2) .lmt__formalitySwitch__menu_item'
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
  const browser = await playwright.launchChromium({
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
    headless: false
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
  const splitTextArray = Array(Math.ceil(text.length / 2800))
  // 文章を配列に分割して再格納
  const splitArrayTextByNumber = sliceByNumber(text.split('\n'), indentionNumber / splitTextArray.length)

  // console.log(splitArrayTextByNumber.length)
  // console.log(splitArrayTextByNumber[0].length)
  // console.log(splitArrayTextByNumber[1].length)
  // console.log(splitArrayTextByNumber[2].length)
  // console.log(splitArrayTextByNumber[3].length)
  // console.log(splitArrayTextByNumber[4].length)

  const translatedTextArray: string[] = []

  const getSubtitleText = async ({
    page,
    targetText,
    index,
    maxLength
  }: {
    page: Page
    targetText: string
    index: number
    maxLength: number
  }) => {
    await page.getByRole('textbox', { name: '原文' }).fill(targetText, { timeout: 60000 })
    await page.waitForLoadState('networkidle')
    const result = await page.$eval('.lmt__target_textarea', (el: HTMLTextAreaElement) => el.value)
    if (maxLength !== index) await delay(10000)
    return result.split(/\r\n|\n/)
  }

  // console.log(splitArrayTextByNumber.length)
  // splitArrayTextByNumber[0].forEach(value => console.log(value))
  // splitArrayTextByNumber[4].forEach(value => console.log(value))
  // console.log(splitArrayTextByNumber[0].at(-1))
  // console.log(splitArrayTextByNumber[4].at(-1))

  const translate = async () => {
    // const subtitleTextArray = await splitArrayTextByNumber
    //   .flat()
    //   .reduce(async (promisedString, targetText, index): Promise<string[]> => {
    //     console.log(targetText)
    //     const addSubArr = await getSubtitleText({
    //       page,
    //       // targetText: targetText.join('\n'),
    //       targetText: targetText,
    //       index,
    //       maxLength: splitArrayTextByNumber.length
    //     })
    //     return [...(await promisedString), ...addSubArr]
    //   }, Promise.resolve<string[]>([]))

    const subtitleTextArray = splitArrayTextByNumber.map((targetText, index) => {
      // console.log(targetText)
      console.log(targetText.at(-1))
      return new Promise(() =>
        getSubtitleText({
          page,
          targetText: targetText.join('\n'),
          index,
          maxLength: splitArrayTextByNumber.length
        })
      )
    })
    // for (let i = 0; i < splitArrayTextByNumber.length; i++) {
    //   translatedTextArray.push(...(await subtitleTextArray[i]))
    // }
    for await (const subtitleText of subtitleTextArray) {
      // translatedTextArray = translatedTextArray.concat(subtitleText)
      // translatedTextArray = [...translatedTextArray, ...subtitleText]
      // console.log(subtitleText)
      translatedTextArray.push(...subtitleText)
    }
  }
  await translate()
  const promiseArr = splitArrayTextByNumber.map((targetText, index) => {
    return new Promise(resolve => {
      resolve(
        getSubtitleText({
          page,
          targetText: targetText.join('\n'),
          index,
          maxLength: splitArrayTextByNumber.length
        })
      )
    })
  })

  const finishedSubtitleArray = []
  // for (let i = 0; i < promiseArr.length; i++) {
  //   finishedSubtitleArray.push(await promiseArr[i])
  // }

  // console.log('splitArrayTextByNumber[0].join')
  // console.log(splitArrayTextByNumber[0][0].at(0))
  // console.log(splitArrayTextByNumber[0][0].length)
  // await page.getByRole('textbox', { name: '原文' }).fill(splitArrayTextByNumber[0][0], { timeout: 60000 })
  // await page.waitForLoadState('networkidle')
  // const result = await page.$eval('.lmt__target_textarea', (el: HTMLTextAreaElement) => el.value)
  // console.log(result)
  // if (maxLength !== index) await delay(10000)
  // return result.split(/\r\n|\n/)
  // console.log(
  //   await getSubtitleText({
  //     page,
  //     targetText: splitArrayTextByNumber[0][1],
  //     index: 0,
  //     maxLength: splitArrayTextByNumber.length
  //   })
  // )

  // await translate()
  await browser.close()
  console.log(translatedTextArray)
  // translatedTextArray.forEach(value => console.log(value))
  // console.log(wordObject)
  for (const [key, value] of Object.entries(wordObject)) {
    const nlCount = (value.match(/\n/g) || []).length
    // console.log(nlCount)
    // const finishedSubtitleArray = []
    // for (let i = 0; i <= nlCount; i++) {
    //   finishedSubtitleArray.push(translatedTextArray[0])
    //   // translatedTextArray.shift()
    //   // word.push(translatedTextArray)
    //   translatedTextArray.shift()
    // }
    wordObject[key] = translatedTextArray.join('\n')
  }
  res.status(200).json({ body: wordObject })
}
