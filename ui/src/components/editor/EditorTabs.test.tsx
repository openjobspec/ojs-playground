import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorTabs } from './EditorTabs'

const tabs = [
  { id: 'one', title: 'Job One', content: '{}' },
  { id: 'two', title: 'Job Two', content: '{}' },
  { id: 'three', title: 'Job Three', content: '{}' },
]

describe('EditorTabs', () => {
  afterEach(() => vi.restoreAllMocks())

  it('exposes semantic tabs, panel relationships, and separate close buttons', () => {
    render(
      <EditorTabs
        tabs={tabs}
        activeTabId="two"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAdd={vi.fn()}
      />,
    )

    expect(screen.getByRole('tablist', { name: 'Job editor tabs' })).toBeDefined()
    const jobOne = screen.getByRole('tab', { name: 'Job One' })
    const jobTwo = screen.getByRole('tab', { name: 'Job Two' })
    expect(jobOne.getAttribute('aria-selected')).toBe('false')
    expect(jobOne.tabIndex).toBe(-1)
    expect(jobTwo.getAttribute('aria-selected')).toBe('true')
    expect(jobTwo.getAttribute('aria-controls')).toBe('editor-tabpanel')
    expect(jobTwo.tabIndex).toBe(0)

    const close = screen.getByRole('button', { name: 'Close Job Two' })
    expect(close.closest('[role="tab"]')).toBeNull()
    expect(close.className).toContain('min-h-11')
    expect(screen.getByRole('button', { name: 'New job tab' }).className).toContain('min-w-11')
  })

  it('supports Left, Right, Home, and End roving keyboard focus', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const onSelect = vi.fn()
    render(
      <EditorTabs
        tabs={tabs}
        activeTabId="one"
        onSelect={onSelect}
        onClose={vi.fn()}
        onAdd={vi.fn()}
      />,
    )

    const one = screen.getByRole('tab', { name: 'Job One' })
    const two = screen.getByRole('tab', { name: 'Job Two' })
    const three = screen.getByRole('tab', { name: 'Job Three' })

    one.focus()
    fireEvent.keyDown(one, { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenLastCalledWith('two')
    expect(document.activeElement).toBe(two)

    fireEvent.keyDown(two, { key: 'End' })
    expect(onSelect).toHaveBeenLastCalledWith('three')
    expect(document.activeElement).toBe(three)

    fireEvent.keyDown(three, { key: 'Home' })
    expect(onSelect).toHaveBeenLastCalledWith('one')
    expect(document.activeElement).toBe(one)

    fireEvent.keyDown(one, { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenLastCalledWith('three')
    expect(document.activeElement).toBe(three)
  })
})
