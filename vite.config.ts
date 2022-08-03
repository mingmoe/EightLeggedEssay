import { fileURLToPath, URL } from 'node:url'

import { defineConfig, normalizePath, ResolvedConfig, UserConfig, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'

import * as autoprefixer from 'autoprefixer'
import * as marked from "marked"
import * as yaml from "js-yaml"
import * as fs from "fs"
import * as path from "path"
import glob from "glob"
import * as luxon from "luxon"
import * as data from "./data"

// 转换器插件
function MarkdownCompiler() {
  let config: ResolvedConfig
  const content_path = normalizePath(path.resolve(data.PosterSourcePath))
  let watch:fs.FSWatcher | null = null

  function compile(){
    let run: data.CompileRun = new data.CompileRun(config.publicDir)

    // get all posters
    let files = glob.sync(content_path + "/**")

    files.forEach(file => {
      let stat = fs.statSync(file)
      if (stat.isFile()) {
        console.log("load:" + file)
        run.load(file)
      }
    })

    run.parse()
    run.generateIndexFiles()
  }

  return {
    name: 'markdown-compiler',

    configResolved(resolvedConfig: ResolvedConfig) {
      config = resolvedConfig
    },

    buildStart() {
      compile()
    },

    configureServer(server: ViteDevServer) {
      // under dev server
      // we watch files
      watch = fs.watch(content_path, function (event, filename) {
        console.log('receive filesyste change');

        compile()
      })
    },

    buildEnd(options:any){
      if(watch != null){
        watch.close()
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), MarkdownCompiler()],
  resolve: {
    alias: {
      // '@' stand for root
      // such as "@/App.vue" == "./src/App.vue"
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  css: {
    postcss: {
      plugins: [autoprefixer]
    }
  }
})
