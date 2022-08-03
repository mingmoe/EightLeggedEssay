
// 每个索引可以放置的文章数量
export const PosterPerIndex = 1;

// 文章输出的路径的前缀
export const PosterOutputPrefix = "content"

// 输出URL目标
export const ContentUrlRoot = "/" + PosterOutputPrefix;

// 文章信息
export interface PosterInfo {
    title: string,
    datetime: string,
    tags: string[],
    precompile: boolean,
    // 留给用户
    attr: any
    // 留给程序
    expand: any
}

// 表示每篇文章
export interface Poster {
    // 文章的信息（头部）
    infos: PosterInfo,
    // 文章html
    html: string | null,
    // 文章源
    markdown: string | null,
    // 编译时间戳， mtime.MS
    compile_time: number | undefined
}

// 索引项目
export interface IndexItem {
    // url
    url: string,
    // is the same as the Poster.infos
    infos: PosterInfo,
}

// 索引
export interface Index {
    next_index: null | string,
    pre_index: null | string,
    items: IndexItem[]
}

// 根索引
export interface Root {
    index_index_urls: string[],
    tags: {
        [key: string]: {
            index_urls: string[]
        }
    },
    archives: {
        [key: number]: {
            index_urls: string[]
        }
    }
}

export const ROOT_INDEX_NAME = "root.json"
export const ROOT_INDEX_PATH = PosterOutputPrefix + "/" + ROOT_INDEX_NAME
export const ROOT_INDEX_URL = "/" + ROOT_INDEX_PATH
