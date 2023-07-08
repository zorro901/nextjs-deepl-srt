import { NextApiRequest, NextApiResponse } from 'next'
import { launchChromium } from 'playwright-aws-lambda'
import { delay, sliceByNumber, toZenWidth } from '../../../utils/srt-translate'

// Playwrightを実行
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // JSONリクエストパラメータを取得する
    const originalText: Record<string, string> = JSON.parse(req.body)
    const wordlist = Object.values(originalText).map(toZenWidth)
    const text = wordlist.join('\n')

    // Playwrightを準備する
    // 高速化のために余計なオプションはオフにしておく
    const browser = await launchChromium({
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

        // 追加オプション
        '--disable-gpu',
        '--disable-dev-shm-usage',
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

    // サイト側に日本語認識させるために設定
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP'
    })

    const langSetting = req.body.original && req.body.exchange ? `#${req.body.original}/${req.body.exchange}/` : ''

    // ページを開く
    await page.goto(`https://www.deepl.com/translator${langSetting}`)

    // 改行した数を取得
    const indentionNumber = text.split('\n').length // 60
    // 文字数単位の空配列を生成する
    const splitTextNumber = 1450
    const splitTextArray = Array(Math.ceil(text.length / splitTextNumber))
    // 文章を配列に分割して再格納
    const splitArrayTextByNumber = sliceByNumber(text.split('\n'), indentionNumber / splitTextArray.length)

    const resultTranslatedTextArray: string[][] = []
    for (let i = 0; i < splitArrayTextByNumber.length; i++) {
      // 翻訳元の言葉を入力
      const targetText = splitArrayTextByNumber[i].join('\n')
      await page.getByRole('textbox', { name: '原文' }).fill(targetText)

      // 翻訳を待つ
      try {
        await page.waitForSelector('.lmt__loadingIndicator_container', { state: 'hidden', timeout: 2000 })
      } catch (error) {
        await page.waitForSelector('div[data-testid="translator-target-toolbar-share-popup"]', { state: 'attached' })
      }

      // 2回以上繰り返す場合は10秒待機
      if (splitTextArray.length >= 2) await delay(10000)

      // 翻訳されたテキストを取得
      let translatedText = await page.$eval('.lmt__target_textarea', (el: HTMLTextAreaElement) => el.value)

      // テキストが取得できなかった場合に再取得する
      const retryGetSentenceArray = async () => {
        if (translatedText.length === 0) {
          translatedText = await page.$eval('.lmt__target_textarea', (el: HTMLTextAreaElement) => el.value)
          await delay(1000)
          await retryGetSentenceArray()
        }
      }
      await retryGetSentenceArray()

      // 改行区切りの文字列配列に加工
      resultTranslatedTextArray.push(translatedText.split(/\r\n|\n/).map(sentence => sentence))

      // テキストをクリアするためリロード
      await page.reload()
    }
    await page.close()
    await context.close()
    await browser.close()
    // キー別にテキストを分割して翻訳済みのテキストに置き換え
    for (const key of Object.keys(originalText)) {
      originalText[key] = resultTranslatedTextArray.flat().join('\n')
    }

    res.status(200).json({ body: originalText })
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' })
  }
}
