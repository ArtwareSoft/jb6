import { calcTgpModelData } from './tgp-model-data.js'

const filePath = process.argv[2]

if (!filePath) {
  console.error('Error: filePath argument is required')
  process.exit(1)
}

calcTgpModelData({ filePath })
  .then(data => {
    console.log(JSON.stringify(data, null, 2))
  })
  .catch(err => {
    console.error('Error calculating TGP model data:', err)
    process.exit(1)
  })
