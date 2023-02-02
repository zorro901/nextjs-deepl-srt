export const srtTranslate = async ({ targetSubtitle }: { targetSubtitle: string }) => {
  // 字幕を展開する
  const originalSubtitle: Array<string> = targetSubtitle.replace(/\r/g, '').split('\n')

  // 字幕の並び順と内容を配列に変換する
  const contentArrayIndex: number[] = []
  const contentTextArray = originalSubtitle.map((text, index) => {
    if (RegExp(`^\\d{1,3}`, 'g').test(text) || text === '') {
      return null
    } else {
      contentArrayIndex.push(index)
      return text
    }
  })

  const beforeTranslateText = contentTextArray.filter(Boolean).join('\n')
  // 字幕データを翻訳する

  const translatedText = await translateDeepL([beforeTranslateText])
  // 翻訳した字幕を結合する
  const translatedTextArray = translatedText.text.split('\n')
  const finishedSubtitleArray: string[] = []

  originalSubtitle.map((subtitleData, index) => {
    if (index === contentArrayIndex[0]) {
      finishedSubtitleArray.push(translatedTextArray[0])
      translatedTextArray.shift()
      contentArrayIndex.shift()
    } else {
      finishedSubtitleArray.push(subtitleData)
    }
  })
  return finishedSubtitleArray
}

const translateDeepL = async (targetStringArray: string[]): Promise<Record<'text', string>> => {
  const translateFinArray: Record<'text', string>[] = []
  for (const currentPromise of targetStringArray) {
    const retryRequest = async (retryCount = 0) => {
      try {
        const response = await fetch('api/deepl', { method: 'POST', body: JSON.stringify({ text: currentPromise }) })
        if (!response.ok) return null
        const json = await response.json()
        console.log(json.body)
        translateFinArray.push(json.body)
      } catch (error) {
        if (retryCount === 4) return null
        await retryRequest(retryCount + 1)
      }
    }
    await retryRequest()
  }
  return translateFinArray[0]
}
