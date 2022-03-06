import axios from 'axios'
import type { NextPage } from 'next'
import Head from 'next/head'

async function translateDeepL(arr: string[]) {
  const translateFinArray: string[][] = []

  for (const currentPromise of arr) {
    const retryRequest = async (count = 0) => {
      try {
        const res = await axios.post('/api/deepl', {
          text: currentPromise
        })
        translateFinArray.push(res.data.body)
      } catch (error) {
        if (count === 4) {
          return null
        }
        await retryRequest(count + 1)
      }
    }
    await retryRequest()
  }
  return translateFinArray
}
// @typescript-eslint/no-explicit-any
const srtTranslate = async (file: any) => {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.readAsText(file)
    return (reader.onload = async evt => {
      // 字幕を展開する
      const loadsub_: string = evt.target?.result as string

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const loadsub: Array<string> = loadsub_.replace(/\r/g, '').split('\n')!
      const testIndex: number[] = []
      const test = loadsub.map((v, i) => {
        if (RegExp(`^\\d{1,3}`, 'g').test(v) || v === '') {
          return null
        } else {
          testIndex.push(i)
          return v
        }
        // return RegExp(`^\\d{1,3}`, 'g').test(v) || v === '' ? null : v && testIndex.push(i)
      })
      const sub = test.filter(Boolean).join('\n')
      // 翻訳後の字幕を格納する配列
      const translateFinArray: string[][] = await translateDeepL([sub])
      // 字幕データを翻訳する

      // 翻訳した字幕を結合する
      const sub_trans_data = translateFinArray[0].flat()
      const mixedSub: string[] = []

      loadsub.map((v, i) => {
        if (i === testIndex[0]) {
          mixedSub.push(sub_trans_data[0])
          sub_trans_data.shift()
          testIndex.shift()
        } else {
          mixedSub.push(v)
        }
      })
      // 拡張子を取得
      const file_type = file.name.split('.').pop()

      // 完成したデータを自動ダウンロード
      const blob = new Blob([mixedSub.join('\n')], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      document.body.appendChild(a)
      a.download = `${file.name.match(/(.*)\.([^.]+$)/)[1]}_ja.${file_type}`
      a.href = url
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      resolve('end')
    })
  })
}
const Home: NextPage = () => {
  const handleMultiUploadFile = async (event: any) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const loading = document.getElementById('loading')!
    loading.style.display = 'flex'

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const upload = document.getElementById('upload')!
    upload.style.display = 'none'

    const FileList: FileList = event.target.files
    const files = Array.from(FileList)

    for (let i = 0; i < files.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = await srtTranslate(files[i])
    }
    upload.style.display = 'flex'
    loading.style.display = 'none'
  }
  // @ts-ignore
  return (
    <>
      <Head>
        <title>SRT TRANSLATOR</title>
        <meta name='description' content='SRT TRANSLATOR' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <div className={'container bg-gray-600 flex  w-full h-screen items-center flex-col  py-16'}>
        <div className={'container flex flex-col'}>
          <h4 className={'flex justify-center font-bold text-white text-lg'}>SRT TRANSLATOR</h4>
        </div>

        <div className={'container flex flex-col w-full items-center py-16'}>
          <div className='bg-grey-lighter ' id={'upload'}>
            <label className='w-64 flex flex-col items-center px-4 py-6 bg-white text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue-100 hover:text-black'>
              <svg className='w-8 h-8' fill='currentColor' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>
                <path d='M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z' />
              </svg>
              <span className='mt-2 text-base leading-normal'>Select a file</span>
              <input type='file' className='hidden' onChange={handleMultiUploadFile} accept='.srt,.vtt' multiple />
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
