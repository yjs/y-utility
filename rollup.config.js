import * as fs from 'fs'

const files = fs.readdirSync('./').filter(file => /(?<!(test|config))\.js$/.test(file))

export default [{
  input: files,
  output: {
    dir: './dist',
    format: 'cjs',
    sourcemap: true,
    entryFileNames: '[name].cjs',
    chunkFileNames: '[name]-[hash].cjs'
  }
}]
