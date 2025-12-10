import { Loader } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createInteractionParser } from 'remark-flow'

// Dynamic import to avoid SSR issues
const MarkdownFlow = dynamic(
  () => import('markdown-flow-ui').then((mod) => mod.MarkdownFlow),
  { ssr: false }
)

import type {
  ContentRenderProps,
  CustomRenderBarProps,
  OnSendContentParams,
} from 'markdown-flow-ui'
import { API_BASE_URL } from '@/lib/api'
import 'markdown-flow-ui/dist/markdown-flow-ui.css'
import 'markdown-flow-ui/dist/markdown-flow-ui-lib.css'
import useMarkdownInfo from './useMarkdownInfo'
import useSSE from './useSSE'
import './Playground.css'

// 定义接口类型
interface RemarkCompatibleResult {
  variableName?: string
  buttonTexts?: string[]
  buttonValues?: string[]
  placeholder?: string
  isMultiSelect?: boolean
}

// Define markdown info data structure
interface MarkdownInfoData {
  block_count: number;
  variables: string[];
  interaction_blocks: number[];
  content_blocks: number[];
}

// Extend ContentRenderProps to include defaultSelectedValues and dynamic interaction format
interface ExtendedContentRenderProps extends ContentRenderProps {
  defaultSelectedValues?: string[];
}

type PlaygroundComponentProps = {
  defaultContent: string
  defaultVariables?: {
    [key: string]: string | number | boolean
  }
  defaultDocumentPrompt?: string
  styles?: React.CSSProperties
  sseUrl?: string
  sessionId?: string
  onVariableUpdate?: (variableName: string, value: string, rawValues?: string[]) => void
  onContentUpdate?: (content: string[]) => void
  markdownInfo?: MarkdownInfoData | null // Accept pre-analyzed markdown info to avoid duplicate API calls
}

type SSEParams = {
  content: string
  block_index: number
  context: Array<{
    role: string
    content: string
  }>
  variables?: {
    [key: string]: string | number | boolean
  }
  user_input: { [key: string]: string[] } | null
  document_prompt: string | null
  interaction_prompt: string | null
  interaction_error_prompt: string | null
  model: string | null
}

const PlaygroundComponent: React.FC<PlaygroundComponentProps> = ({
  defaultContent,
  defaultVariables = {},
  defaultDocumentPrompt = '',
  styles = {},
  sseUrl = `${API_BASE_URL}/playground/generate`,
  sessionId,
  onVariableUpdate,
  onContentUpdate,
  markdownInfo: externalMarkdownInfo,
}) => {

  // Use external markdownInfo if provided, otherwise fetch it ourselves
  const { data: fetchedMarkdownInfo, loading: isMarkdownLoading } =
    useMarkdownInfo(externalMarkdownInfo ? '' : defaultContent) // Only fetch if no external data provided

  const markdownInfo = externalMarkdownInfo || fetchedMarkdownInfo
  const isLoading = externalMarkdownInfo ? false : isMarkdownLoading

  const { block_count = 0, interaction_blocks = [] } = markdownInfo || {}
  const currentBlockIndexRef = useRef<number>(0)
  const currentMessageIndexRef = useRef<number>(0)
  const userOperateErrorFlag = useRef<boolean>(false)
  const [contentList, setContentList] = useState<ExtendedContentRenderProps[]>([])
  const [loadingBlockIndex, setLoadingBlockIndex] = useState<number | null>(
    null,
  )

  const [sseParams, setSseParams] = useState<SSEParams>({
    content: defaultContent,
    block_index: 0,
    context: [{ role: 'assistant', content: '' }],
    variables: defaultVariables,
    user_input: null,
    document_prompt: defaultDocumentPrompt,
    interaction_prompt: null,
    interaction_error_prompt: null,
    model: null,
  })


  // 创建交互块解析器实例
  const interactionParser = createInteractionParser()

  // 解析交互块内容获取结构化信息
  const parseInteractionBlock = (content: string, variableName: string): RemarkCompatibleResult | null => {
    try {
      // 直接使用解析器解析内容
      const result = interactionParser.parseToRemarkFormat(content)

      // 检查变量名是否匹配
      if (result.variableName === variableName) {
        return result
      }

      return null
    } catch (error) {
      console.error('解析交互块失败:', error)
      return null
    }
  }

  const getSSEBody = (): string => {
    return JSON.stringify(sseParams)
  }
  // Return the context field in SSE params
  const updateContextParamsForNextBlock = (
    currentData: string,
  ): Array<{ role: string; content: string }> => {
    const newContext = [...sseParams.context]

    // Ensure array length is sufficient
    while (newContext.length <= currentBlockIndexRef.current) {
      newContext.push({ role: 'assistant', content: '' })
    }

    // Update current block content
    newContext[currentBlockIndexRef.current] = {
      ...newContext[currentBlockIndexRef.current],
      content: currentData,
    }

    // Add placeholder for next block
    if (newContext.length <= currentBlockIndexRef.current + 1) {
      newContext.push({ role: 'assistant', content: '' })
    }

    return newContext
  }
  // Update contentList with SSE data
  const updateContentListWithSseData = useCallback((newData: string) => {
    setContentList(prevContentList => {
      const newList = [...prevContentList]
      const currentIndex = currentMessageIndexRef.current
      while (newList.length <= currentIndex) {
        newList.push({ content: '' })
      }

      // Update current block content
      newList[currentIndex] = {
        ...newList[currentIndex],
        content: newData,
      }


      return newList
    })

    // Clear loading state
    setLoadingBlockIndex(prev => {
      const currentIndex = currentMessageIndexRef.current
      if (prev === currentIndex) {
        return null
      }
      return prev
    })
  }, [])

  // Return contentList after user operation
  const updateContentListWithUserOperate = (
    params: OnSendContentParams,
  ): ExtendedContentRenderProps[] => {
    const newList = [...contentList]
    const lastIndex = newList.length - 1
    if (lastIndex >= 0) {
      newList[lastIndex] = {
        ...newList[lastIndex],
        readonly: true,
        defaultButtonText: params.buttonText,
        defaultInputText: params.inputText,
        defaultSelectedValues: params.selectedValues,
      }
    }
    return newList
  }

  const updateContentListWithUserError = (data: string) => {
    const newList = [...contentList]
    const lastIndex = newList.length - 1
    const item = {
      ...newList[lastIndex],
    }
    newList.push({
      content: data,
    })
    newList.push({
      ...item,
      readonly: false,
      defaultButtonText: '',
      defaultInputText: '',
      defaultSelectedValues: undefined,
    })

    return newList
  }

  const handleOnFinish = (finalData: unknown, _index: number, _variableName: string | null) => {
    const data = String(finalData)
    const isCurrentStaticInteractionBlock = interaction_blocks.includes(
      currentBlockIndexRef.current,
    )

    // Check if the received data contains interaction block format (dynamic or static)
    const containsInteraction = data && data.match(/\?\[/)

    // If current block is interaction block content (static or dynamic) and has data, stop continuing
    if (containsInteraction) {
      return
    }

    // If current block is interaction block reply (static) and has data, mark user operation error
    if (data && isCurrentStaticInteractionBlock && !containsInteraction) {
      userOperateErrorFlag.current = true
      const updatedList = updateContentListWithUserError(data)
      setContentList(updatedList)
      // Update currentMessageIndexRef to point to the newly created interaction block (last item in updatedList)
      currentMessageIndexRef.current = updatedList.length - 1
      setLoadingBlockIndex(null) // Clear loading state
      return
    }

    // If next block is static interaction block, preset loading state
    const nextIndex = currentBlockIndexRef.current + 1
    const isNextStaticInteractionBlock = interaction_blocks.includes(nextIndex)
    if (isNextStaticInteractionBlock && nextIndex < block_count) {
      setLoadingBlockIndex(nextIndex)
    }

    // If reached the last block, stop
    if (nextIndex >= block_count) {
      setLoadingBlockIndex(null) // Clear loading state
      return
    }

    const newContext = updateContextParamsForNextBlock(data)

    setSseParams(prev => ({
      ...prev,
      user_input: null,
      block_index: nextIndex,
      context: newContext,
      t: +new Date(),
    }))
    // Update current block index
    currentBlockIndexRef.current = nextIndex
  }

  const handleOnStart = () => {
    // 确保每个新的块都在独立的位置显示，不覆盖之前的内容
    // 使用 setState 的函数形式确保获取最新的 contentList 长度
    setContentList(prevContentList => {
      const nextContentIndex = prevContentList.length
      currentMessageIndexRef.current = nextContentIndex
      setLoadingBlockIndex(nextContentIndex)
      return prevContentList
    })
  }

  // Add loading state handling for contentList
  const getContentListWithLoading = (): ExtendedContentRenderProps[] => {
    const list = [...contentList]

    // If there is loadingBlockIndex, ensure content exists at that position and add loading indicator
    if (loadingBlockIndex !== null) {
      while (list.length <= loadingBlockIndex) {
        list.push({ content: '' })
      }
      // Add custom render bar for loading block
      list[loadingBlockIndex] = {
        ...list[loadingBlockIndex],
        customRenderBar: LoadingBar,
      }
    }

    return list
  }

  const sseOptions = useMemo(() => ({
    method: 'POST',
    body: getSSEBody(),
    headers: {
      ...(sessionId ? { 'session-id': sessionId } : {}),
      'Output-Language': 'zh',
    },
    autoConnect: !!markdownInfo && !isLoading,
    onStart: handleOnStart,
    onFinish: handleOnFinish,
  }), [sessionId, markdownInfo, isLoading, sseParams])

  const { data, connect } = useSSE<string>(sseUrl, sseOptions)

  useEffect(() => {
    if (markdownInfo && !isLoading) {
      connect()
    }
  }, [markdownInfo, isLoading, connect])

  // Notify parent component when contentList changes
  useEffect(() => {
    if (onContentUpdate && contentList.length > 0) {
      const contentArray = contentList
        .map(item => item.content)
        .filter(content => content && content.trim()) // Filter out empty content
      onContentUpdate(contentArray)
    }
  }, [contentList, onContentUpdate])

  useEffect(() => {
    if (data && !userOperateErrorFlag.current) {
      let content = data
      let defaultValue: any
      let variableName: string = ''
      // 用户操作
      if (typeof data === 'object' && (data as any).variableName) {
        content = (data as any).content
        variableName = (data as any).variableName

        defaultValue = defaultVariables[variableName]
      }

      try {
        updateContentListWithSseData(content)

        // 智能预设值验证和处理
        if (defaultValue !== undefined && defaultValue !== '' && variableName) {
          // 使用解析器分析当前交互块
          const interactionInfo = parseInteractionBlock(content, variableName)

          if (interactionInfo) {
            const valueString = defaultValue.toString()
            const isValueInButtons = interactionInfo.buttonValues?.includes(valueString) ?? false
            const hasTextInput = !!interactionInfo.placeholder // 检查是否有文本输入选项 (如 ...其他岗位)
            const isMultiSelect = interactionInfo.isMultiSelect ?? false

            if (isMultiSelect) {
              // 多选模式：支持预设值，如果预设值都有效则自动提交
              // 将逗号分隔的字符串转换为数组
              const presetValues = valueString.split(',').map((v: string) => v.trim()).filter((v: string) => v)

              // 检查预设值是否都在按钮选项中
              const validPresetValues = presetValues.filter((value: string) =>
                interactionInfo.buttonValues?.includes(value) ?? false,
              )

              const allValuesValid = validPresetValues.length === presetValues.length && presetValues.length > 0

              if (allValuesValid) {
                // 所有预设值都有效，自动提交
                setContentList((prevContentList) => {
                  const newList = [...prevContentList]
                  const currentIndex = currentMessageIndexRef.current
                  if (newList[currentIndex]) {
                    newList[currentIndex] = {
                      ...newList[currentIndex],
                      readonly: true,
                      defaultSelectedValues: validPresetValues,
                    }
                  }
                  return newList
                })

                // 通知上层组件变量值已更新
                if (onVariableUpdate) {
                  onVariableUpdate(variableName, valueString, validPresetValues)
                }

                // 执行自动提交逻辑
                setTimeout(() => {
                  userOperateErrorFlag.current = false
                  const userInput = valueString

                  const finalVariableName = variableName


                  const newContext = [...sseParams.context]
                  if (newContext[currentBlockIndexRef.current]) {
                    newContext[currentBlockIndexRef.current] = {
                      ...newContext[currentBlockIndexRef.current],
                      content: userInput,
                      role: 'user',
                    }
                  }

                  setSseParams((prev) => ({
                    ...prev,
                    context: newContext,
                    user_input: userInput ? { [finalVariableName]: validPresetValues } : null,
                    variables: {
                      ...prev.variables,
                      [finalVariableName]: validPresetValues.join(', '), // 使用处理后的值数组转字符串，保持一致性
                    },
                    t: +new Date(),
                  }))
                }, 800)

              } else {
                // 需要用户交互，显示预设值并等待选择
                setContentList((prevContentList) => {
                  const newList = [...prevContentList]
                  const currentIndex = currentMessageIndexRef.current
                  if (newList[currentIndex]) {
                    newList[currentIndex] = {
                      ...newList[currentIndex],
                      readonly: false,
                      defaultSelectedValues: validPresetValues,
                    }
                  }
                  return newList
                })
              }
            } else if (isValueInButtons) {
              // 单选模式，预设值在选项中，自动提交
              setContentList((prevContentList) => {
                const newList = [...prevContentList]
                const currentIndex = currentMessageIndexRef.current
                if (newList[currentIndex]) {
                  newList[currentIndex] = {
                    ...newList[currentIndex],
                    // 只设置按钮默认值，不设置文本框默认值
                    defaultButtonText: valueString,
                    readonly: true,
                  }
                }
                return newList
              })

              // 通知上层组件变量值已更新（用于同步到输入框）
              if (onVariableUpdate) {
                onVariableUpdate(variableName, valueString)
              }

              // 执行自动提交逻辑
              setTimeout(() => {
                userOperateErrorFlag.current = false
                const userInput = valueString
                const finalVariableName = variableName
                const newContext = [...sseParams.context]
                if (newContext[currentBlockIndexRef.current]) {
                  newContext[currentBlockIndexRef.current] = {
                    ...newContext[currentBlockIndexRef.current],
                    content: userInput,
                    role: 'user',
                  }
                }

                setSseParams((prev) => ({
                  ...prev,
                  context: newContext,
                  user_input: userInput ? { [finalVariableName]: [userInput] } : null,
                  variables: {
                    ...prev.variables,
                    [finalVariableName]: userInput,
                  },
                  t: +new Date(),
                }))
              }, 800)

            } else if (hasTextInput) {
              // 情况2: 预设值不在按钮中但有文本框 → 填入文本框并自动提交
              setContentList((prevContentList) => {
                const newList = [...prevContentList]
                const currentIndex = currentMessageIndexRef.current
                if (newList[currentIndex]) {
                  newList[currentIndex] = {
                    ...newList[currentIndex],
                    defaultInputText: valueString, // 填入文本框
                    readonly: true, // 自动提交
                  }
                }
                return newList
              })

              // 通知上层组件变量值已更新（用于同步到输入框）
              if (onVariableUpdate) {
                onVariableUpdate(variableName, valueString)
              }

              // 执行自动提交逻辑
              setTimeout(() => {
                userOperateErrorFlag.current = false
                const userInput = valueString
                const finalVariableName = variableName
                const newContext = [...sseParams.context]
                if (newContext[currentBlockIndexRef.current]) {
                  newContext[currentBlockIndexRef.current] = {
                    ...newContext[currentBlockIndexRef.current],
                    content: userInput,
                    role: 'user',
                  }
                }

                setSseParams((prev) => ({
                  ...prev,
                  context: newContext,
                  user_input: userInput ? { [finalVariableName]: [userInput] } : null,
                  variables: {
                    ...prev.variables,
                    [finalVariableName]: userInput,
                  },
                  t: +new Date(),
                }))
              }, 800)

            } else {
              // 预设值不在选项中，等待用户手动选择
              setContentList((prevContentList) => {
                const newList = [...prevContentList]
                const currentIndex = currentMessageIndexRef.current
                if (newList[currentIndex]) {
                  newList[currentIndex] = {
                    ...newList[currentIndex],
                    readonly: false, // 保持交互状态，不自动提交
                    // 不设置 defaultInputText，让用户手动选择
                  }
                }
                return newList
              })
              // 不执行自动提交，等待用户操作
            }
          } else {
            // 解析失败，回退到原来的逻辑
            // 解析交互块失败，回退到原逻辑
            setContentList((prevContentList) => {
              const newList = [...prevContentList]
              const currentIndex = currentMessageIndexRef.current
              if (newList[currentIndex]) {
                newList[currentIndex] = {
                  ...newList[currentIndex],
                  defaultInputText: defaultValue.toString(),
                  defaultButtonText: defaultValue.toString(),
                  readonly: true,
                }
              }
              return newList
            })

            // 通知上层组件变量值已更新（用于同步到输入框）
            if (onVariableUpdate) {
              onVariableUpdate(variableName, defaultValue.toString())
            }

            setTimeout(() => {
              userOperateErrorFlag.current = false
              const userInput = defaultValue.toString()
              const finalVariableName = variableName
              const userInputDict = userInput ? { [finalVariableName]: [userInput] } : null
              const newContext = [...sseParams.context]
              if (newContext[currentBlockIndexRef.current]) {
                newContext[currentBlockIndexRef.current] = {
                  ...newContext[currentBlockIndexRef.current],
                  content: userInput,
                  role: 'user',
                }
              }

              setSseParams((prev) => ({
                ...prev,
                context: newContext,
                user_input: userInputDict,
                variables: {
                  ...prev.variables,
                  [finalVariableName]: userInput,
                },
                t: +new Date(),
              }))
            }, 800)
          }
        }

      } catch (error) {
        console.error('Error processing SSE message:', error)
      }
    }
  }, [data, updateContentListWithSseData, defaultVariables])

  // Create Loading component
  const LoadingBar: CustomRenderBarProps = () => {
    return (
      <span className='flex gap-[10px] items-center'>
        <Loader
          className='animate-spin'
          style={{ width: '15px', height: '15px' }}
        />
        思考中...
      </span>
    )
  }

  const handleSend = (params: OnSendContentParams) => {
    userOperateErrorFlag.current = false

    // Build values array from user input
    let values: string[] = []
    if (params.selectedValues && params.selectedValues.length > 0) {
      // Multi-select mode: combine selected values with optional input text
      values = [...params.selectedValues]
      if (params.inputText) {
        values.push(params.inputText)
      }
    } else if (params.inputText) {
      // Single-select mode: use input text
      values = [params.inputText]
    } else if (params.buttonText) {
      // Single-select mode: use button text
      values = [params.buttonText]
    }

    // Build user input dictionary format for new markdownflow package
    const variableName = params.variableName || 'user_input'
    const userInputDict = values.length > 0 ? { [variableName]: values } : null

    // For display purposes, join values as string (for context and variables)
    const userInputString = values.join(', ')

    const newContext = [...sseParams.context]
    if (newContext[currentBlockIndexRef.current]) {
      newContext[currentBlockIndexRef.current] = {
        ...newContext[currentBlockIndexRef.current],
        content: userInputString,
        role: 'user',
      }
    }

    // Update SSE parameters with new variable value
    const updatedVariables = {
      ...sseParams.variables,
      [variableName]: userInputString,
    }

    setSseParams(prev => ({
      ...prev,
      context: newContext,
      user_input: userInputDict,
      variables: updatedVariables,
      t: +new Date(),
    }))

    // 通知上层组件变量已更新 - 添加新的回调
    if (onVariableUpdate && params.variableName) {
      onVariableUpdate(params.variableName, userInputString, values.length > 1 ? values : undefined)
    }

    // Update content list
    const updatedList = updateContentListWithUserOperate(params)
    setContentList(updatedList)
  }

  // Type adaptation function
  const getAdaptedContentList = () => {
    const result = getContentListWithLoading().map(item => ({
      content: item.content,
      customRenderBar: item.customRenderBar || (() => null),
      defaultButtonText: item.defaultButtonText,
      defaultInputText: item.defaultInputText,
      defaultSelectedValues: item.defaultSelectedValues,
      readonly: item.readonly,
    }))
    return result
  }

  return (
    <div style={styles}>
      <MarkdownFlow
        initialContentList={getAdaptedContentList()}
        onSend={handleSend}
        confirmButtonText="确认"
        enableTypewriter={false}
      />
    </div>
  )
}

export default PlaygroundComponent
