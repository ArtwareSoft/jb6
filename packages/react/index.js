import { dsls } from '@jb6/core'
import { reactUtils } from './react-utils.js'

const { 
  tgp: { TgpType },
} = dsls

TgpType('react-comp', 'react')

const { h, L, useState, useEffect, useRef, useContext, initDom} = reactUtils
export { h, L, useState, useEffect, useRef, useContext, reactUtils, initDom}