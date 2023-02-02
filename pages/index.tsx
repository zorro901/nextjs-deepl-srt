import type { NextPage } from 'next'
import Head from 'next/head'
import { useRef, useState } from 'react'
import { srtTranslate } from '../utils/srt-translate'
import Loading from './components/loading'

const loadSrt = async (srtFile: File) => {
  const reader = new FileReader()
  reader.readAsText(srtFile)
  await new Promise<void>(resolve => (reader.onload = () => resolve()))
  const targetSubtitle = typeof reader.result === 'string' ? reader.result : ''
  const finishedSubtitleArray = await srtTranslate({ targetSubtitle })
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
const Home: NextPage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const handleMultiUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true)
    event.preventDefault()
    const FileList = event.target.files
    if (!FileList) return
    const files = Array.from(FileList)
    const loadSrtPromise = (file: File) => new Promise(resolve => loadSrt(file).then(resolve))

    ;(async () => {
      for (const file of files) {
        await loadSrtPromise(file)
      }
      setIsLoading(false)
    })()
  }
  const fileUpload = () => {
    inputRef.current?.click()
  }
  return (
    <>
      <Head>
        <title>SRT TRANSLATOR</title>
        <meta name='description' content='SRT TRANSLATOR' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <div className={'bg-gray-600 w-screen h-screen flex flex-col'}>
        <h4 className={'text-center font-bold text-white text-lg py-16'}>SRT TRANSLATOR</h4>
        <div className={`grid place-content-center`}>
          {isLoading ? (
            <Loading />
          ) : (
            <>
              <div
                onClick={() => fileUpload()}
                className='grid justify-items-center w-64 px-4 py-6 bg-white text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue-100 hover:text-black'
              >
                <svg className='w-8 h-8' fill='currentColor' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>
                  <path d='M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z' />
                </svg>
                <span className='mt-2 text-base leading-normal'>Select a file</span>
              </div>
              <label>
                <input
                  hidden
                  type='file'
                  ref={inputRef}
                  onChange={event => handleMultiUploadFile(event)}
                  accept='.srt,.vtt'
                  multiple
                />
              </label>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default Home
