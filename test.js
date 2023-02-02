const fruitsToGet = ['apple', 'grape', 'pear']

const fruitBasket = {
  apple: 27,
  grape: 0,
  pear: 14
}

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const getNumFruit = fruit => {
  return sleep(1000).then(v => fruitBasket[fruit])
}
// const reduceLoop = async () => {
//   console.log('Start')
//
//   const sum = fruitsToGet.reduce(async (promisedSum, fruit) => {
//     // Heavy-lifting comes first.
//     // This triggers all three `getNumFruit` promises before waiting for the next interation of the loop.
//     const numFruit = await getNumFruit(fruit)
//     return promisedSum + numFruit
//   }, 0)
//
//   console.log(sum())
//   console.log('End')
// }
const reduceLoop = async _ => {
  console.log('Start')

  const promises = fruitsToGet.map(getNumFruit)
  const numFruits = await Promise.all(promises)
  const sum = numFruits.reduce((sum, fruit) => sum + fruit)

  console.log(sum)
  console.log('End')
}

reduceLoop().then(() => {})
