import { NextResponse } from 'next/server'
import { delay, sliceByNumber, toZenWidth } from 'utils/srt-translate'
import { env } from '../../../env/server'

const DELAY_MS = 5000
export async function POST(req: Request) {
  try {
    // JSONリクエストパラメータを取得する
    const reqBody: Record<'text' | 'original' | 'exchange', string> = await req.json()
    const originalText = reqBody.text
    const wordlist = toZenWidth(originalText.split('\n').join('\n')).split('\n')
    const text = wordlist.join('\n')

    // 改行した数を取得
    const indentionNumber = text.split('\n').length // 60
    // 文字数単位の空配列を生成する
    const splitTextNumber = 1500
    const splitTextArray = Array(Math.ceil(text.length / splitTextNumber))
    // 文章を配列に分割して再格納
    const splitArrayTextByNumber = sliceByNumber(text.split('\n'), indentionNumber / splitTextArray.length)

    const resultTranslatedTextArray: string[][] = []
    for (let i = 0; i < splitArrayTextByNumber.length; i++) {
      // 翻訳元の言葉を入力
      const targetTextArray = splitArrayTextByNumber[i]
      const sourceLineCount = splitArrayTextByNumber[i].length

      const translatedText = await getTranslateData(targetTextArray.join('\n'))

      env.DEBUG && console.info(`translatedText`, translatedText)

      // 翻訳後のテキストに重複行があった場合に残りを再翻訳する
      const translatedTextArray = translatedText?.split(/\r\n|\n/)

      // 改行区切りの文字列配列に加工
      const maxLength = Math.max(translatedTextArray.length, sourceLineCount)
      const normalizedArray = translatedTextArray.concat(Array(maxLength - translatedTextArray.length).fill(''))
      resultTranslatedTextArray.push(normalizedArray)

      // テキストをクリア
      await delay(DELAY_MS)
    }

    env.DEBUG && console.info(`resultTranslatedTextArray`, resultTranslatedTextArray)
    const resultText = resultTranslatedTextArray.flat().join('\n')

    env.DEBUG && console.info(`resultText`, resultText)

    return NextResponse.json({ text: resultText }, { status: 200 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}

async function getTranslateData(text: string, retries = 30) {
  try {
    const response = await fetch(`${env.DEEPL_SERVER_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_lang: 'EN',
        target_lang: 'JA'
      })
    })

    if (!response.ok && retries > 0) {
      // 再試行可能な場合
      console.info('再試行可能な場合')
      await delay(DELAY_MS)
      return await getTranslateData(text, retries - 1)
    }

    if (!response.ok && retries === 0) {
      throw new Error('Failed to fetch translation data')
    }

    const { data: translatedText } = await response.json()
    env.DEBUG && console.info(typeof translatedText, translatedText)
    if (translatedText == null && retries > 0) {
      // `data` が null で再試行可能な場合
      await delay(DELAY_MS)
      return await getTranslateData(text, retries - 1)
    }
    env.DEBUG && console.info(`getTranslateData translatedText`, translatedText)
    return translatedText
  } catch (error) {
    if (retries > 0) {
      // エラーが発生しても再試行可能な場合
      return await getTranslateData(text, retries - 1)
    }
    env.DEBUG && console.error(error)
    throw new Error('Failed to parse translation data')
  }
}
