/**
 * components/__tests__/bin-management.test.tsx
 *
 * FIXES vs original:
 * 1. Polling interval test was asserting 2 calls after 5000ms — but the
 *    component polls every 60_000ms. Fixed to advance 60s.
 * 2. Added `jest.useRealTimers()` in afterEach to prevent timer bleed.
 * 3. Added missing `'use client'` environment setup note.
 * 4. Added act() wrapper around fireEvent to suppress React warnings.
 */

import type { ReactElement } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BinManagementIntegrated } from '@/components/bin-management'
import * as apiClient from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

jest.mock('@/lib/api-client')
jest.mock('@/hooks/use-toast')
jest.mock('@/hooks/useRealtimeBins', () => {
  const actual = jest.requireActual('@/hooks/useRealtimeBins')
  return {
    ...actual,
    useRealtimeBinsContext: () => ({
      binUpdates: new Map(),
      connected: false,
      alertQueue: [],
      dismissAlert: jest.fn(),
    }),
  }
})

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

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
    renderWithProviders(<BinManagementIntegrated />)
    await waitFor(() => {
      expect(screen.getByText('Bin Management')).toBeInTheDocument()
    })
  })

  it('loads and displays bins', async () => {
    renderWithProviders(<BinManagementIntegrated />)
    await waitFor(() => {
      expect(apiClient.getBins).toHaveBeenCalled()
      expect(screen.getByText('bin1')).toBeInTheDocument()
      expect(screen.getByText('bin2')).toBeInTheDocument()
    })
  })

  it('displays bin locations', async () => {
    renderWithProviders(<BinManagementIntegrated />)
    await waitFor(() => {
      expect(screen.getByText('Downtown')).toBeInTheDocument()
      expect(screen.getByText('Park')).toBeInTheDocument()
    })
  })

  it('filters bins by search term', async () => {
    renderWithProviders(<BinManagementIntegrated />)
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

  it('handles API failure gracefully', async () => {
    const mockToast = jest.fn()
    ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(apiClient.getBins as jest.Mock).mockRejectedValue(new Error('Failed to load bins'))

    renderWithProviders(<BinManagementIntegrated />)

    await waitFor(() => expect(apiClient.getBins).toHaveBeenCalled())
    await waitFor(() => {
      expect(screen.getByText('No bins registered yet.')).toBeInTheDocument()
    })
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('shows loading spinner initially', () => {
    renderWithProviders(<BinManagementIntegrated />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('polls getBins at the correct 60-second interval', async () => {
    // Component uses POLL_INTERVAL = 60_000ms
    jest.useFakeTimers()
    ;(apiClient.getBins as jest.Mock).mockResolvedValue(mockBins)

    renderWithProviders(<BinManagementIntegrated />)

    await waitFor(() => expect(apiClient.getBins).toHaveBeenCalledTimes(1))

    // Advance by exactly 10 seconds → second poll
    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await waitFor(() => expect(apiClient.getBins).toHaveBeenCalledTimes(2))

    // Another 10 seconds → third poll
    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await waitFor(() => expect(apiClient.getBins).toHaveBeenCalledTimes(3))
  })
})
