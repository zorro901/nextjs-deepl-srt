import type { NextPage } from 'next'
import Head from 'next/head'
import type { ChangeEvent } from 'react'

const translateDeepL = async (targetStringArray: string[]): Promise<Record<'text', string>> => {
  const translateFinArray: Record<'text', string>[] = []
  for (const currentPromise of targetStringArray) {
    const retryRequest = async (retryCount = 0) => {
      try {
        const response = await fetch('api/deepl', { method: 'POST', body: JSON.stringify({ text: currentPromise }) })
        if (!response.ok) return null
        const json = await response.json()
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
const srtTranslate = async (srtFile: File) => {
  const reader = new FileReader()
  reader.readAsText(srtFile)
  reader.onload = async readerEvent => {
    // 字幕を展開する
    const targetSubtitle = readerEvent.target?.result
    if (typeof targetSubtitle !== 'string') return
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

    originalSubtitle.map((v, i) => {
      if (i === contentArrayIndex[0]) {
        finishedSubtitleArray.push(translatedTextArray[0])
        translatedTextArray.shift()
        contentArrayIndex.shift()
      } else {
        finishedSubtitleArray.push(v)
      }
    })

    // 拡張子を取得
    const fileName = srtFile.name
    const file_type = fileName.split('.').pop()

    // 完成したデータを自動ダウンロード
    const blob = new Blob([finishedSubtitleArray.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchorElement = document.createElement('a')
    document.body.appendChild(anchorElement)

    // ファイル名に_jaを追加する
    let defaultName = fileName.match(/(.*)\.([^.]+$)/)?.[1]
    if (defaultName === undefined) return
    if (defaultName.indexOf('_en') !== -1) {
      defaultName = defaultName.slice(0, -3)
    }
    if (defaultName.indexOf('en_US') !== -1) {
      defaultName = defaultName.slice(0, -5)
    }
    anchorElement.download = `${defaultName}_ja.${file_type}`
    anchorElement.href = url
    anchorElement.click()
    anchorElement.remove()
    URL.revokeObjectURL(url)
  }
}
const Home: NextPage = () => {
  const handleMultiUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const loading = document.getElementById('loading')
    const upload = document.getElementById('upload')
    if (!loading || !upload) return
    loading.classList.remove('hidden')
    upload.classList.add('hidden')

    const FileList = event.target.files
    if (!FileList) return
    const files = Array.from(FileList)

    for (let i = 0; i < files.length; i++) {
      await srtTranslate(files[i])
      if (i === files.length - 1) {
        loading.classList.add('hidden')
        upload.classList.remove('hidden')
      }
    }
  }
  return (
    <>
      <Head>
        <title>SRT TRANSLATOR</title>
        <meta name='description' content='SRT TRANSLATOR' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <div className={'bg-gray-600 flex w-screen h-screen items-center flex-col pt-16'}>
        <div className={'container flex flex-col'}>
          <h4 className={'flex justify-center font-bold text-white text-lg'}>SRT TRANSLATOR</h4>
        </div>

        <div className={'container flex flex-col w-full items-center py-16'}>
          <div className='bg-grey-lighter' id={'upload'}>
            <label className='w-64 flex flex-col items-center px-4 py-6 bg-white text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue-100 hover:text-black'>
              <svg className='w-8 h-8' fill='currentColor' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>
                <path d='M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z' />
              </svg>
              <span className='mt-2 text-base leading-normal'>Select a file</span>
              <input
                type='file'
                className='hidden'
                onChange={event => handleMultiUploadFile(event)}
                accept='.srt,.vtt'
                multiple
              />
            </label>
          </div>

          <div className={'flex flex-col w-full items-center hidden'} id={'loading'}>
            <svg
              className='animate-spin h-1/2 w-1/2 text-white'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
            >
              <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              />
            </svg>
          </div>
        </div>
      </div>
    </>
  )
}

export default Home
