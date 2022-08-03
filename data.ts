
import { info } from "console"
import * as yaml from "js-yaml"
import * as marked from "marked"
import * as luxon from "luxon"
import * as fs from "fs"
import * as path from "path"
import { normalizePath } from "vite"
import * as shared from "./src/shared"
import type internal from "stream"
import { arch } from "os"

// 文章存放的路径
export const PosterSourcePath = path.resolve(path.join(path.dirname(__filename), "content"))

// 解析markdown文章
export function resolveMarkdown(src: string): shared.Poster {
  // 切割头部和文章
  if (!src.startsWith("<!--")) {
    throw Error("error:not found poster heading")
  }

  let lines = src.split('\n')
  let headers: string[] = []
  let index = 1
  while (lines.length > index && lines[index].trim() != "-->") {
    headers.push(lines[index])
    index++
  }

  if (index >= lines.length) {
    throw Error("error: not found poster ending")
  }

  let infos: any = yaml.load(headers.join('\n'))

  // 检查infos
  if (infos == null || infos == undefined) {
    throw Error("the poster head is empty")
  }

  if (!infos.hasOwnProperty("title")) {
    throw Error("the poster head has no title")
  }
  if (!infos.hasOwnProperty("datetime")) {
    throw Error("the poster head has no datetime")
  }
  else {
    // check time format
    let time = luxon.DateTime.fromRFC2822(infos["datetime"])

    if (time.invalidExplanation != null) {
      throw Error("failed to parse datetime of the poster:" + time.invalidExplanation)
    }
  }
  if (!infos.hasOwnProperty("tags")) {
    throw Error("the poster head has no tags")
  }
  if (!infos.hasOwnProperty("precompile")) {
    throw Error("the poster head has no precompile")
  }
  if (!infos.hasOwnProperty("attr") || infos["attr"] == null) {
    infos["attr"] = {}
  }

  let vild_infos = infos as shared.PosterInfo

  vild_infos.expand = {}

  // 编译
  if (vild_infos.precompile) {
    let output = marked.marked.parse(lines.slice(index, lines.length).join("\n"))

    return { infos: vild_infos, html: output, markdown: null, compile_time: undefined }
  }
  else {
    let output = lines.slice(index, lines.length).join("\n")

    return { infos: vild_infos, html: null, markdown: output, compile_time: undefined }
  }
}



// 编译运行
// 每个编译运行都有自己的编译数据
export class CompileRun {
  // 文章的路径
  allPostersPaths: string[] = []

  // 解析过的文章
  parsedPosters: Map<string, shared.Poster> = new Map()

  // rootIndex: shared.Index[] = []

  // 输出路径
  OutputPath: string

  // 输出前缀
  OutputPrefix = shared.PosterOutputPrefix

  // 最终输出路径 == path.join(Path,Prefix)

  // 构造函数
  constructor(outputPath: string) {
    this.OutputPath = normalizePath(path.resolve(outputPath))

    let opt = path.resolve(this.OutputPath, this.OutputPrefix)

    // 创建输出目录
    if (!fs.existsSync(opt) || !fs.lstatSync(opt).isDirectory()) {
      fs.mkdirSync(opt)
    }
    // 清理输出目录
    else {
      fs.rmSync(opt, { recursive: true })
      fs.mkdirSync(opt)
    }
  }

  // 加载文件
  load(file: string) {
    file = normalizePath(path.resolve(file))
    if (this.allPostersPaths.find((value, index) => { if (value == file) { return true; } }) != undefined) {
      return
    }
    this.allPostersPaths.push(file);
  }

  // 把path编码为url
  pathEncodeUrl(path_to:string):string{
    let u:string[] = []
    normalizePath(path_to).split('/').forEach(item => {
        u.push(encodeURIComponent(item))
    });
    return u.join('/')
  }

  // 获取文章的输出路径
  getOutputPathOfPoster(file: string) {
    return normalizePath(path.resolve(this.OutputPath, this.OutputPrefix, path.relative(PosterSourcePath, file)))
  }

  // 获取文章的url
  getUrlOfPoster(file: string) {
    return this.pathEncodeUrl("/" + path.relative(this.OutputPath, this.getOutputPathOfPoster(file)))
  }

  // index_name如果为undefined，则我们渲染首页
  // 否则为渲染分类法 
  getIndexFileName(index: number, index_name?: string | undefined) {
    if (index_name == undefined) { index_name = "index" }
    return function (): string {
      if (index == 0) {
        return normalizePath(index_name + ".json")
      }
      else {
        return normalizePath(index_name + "_" + index.toString() + ".json")
      }
    }()
  }

  // 获取索引文件的输出路径
  getIndexFilePath(file: string): string {
    return normalizePath(path.resolve(this.OutputPath, this.OutputPrefix, file))
  }

  // 获取索引文件的URL
  getIndexUrl(file: string): string {
    return this.pathEncodeUrl("/" + path.relative(this.OutputPath, this.getIndexFilePath(file)))
  }

  // 解析已经load的文章
  parse() {
    this.allPostersPaths.forEach(posterFile => {
      while (true) {
        if (!this.parsedPosters.has(posterFile)) {
          // 编译
          try {
            let stat = fs.statSync(posterFile)
            let source = fs.readFileSync(posterFile).toString('utf8')

            let compiled = resolveMarkdown(source)
            compiled.compile_time = stat.mtimeMs
            compiled.infos.expand['URL'] = this.getUrlOfPoster(posterFile)

            console.log("compile " + posterFile + " --> " + compiled.infos.expand['URL'])

            this.parsedPosters.set(posterFile, compiled)

            // 写入文件系统
            fs.writeFileSync(this.getOutputPathOfPoster(posterFile), JSON.stringify(compiled))
          }
          catch (err) {
            console.error("failed to parse poster:" + posterFile)
            throw err
          }

          break
        }
        else {
          // 增量编译
          let p = this.parsedPosters.get(posterFile) as shared.Poster

          if (p.compile_time == undefined) {
            this.parsedPosters.delete(posterFile)
            continue
          }

          let stat = fs.statSync(posterFile)

          if (p.compile_time <= stat.mtimeMs) {
            // recompile
            this.parsedPosters.delete(posterFile)
            continue
          }

          break
        }
      }
    });
  }

  // 生成索引
  // posters: 文章
  // index_name: 要生成的索引名称
  generateIndexIndex(posters: shared.Poster[], index_name: string | undefined): shared.Index[] {
    let index: shared.Index[] = []
    let ptr = 0
    let number = 0
    let rest = posters.length

    while (rest != 0) {
      // 一网打尽
      if (rest <= shared.PosterPerIndex) {
        const temp_index: shared.Index = {
          items: [],
          pre_index: number == 0 ? null : this.getIndexUrl(this.getIndexFileName(number - 1, index_name)),
          next_index: null
        }

        const f = ptr + rest

        while (ptr != f) {
          temp_index.items.push({
            url: posters[ptr].infos.expand["URL"],
            infos: posters[ptr].infos
          });
          ptr++
        }
        index.push(temp_index)
        rest = 0
      }
      // 竭尽所能
      else {
        const temp_index: shared.Index = {
          items: [],
          pre_index: number == 0 ? null : this.getIndexUrl(this.getIndexFileName(number - 1, index_name)),
          next_index: this.getIndexUrl(this.getIndexFileName(number + 1, index_name))
        }

        const f = ptr + shared.PosterPerIndex

        while (ptr != f) {
          temp_index.items.push({
            url: posters[ptr].infos.expand["URL"] as string,
            infos: posters[ptr].infos
          });
          ptr++
        }
        index.push(temp_index)
        rest -= shared.PosterPerIndex
      }
      number++
    }

    return index
  }

  // 根据tag获取要生成的索引名称
  getTagIndexName(tag_name: string): string {
    return "tag-" + tag_name
  }

  // 根据archive获取要生成的索引名称
  getArchiveIndex(year: number): string {
    return "archive-" + year
  }

  // 生成index文件
  generateIndexFiles() {
    // global
    function sort_by_time(s: shared.Poster[]) {
      s.sort((a, b) => {
        let at = luxon.DateTime.fromRFC2822(a.infos.datetime)
        let bt = luxon.DateTime.fromRFC2822(b.infos.datetime)
        if (at > bt) {
          return -1
        }
        else if (at < bt) {
          return 1
        }
        else {
          return 0
        }
      })
    }

    // index
    let firstPage: shared.Index[] = []
    {
      let ps: shared.Poster[] = []
      this.parsedPosters.forEach((value) => { ps.push(value) })
      sort_by_time(ps)

      firstPage = this.generateIndexIndex(ps, undefined)

      firstPage.forEach((root, index) => {
        let name = this.getIndexFileName(index)
        fs.writeFileSync(this.getIndexFilePath(name), JSON.stringify(root))
        console.log("generate " + this.getIndexUrl(name))
      });
    }

    // archives
    let archives_output: Map<number, shared.Index[]> = new Map()
    {
      let archives: Map<number, shared.Poster[]> = new Map()

      this.parsedPosters.forEach((value, key) => {
        let t = luxon.DateTime.fromRFC2822(value.infos.datetime)
        if (archives.has(t.year)) {
          archives.get(t.year)?.push(value)
        }
        else {
          archives.set(t.year, [value])
        }
      })

      archives.forEach((value, key) => {
        sort_by_time(value)
        archives_output.set(key, this.generateIndexIndex(value, this.getArchiveIndex(key)))
      })

      archives_output.forEach((archives, key) => {
        archives.forEach((tag, index) => {
          let name = this.getIndexFileName(index, this.getArchiveIndex(key))
          fs.writeFileSync(this.getIndexFilePath(name), JSON.stringify(tag))
          console.log("generate " + this.getIndexUrl(name))
        });
      });
    }

    // tags
    let tags_output: Map<string, shared.Index[]> = new Map()
    {
      let tags: Map<string, shared.Poster[]> = new Map()

      this.parsedPosters.forEach((post) => {
        post.infos.tags.forEach((value) => {
          if (tags.has(value)) {
            tags.get(value)?.push(post)
          }
          else {
            tags.set(value, [post])
          }
        })
      })

      tags.forEach((value, key) => {
        sort_by_time(value)
        tags_output.set(key, this.generateIndexIndex(value, this.getTagIndexName(key)))
      })

      tags_output.forEach((tags, key) => {
        tags.forEach((tag, index) => {
          let name = this.getIndexFileName(index, this.getTagIndexName(key))
          fs.writeFileSync(this.getIndexFilePath(name), JSON.stringify(tag))
          console.log("generate " + this.getIndexUrl(name))
        });
      });
    }

    // ROOT
    let root: shared.Root = {
      index_index_urls: [],
      tags: {},
      archives: {},
    }

    {
      firstPage.forEach((item, index) => {
        root.index_index_urls.push(this.getIndexUrl(this.getIndexFileName(index, undefined)))
      });
    }

    // tags
    {
      tags_output.forEach((value, key) => {
        root.tags[key] = { index_urls: [] }
        value.forEach((item, index) => {
          root.tags[key].index_urls.push(this.getIndexUrl(this.getIndexFileName(index, this.getTagIndexName(key))))
        });
      })
    }

    // archives
    {
      archives_output.forEach((value, key) => {
        root.archives[key] = { index_urls: [] }
        value.forEach((item, index) => {
          root.archives[key].index_urls.push(this.getIndexUrl(this.getIndexFileName(index, this.getArchiveIndex(key))))
        });
      })
    }

    let p = path.join(this.OutputPath,shared.ROOT_INDEX_PATH)
    fs.writeFileSync(p,JSON.stringify(root))

    console.log("generate " + p + " --> " + shared.ROOT_INDEX_URL)
  }

}
