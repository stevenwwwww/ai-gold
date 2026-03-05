/**
 * 平台 API 适配层
 * 统一不同小程序平台的差异，业务代码只依赖此适配层
 */
import Taro from '@tarojs/taro'

/** 当前平台（TARO_ENV 由 Taro 编译时注入） */
export const platform = typeof process !== 'undefined' && process.env?.TARO_ENV
  ? process.env.TARO_ENV
  : 'weapp'

/** 是否为微信小程序 */
export const isWeapp = platform === 'weapp'

/** 是否为支付宝小程序 */
export const isAlipay = platform === 'alipay'

/** 是否为 H5 */
export const isH5 = platform === 'h5'

/**
 * 统一存储读取
 */
export const getStorage = <T = string>(key: string): T | null => {
  try {
    const res = Taro.getStorageSync(key)
    return res as T
  } catch {
    return null
  }
}

/**
 * 统一存储写入
 */
export const setStorage = (key: string, value: unknown): void => {
  try {
    Taro.setStorageSync(key, value)
  } catch (e) {
    console.warn('[platform] setStorage failed:', e)
  }
}

/**
 * 统一存储删除
 */
export const removeStorage = (key: string): void => {
  try {
    Taro.removeStorageSync(key)
  } catch (e) {
    console.warn('[platform] removeStorage failed:', e)
  }
}
