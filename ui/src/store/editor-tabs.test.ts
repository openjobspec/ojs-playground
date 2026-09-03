import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_JOB_JSON } from '@/engine/constants'
import { useStore } from './index'

describe('editor tab content persistence', () => {
  beforeEach(() => {
    useStore.setState({
      editorContent: '',
      parsedJob: null,
      tabs: [{ id: 'tab-test-1', title: 'Job 1', content: '' }],
      activeTabId: 'tab-test-1',
      editorMode: 'json',
    })
  })

  it('keeps programmatic and user content with its active tab', () => {
    const state = useStore.getState()
    state.initFromContent(DEFAULT_JOB_JSON)
    expect(useStore.getState().tabs[0]?.content).toBe(DEFAULT_JOB_JSON)

    useStore.getState().addTab('Job 2')
    expect(useStore.getState().tabs[0]?.content).toBe(DEFAULT_JOB_JSON)
    const secondTab = useStore.getState().activeTabId

    const secondContent = DEFAULT_JOB_JSON.replace('email.send', 'report.generate')
    useStore.getState().initFromContent(secondContent)
    expect(useStore.getState().tabs.find((tab) => tab.id === secondTab)?.content).toBe(secondContent)

    useStore.getState().switchTab('tab-test-1')
    expect(useStore.getState().editorContent).toBe(DEFAULT_JOB_JSON)
  })
})
