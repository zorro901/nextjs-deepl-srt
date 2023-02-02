const fruitsToGet = ['apple', 'grape', 'pear']

const fruitBasket: Record<string, number> = {
  apple: 27,
  grape: 0,
  pear: 14
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const getNumFruit = (fruit: string) => sleep(1000).then(() => fruitBasket[fruit])

const reduceLoop = async () => {
  console.log('Start')
  // const sum = fruitsToGet.reduce(async (promisedSum, fruit) => {
  const sum = fruitsToGet.reduce(async (promisedSum: Promise<number>, fruit: string): Promise<number> => {
    // Heavy-lifting comes first.
    // This triggers all three `getNumFruit` promises before waiting for the next interation of the loop.
    const numFruit = await getNumFruit(fruit)
    return (await promisedSum) + numFruit
  }, Promise.resolve<number>(0))

  console.log(sum)
  console.log('End')
  return sum
}

// const reduceLoop = async () => {
//   console.log('Start')
//
//   const promises = fruitsToGet.map(getNumFruit)
//   const numFruits = await Promise.all(promises)
//   console.log(await Promise.all(promises))
//   const sum = numFruits.reduce((sum, fruit) => sum + fruit)
//
//   console.log(sum)
//   console.log('End')
// }
;(async () => reduceLoop())()

// reduceLoop().then(v => console.log(v))
