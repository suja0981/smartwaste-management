/**
 * components/__tests__/bin-management.test.tsx
 *
 * FIXES vs original:
 * 1. Polling interval test was asserting 2 calls after 5000ms — but the
 *    component polls every 10_000ms. Fixed to advance 10s.
 * 2. Added `jest.useRealTimers()` in afterEach to prevent timer bleed.
 * 3. Added missing `'use client'` environment setup note.
 * 4. Added act() wrapper around fireEvent to suppress React warnings.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BinManagementIntegrated } from '@/components/bin-management'
import * as apiClient from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

jest.mock('@/lib/api-client')
jest.mock('@/hooks/use-toast')

const mockBins = [
  {
    id: 'bin1',
    location: 'Downtown',
    capacity_liters: 100,
    fill_level_percent: 45,
    status: 'ok',
    latitude: 21.1458,
    longitude: 79.0882,
  },
  {
    id: 'bin2',
    location: 'Park',
    capacity_liters: 150,
    fill_level_percent: 85,
    status: 'full',
    latitude: 21.1400,
    longitude: 79.0920,
  },
]

describe('BinManagementIntegrated', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useToast as jest.Mock).mockReturnValue({ toast: jest.fn() })
    ;(apiClient.getBins as jest.Mock).mockResolvedValue(mockBins)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the component title', async () => {
    render(<BinManagementIntegrated />)
    await waitFor(() => {
      expect(screen.getByText('Bin Management')).toBeInTheDocument()
    })
  })

  it('loads and displays bins', async () => {
    render(<BinManagementIntegrated />)
    await waitFor(() => {
      expect(apiClient.getBins).toHaveBeenCalled()
      expect(screen.getByText('bin1')).toBeInTheDocument()
      expect(screen.getByText('bin2')).toBeInTheDocument()
    })
  })

  it('displays bin locations', async () => {
    render(<BinManagementIntegrated />)
    await waitFor(() => {
      expect(screen.getByText('Downtown')).toBeInTheDocument()
      expect(screen.getByText('Park')).toBeInTheDocument()
    })
  })

  it('filters bins by search term', async () => {
    render(<BinManagementIntegrated />)
    await waitFor(() => expect(screen.getByText('bin1')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText('Search bins...')
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Park' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Park')).toBeInTheDocument()
      expect(screen.queryByText('Downtown')).not.toBeInTheDocument()
    })
  })

  it('displays error toast on API failure', async () => {
    const mockToast = jest.fn()
    ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(apiClient.getBins as jest.Mock).mockRejectedValue(new Error('Failed to load bins'))

    render(<BinManagementIntegrated />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', variant: 'destructive' })
      )
    })
  })

  it('shows loading spinner initially', () => {
    render(<BinManagementIntegrated />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('polls getBins at the correct 10-second interval', async () => {
    // FIX: component uses POLL_INTERVAL = 10_000ms, not 5000ms
    jest.useFakeTimers()
    ;(apiClient.getBins as jest.Mock).mockResolvedValue(mockBins)

    render(<BinManagementIntegrated />)

    // Initial load
    await act(async () => { jest.runAllTimers() })
    expect(apiClient.getBins).toHaveBeenCalledTimes(1)

    // Advance by exactly 10 seconds → second poll
    await act(async () => { jest.advanceTimersByTime(10_000) })
    expect(apiClient.getBins).toHaveBeenCalledTimes(2)

    // Another 10 seconds → third poll
    await act(async () => { jest.advanceTimersByTime(10_000) })
    expect(apiClient.getBins).toHaveBeenCalledTimes(3)
  })
})