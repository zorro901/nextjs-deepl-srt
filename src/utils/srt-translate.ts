export const webVttTrim = (subtitleArray: string[]) => {
  const result: string[] = []
  let temp = ''
  subtitleArray.forEach(element => {
    if (element === '') {
      result.push(temp.trim())
      result.push('')
      temp = ''
    } else if (!isNaN(Number(element))) {
      result.push(element)
    } else if (element.includes('-->')) {
      result.push(element)
    } else {
      temp += ` ${element}`
    }
  })
  while (result[result.length - 1] === '') {
    result.pop()
  }
  result.push(temp.trim())

  if (result[0] === 'WEBVTT') {
    const targetIndex = result.findIndex(v => v === '1')
    result.splice(0, targetIndex)
    return result
  }

  return result
}

export const srtTranslate = async ({ targetSubtitle }: { targetSubtitle: string }) => {
  // 字幕を展開する
  const originalSubtitle: Array<string> = webVttTrim(targetSubtitle.replace(/\r/g, '').split('\n'))

  const targetIndex = originalSubtitle.findIndex(v => v === '1')
  originalSubtitle.splice(0, targetIndex)
  // 字幕の並び順と内容を配列に変換する
  const contentArrayIndex: number[] = []
  const contentTextArray = originalSubtitle.map((text, index) => {
    if (RegExp(`^\\d{1,3}`, 'g').test(text) || text === '') {
      return
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
  const subtitleArray: string[] = []

  originalSubtitle.map((subtitleData, index) => {
    if (index === contentArrayIndex[0]) {
      subtitleArray.push(translatedTextArray[0])
      translatedTextArray.shift()
      contentArrayIndex.shift()
    } else {
      subtitleArray.push(subtitleData)
    }
  })

  return subtitleArray
}

const translateDeepL = async (targetStringArray: string[]): Promise<Record<'text', string>> => {
  const translateFinArray: Record<'text', string>[] = []
  for (const currentPromise of targetStringArray) {
    const retryRequest = async (retryCount = 0) => {
      try {
        const response = await fetch('api/deepl', {
          method: 'POST',
          body: JSON.stringify({ text: currentPromise, original: 'en', exchange: 'ja' })
        })
        if (!response.ok) return
        const translatedText: { text: string } = await response.json()
        translateFinArray.push(translatedText)
      } catch (error) {
        if (retryCount === 4) return
        await retryRequest(retryCount + 1)
      }
    }
    await retryRequest()
  }
  return translateFinArray[0]
}

export const sliceByNumber = (array: string[], number: number): string[][] => {
  const length = Math.ceil(array.length / number)
  return new Array(length).fill(undefined).map((_, i) => array.slice(i * number, (i + 1) * number))
}
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 半角記号を全角へ変換
export const toZenWidth = (strVal: string) => {
  const zenVal = strVal.replace(/[<>!@#$%^&*)(+=._-]/g, (tmpStr: string) =>
    String.fromCharCode(tmpStr.charCodeAt(0) + 0xfee0)
  )
  // 文字コードシフトで対応できない文字の変換
  return zenVal.replace(/"/g, '”').replace(/'/g, '’').replace(/`/g, '‘').replace(/\\/g, '￥').replace(/~/g, '〜')
}
