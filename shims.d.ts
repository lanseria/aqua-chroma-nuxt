/**
 * 通用的后端响应体结构。
 * @template T - 响应体中 `data` 字段的类型。
 */
interface R<T> {
  /** 业务状态码, 通常 0 代表成功 */
  code: number
  /** 响应消息, 用于提示用户 */
  msg: string
  /** 核心响应数据 */
  data: T
}

// --- 以下是基于 R<T> 的常用 Promise 辅助类型 ---

/**
 * 分页查询接口的 Promise 返回类型。
 * e.g., function getPage(): R_Pagination<User> {}
 */
interface R_Pagination<T> extends Promise<R<PaginationRecordsRes<T>>> {}

/**
 * 列表查询接口的 Promise 返回类型。
 * e.g., function getList(): R_List<Tag> {}
 */
interface R_List<T> extends Promise<R<T[]>> {}

/**
 * 树形结构数据查询接口的 Promise 返回类型。
 * e.g., function getTree(): R_Tree<Menu> {}
 */
interface R_Tree<T> extends Promise<R<T[]>> {}

/**
 * 单个实体或简单数据结构的 Promise 返回类型。
 * e.g., function getUserInfo(): R_P<UserInfo> {}
 */
interface R_P<T> extends Promise<R<T>> {}
